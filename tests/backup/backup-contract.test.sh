#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
workflow="$repo_root/.github/workflows/supabase-r2-backup.yml"
restore_script="$repo_root/scripts/backup/restore-test.sh"
verify_script="$repo_root/scripts/backup/verify-downloaded-backup.sh"
storage_script="$repo_root/scripts/backup/storage-byte-backup.py"
storage_module="$repo_root/scripts/backup/storage_byte_backup.py"

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
grep -Fq 'postgres-container-lifecycle.sh" wait' "$restore_script"
grep -Fq 'restore-test.sh" "$verification_dir/extracted"' "$verify_script"
grep -Fq 'shell_pid="${BASHPID:-$$}"' "$restore_script"
grep -Fq 'mktemp -d "${TMPDIR:-/tmp}/locally-backup-verify.XXXXXX"' "$verify_script"
grep -Fq 'IfNoneMatch="*"' "$storage_module"
grep -Fq 'PRIVATE_R2_BUCKET = "locally-production-db-backups"' "$storage_module"
grep -Fq 'R2_PREFIX = "daily/storage-v1/"' "$storage_module"
grep -Fq 'MAX_OBJECTS = 1200' "$storage_module"
grep -Fq 'MAX_SOURCE_BYTES = 512 * 1024 * 1024' "$storage_module"
grep -Fq 'MAX_R2_OBJECTS = 2500' "$storage_module"
grep -Fq 'MAX_R2_BYTES = 640 * 1024 * 1024' "$storage_module"
if grep -Eq 'delete_object|copy_object|upload_file' "$storage_module"; then
  echo 'Storage backup unexpectedly permits overwrite/copy/delete APIs' >&2
  exit 1
fi
test -x "$storage_script"

fixture_root="$(mktemp -d)"
trap 'rm -rf "$fixture_root"' EXIT
touch "$fixture_root/assertions.sql"
if "$restore_script" 'postgresql://production.invalid/postgres' "$fixture_root/assertions.sql" \
  >/dev/null 2>&1; then
  echo 'external restore target was accepted' >&2
  exit 1
fi

echo 'BACKUP_WORKFLOW_AND_ISOLATION_CONTRACT_PASS'
