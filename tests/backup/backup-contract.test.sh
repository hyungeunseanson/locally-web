#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
workflow="$repo_root/.github/workflows/supabase-r2-backup.yml"
restore_script="$repo_root/scripts/backup/restore-test.sh"
verify_script="$repo_root/scripts/backup/verify-downloaded-backup.sh"

grep -Fq 'group: supabase-production-r2-backup' "$workflow"
grep -Fq 'cancel-in-progress: false' "$workflow"
grep -Fq 'locally-production-db-backups' "$workflow"
grep -Fq 'BACKUP_RESTORE_POSTGRES_IMAGE' "$workflow"
grep -Fq -- '--network none' "$restore_script"
if grep -Eq -- '-p |--publish|restore_url=' "$restore_script"; then
  echo 'restore target unexpectedly exposes or accepts a network endpoint' >&2
  exit 1
fi
grep -Fq -- '--single-transaction --exit-on-error' "$restore_script"
grep -Fq 'postgres-container-lifecycle.sh wait' "$restore_script"
grep -Fq 'scripts/backup/restore-test.sh "$verification_dir/extracted"' "$verify_script"

fixture_root="$(mktemp -d)"
trap 'rm -rf "$fixture_root"' EXIT
touch "$fixture_root/assertions.sql"
if "$restore_script" 'postgresql://production.invalid/postgres' "$fixture_root/assertions.sql" \
  >/dev/null 2>&1; then
  echo 'external restore target was accepted' >&2
  exit 1
fi

echo 'BACKUP_WORKFLOW_AND_ISOLATION_CONTRACT_PASS'
