#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: restore-test.sh BACKUP_DIR SECURITY_ASSERTIONS_SQL" >&2
  exit 64
fi

backup_dir="$1"
assertions_sql="$2"
restore_container="locally-backup-restore-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}-${BASHPID}"
postgres_image="${BACKUP_RESTORE_POSTGRES_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.158@sha256:99b1729aeb0bac314445024fc149fbd39306170b61dd50800ccf180327ab3459}"
container_started=false

if [[ ! -d "$backup_dir" || "$backup_dir" == postgresql://* || "$backup_dir" == postgres://* ]]; then
  echo "backup restore input must be a local backup directory" >&2
  exit 64
fi

for required_file in database.dump roles.sql catalog.sql source-catalog.json dump-counts.json; do
  if [[ ! -f "$backup_dir/$required_file" || -L "$backup_dir/$required_file" ]]; then
    echo "missing or unsafe backup input: $required_file" >&2
    exit 65
  fi
done

if [[ ! -f "$assertions_sql" || -L "$assertions_sql" ]]; then
  echo "security assertions must be a regular local file" >&2
  exit 65
fi

cleanup() {
  status=$?
  if [[ "$status" -ne 0 && "$container_started" == true ]]; then
    scripts/backup/postgres-container-lifecycle.sh diagnose "$restore_container" || true
  fi
  if [[ "$container_started" == true ]]; then
    docker rm -f "$restore_container" >/dev/null 2>&1 || true
  fi
  exit "$status"
}
trap cleanup EXIT

docker run --detach --name "$restore_container" \
  --network none \
  -e POSTGRES_PASSWORD=postgres \
  "$postgres_image" >/dev/null
container_started=true

scripts/backup/postgres-container-lifecycle.sh wait "$restore_container" 180

docker cp "$backup_dir/database.dump" "$restore_container:/tmp/database.dump"
docker cp "$backup_dir/roles.sql" "$restore_container:/tmp/roles.sql"
docker cp "$assertions_sql" "$restore_container:/tmp/security-assertions.sql"
docker cp "$backup_dir/catalog.sql" "$restore_container:/tmp/catalog.sql"

docker exec --interactive "$restore_container" \
  psql --username supabase_admin --dbname postgres --variable ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  CREATE ROLE supabase_realtime_admin NOLOGIN;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
SQL

docker exec "$restore_container" \
  createdb --username supabase_admin --template template0 locally_restore
docker exec "$restore_container" \
  psql --username supabase_admin --dbname locally_restore \
  --variable ON_ERROR_STOP=1 --file /tmp/roles.sql
docker exec "$restore_container" sh -c \
  "pg_restore --list /tmp/database.dump | grep -Ev '; .* ACL - .* extensions([ .]|$)' > /tmp/restore.list"
docker exec "$restore_container" \
  pg_restore --username supabase_admin --dbname locally_restore \
  --single-transaction --exit-on-error \
  --use-list /tmp/restore.list /tmp/database.dump

docker exec "$restore_container" \
  psql --username supabase_admin --dbname locally_restore \
  --variable ON_ERROR_STOP=1 --file /tmp/security-assertions.sql
docker exec "$restore_container" \
  psql --username supabase_admin --dbname locally_restore \
  --quiet --variable ON_ERROR_STOP=1 --file /tmp/catalog.sql \
  > "$backup_dir/restored-catalog.json"

python3 - "$backup_dir/source-catalog.json" "$backup_dir/restored-catalog.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as source_file:
    source = json.load(source_file)
with open(sys.argv[2], encoding="utf-8") as restored_file:
    restored = json.load(restored_file)

with open(sys.argv[1].replace("source-catalog.json", "dump-counts.json"), encoding="utf-8") as count_file:
    dump_counts = json.load(count_file)

if dump_counts != restored["counts"]:
    raise SystemExit(f"row-count mismatch: dump={dump_counts} restored={restored['counts']}")

for key in (
    "policies_definition_digest",
    "functions_definition_digest",
    "triggers_definition_digest",
    "table_grants_digest",
):
    if source[key] != restored[key]:
        if key == "policies_definition_digest":
            source_policies = {item["key"]: item["digest"] for item in source["policies"]}
            restored_policies = {item["key"]: item["digest"] for item in restored["policies"]}
            differing = sorted(
                policy for policy in source_policies.keys() | restored_policies.keys()
                if source_policies.get(policy) != restored_policies.get(policy)
            )
            print("policy entries differing: " + ", ".join(differing), file=sys.stderr)
        raise SystemExit(f"{key} mismatch")

source_realtime = source.get("realtime_tables", [])
restored_realtime = restored.get("realtime_tables", [])
if source_realtime != restored_realtime:
    raise SystemExit("supabase_realtime table list mismatch")

print("RESTORE_COUNTS_SECURITY_OBJECTS_AND_REALTIME_PASS")
PY
