#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
postgres_image='public.ecr.aws/supabase/postgres:17.6.1.158@sha256:99b1729aeb0bac314445024fc149fbd39306170b61dd50800ccf180327ab3459'
fixture_root="$(mktemp -d)"
source_container="locally-backup-source-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}-${BASHPID}"
source_started=false

cleanup() {
  status=$?
  if [[ "$source_started" == true ]]; then
    docker rm -f "$source_container" >/dev/null 2>&1 || true
  fi
  rm -rf "$fixture_root"
  exit "$status"
}
trap cleanup EXIT

docker run --detach --name "$source_container" \
  --network none \
  -e POSTGRES_PASSWORD=postgres \
  "$postgres_image" >/dev/null
source_started=true

temporary_readiness_observed=false
for _ in {1..600}; do
  container_logs="$(docker logs "$source_container" 2>&1 || true)"
  if docker exec "$source_container" \
    pg_isready --host /var/run/postgresql --username postgres --dbname postgres \
    >/dev/null 2>&1 \
    && ! grep -Fq 'PostgreSQL init process complete; ready for start up.' \
      <<< "$container_logs"; then
    temporary_readiness_observed=true
    break
  fi
  if grep -Fq 'PostgreSQL init process complete; ready for start up.' \
    <<< "$container_logs"; then
    break
  fi
  sleep 0.05
done

if [[ "$temporary_readiness_observed" != true ]]; then
  echo 'pinned image did not expose the expected temporary-server readiness window' >&2
  "$repo_root/scripts/backup/postgres-container-lifecycle.sh" diagnose "$source_container"
  exit 1
fi
echo 'BACKUP_TEMPORARY_POSTGRES_READINESS_REPRODUCED'

BACKUP_RESTORE_POLL_SECONDS=0.1 \
  "$repo_root/scripts/backup/postgres-container-lifecycle.sh" wait "$source_container" 300

backup_dir="$fixture_root/backup"
mkdir -m 700 "$backup_dir"
docker exec "$source_container" \
  createdb --username supabase_admin --template template0 synthetic_backup
docker exec --interactive "$source_container" \
  psql --username supabase_admin --dbname synthetic_backup --variable ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE public.synthetic_items (
  id bigint PRIMARY KEY,
  value text NOT NULL
);
ALTER TABLE public.synthetic_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthetic_items_read ON public.synthetic_items FOR SELECT USING (true);
INSERT INTO public.synthetic_items (id, value) VALUES (1, 'alpha'), (2, 'beta');
CREATE FUNCTION public.synthetic_items_count() RETURNS bigint
LANGUAGE sql STABLE
AS $$ SELECT count(*) FROM public.synthetic_items $$;
CREATE PUBLICATION supabase_realtime FOR TABLE public.synthetic_items;
SQL

docker exec "$source_container" \
  pg_dump --username supabase_admin --dbname synthetic_backup --format=custom \
  > "$backup_dir/database.dump"
: > "$backup_dir/roles.sql"

cat > "$backup_dir/catalog.sql" <<'SQL'
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
SELECT jsonb_build_object(
  'counts', jsonb_build_object(
    'public.synthetic_items', (SELECT count(*) FROM public.synthetic_items)
  ),
  'policies_definition_digest', md5(COALESCE((
    SELECT string_agg(pg_get_expr(polqual, polrelid), E'\n' ORDER BY polname)
    FROM pg_policy WHERE polrelid = 'public.synthetic_items'::regclass
  ), '')),
  'functions_definition_digest', md5(pg_get_functiondef('public.synthetic_items_count()'::regprocedure)),
  'triggers_definition_digest', md5(''),
  'table_grants_digest', md5(''),
  'realtime_tables', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('schema', schemaname, 'table', tablename)
      ORDER BY schemaname, tablename)
    FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
  ), '[]'::jsonb)
);
SQL
docker cp "$backup_dir/catalog.sql" "$source_container:/tmp/catalog.sql"
docker exec "$source_container" \
  psql --username supabase_admin --dbname synthetic_backup \
    --quiet --variable ON_ERROR_STOP=1 --file /tmp/catalog.sql \
  > "$backup_dir/source-catalog.json"
printf '{"public.synthetic_items": 2}\n' > "$backup_dir/dump-counts.json"

cat > "$fixture_root/assertions.sql" <<'SQL'
\set ON_ERROR_STOP on
DO $$
BEGIN
  IF (SELECT count(*) FROM public.synthetic_items) <> 2 THEN
    RAISE EXCEPTION 'synthetic restore row count mismatch';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.synthetic_items'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'synthetic restore RLS missing';
  END IF;
END;
$$;
SQL

BACKUP_RESTORE_POSTGRES_IMAGE="$postgres_image" \
BACKUP_RESTORE_POLL_SECONDS=0.1 \
  "$repo_root/scripts/backup/restore-test.sh" \
    "$backup_dir" "$fixture_root/assertions.sql"

echo 'BACKUP_PINNED_IMAGE_COLD_RESTORE_PASS'

tools_dir="$fixture_root/tools"
mkdir -m 700 "$tools_dir"
curl --fail --silent --show-error --location \
  'https://github.com/FiloSottile/age/releases/download/v1.3.1/age-v1.3.1-linux-amd64.tar.gz' \
  --output "$fixture_root/age.tar.gz"
echo "bdc69c09cbdd6cf8b1f333d372a1f58247b3a33146406333e30c0f26e8f51377  $fixture_root/age.tar.gz" \
  | sha256sum --check --strict
tar -xzf "$fixture_root/age.tar.gz" -C "$tools_dir"
export PATH="$tools_dir/age:$PATH"

identity="$fixture_root/test.agekey"
age-keygen --output "$identity" >/dev/null 2>&1
chmod 600 "$identity"
recipient="$(age-keygen -y "$identity")"
(
  cd "$backup_dir"
  find . -type f ! -name SHA256SUMS -print0 \
    | sort -z \
    | xargs -0 sha256sum > SHA256SUMS
)
ciphertext="$fixture_root/backup.tar.gz.age"
tar -C "$backup_dir" -czf - . \
  | age --recipient "$recipient" --output "$ciphertext"
sha256sum "$ciphertext" > "$ciphertext.sha256"

BACKUP_RESTORE_POSTGRES_IMAGE="$postgres_image" \
BACKUP_RESTORE_POLL_SECONDS=0.1 \
  "$repo_root/scripts/backup/verify-downloaded-backup.sh" \
    "$ciphertext" "$ciphertext.sha256" "$identity" "$fixture_root/assertions.sql"

echo 'BACKUP_DOWNLOADED_ARCHIVE_DECRYPT_AND_RESTORE_CONTRACT_PASS'
