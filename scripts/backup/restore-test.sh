#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: restore-test.sh BACKUP_DIR SECURITY_ASSERTIONS_SQL" >&2
  exit 64
fi

backup_dir="$1"
assertions_sql="$2"
restore_container="locally-backup-restore-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
restore_port="55432"

cleanup() {
  docker rm -f "$restore_container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run --detach --name "$restore_container" \
  -e POSTGRES_PASSWORD=postgres \
  -p "127.0.0.1:${restore_port}:5432" \
  public.ecr.aws/supabase/postgres:17.6.1.158 >/dev/null

for _ in {1..90}; do
  if docker exec "$restore_container" pg_isready -U postgres -d postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker exec "$restore_container" pg_isready -U postgres -d postgres >/dev/null

docker cp "$backup_dir/database.dump" "$restore_container:/tmp/database.dump"
docker cp "$backup_dir/roles.sql" "$restore_container:/tmp/roles.sql"

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

restore_url="postgresql://supabase_admin:postgres@127.0.0.1:${restore_port}/locally_restore"

psql "$restore_url" --variable ON_ERROR_STOP=1 --file "$assertions_sql"
psql "$restore_url" --quiet --variable ON_ERROR_STOP=1 --file "$backup_dir/catalog.sql" \
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
        raise SystemExit(f"{key} mismatch")

source_realtime = source.get("realtime_tables", [])
restored_realtime = restored.get("realtime_tables", [])
if source_realtime != restored_realtime:
    raise SystemExit("supabase_realtime table list mismatch")

print("RESTORE_COUNTS_SECURITY_OBJECTS_AND_REALTIME_PASS")
PY
