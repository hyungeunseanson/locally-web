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

restore_url="postgresql://postgres:postgres@127.0.0.1:${restore_port}/postgres"

psql "$restore_url" --variable ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS auth CASCADE;
DROP SCHEMA IF EXISTS storage CASCADE;
SQL

psql "$restore_url" --variable ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
SQL

psql "$restore_url" --single-transaction --variable ON_ERROR_STOP=1 \
  --file "$backup_dir/roles.sql" \
  --file "$backup_dir/managed-auth-storage-pre.sql" \
  --file "$backup_dir/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$backup_dir/data.sql" \
  --file "$backup_dir/managed-auth-storage.sql"

psql "$restore_url" --single-transaction --variable ON_ERROR_STOP=1 \
  --file "$backup_dir/realtime.sql"

if [[ -s "$backup_dir/history_schema.sql" ]]; then
  psql "$restore_url" --single-transaction --variable ON_ERROR_STOP=1 \
    --file "$backup_dir/history_schema.sql" \
    --file "$backup_dir/history_data.sql"
fi

psql "$restore_url" --variable ON_ERROR_STOP=1 --file "$assertions_sql"
psql "$restore_url" --variable ON_ERROR_STOP=1 --file "$backup_dir/catalog.sql" \
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
