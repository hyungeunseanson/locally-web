#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
fixture_dir="$(mktemp -d)"
trap 'rm -rf "$fixture_dir"' EXIT

cat > "$fixture_dir/docker" <<'SH'
#!/usr/bin/env bash
set -Eeuo pipefail

mode="$(cat "$FAKE_DOCKER_STATE/mode")"
case "$1" in
  inspect)
    if [[ "$mode" == failed ]]; then
      if [[ "$*" == *'oomKilled='* ]]; then
        echo 'state=exited oomKilled=true exitCode=137 restartCount=0 startedAt=2026-09-15T00:00:00Z finishedAt=2026-09-15T00:00:03Z'
      else
        echo exited
      fi
    elif [[ "$*" == *'oomKilled='* ]]; then
      echo 'state=running oomKilled=false exitCode=0 restartCount=0 startedAt=2026-09-15T00:00:00Z finishedAt=0001-01-01T00:00:00Z'
    else
      echo running
    fi
    ;;
  logs)
    count_file="$FAKE_DOCKER_STATE/log-count"
    count="$(cat "$count_file")"
    count=$((count + 1))
    echo "$count" > "$count_file"
    if [[ "$mode" == delayed && "$count" -ge 3 ]]; then
      echo 'PostgreSQL init process complete; ready for start up.'
      echo 'database system is ready to accept connections'
    elif [[ "$mode" == failed ]]; then
      echo 'database system is ready to accept connections'
      echo 'received fast shutdown request'
      echo 'database system is shut down'
    else
      echo 'database system is ready to accept connections'
    fi
    ;;
  exec)
    if [[ "$*" == *pg_isready* ]]; then
      exit 0
    fi
    if [[ "$*" == *psql* ]]; then
      echo t
      exit 0
    fi
    exit 2
    ;;
  *)
    exit 2
    ;;
esac
SH
chmod 700 "$fixture_dir/docker"
export PATH="$fixture_dir:$PATH"
export FAKE_DOCKER_STATE="$fixture_dir/state"
mkdir "$FAKE_DOCKER_STATE"
echo delayed > "$FAKE_DOCKER_STATE/mode"
echo 0 > "$FAKE_DOCKER_STATE/log-count"

BACKUP_RESTORE_POLL_SECONDS=0.01 \
  "$repo_root/scripts/backup/postgres-container-lifecycle.sh" wait restore-fixture 5 \
  > "$fixture_dir/wait.out"
grep -Fxq 'BACKUP_RESTORE_FINAL_POSTGRES_READY' "$fixture_dir/wait.out"
if (( $(cat "$FAKE_DOCKER_STATE/log-count") < 3 )); then
  echo 'final readiness accepted temporary pg_isready result' >&2
  exit 1
fi

echo failed > "$FAKE_DOCKER_STATE/mode"
echo 0 > "$FAKE_DOCKER_STATE/log-count"
if BACKUP_RESTORE_POLL_SECONDS=0.01 \
  "$repo_root/scripts/backup/postgres-container-lifecycle.sh" wait restore-fixture 1 \
  > "$fixture_dir/failure.out" 2> "$fixture_dir/failure.err"; then
  echo 'failed initialization was accepted' >&2
  exit 1
fi
grep -Fq 'state=exited oomKilled=true exitCode=137 restartCount=0' "$fixture_dir/failure.err"
grep -Fq 'BACKUP_RESTORE_LIFECYCLE' "$fixture_dir/failure.err"

if "$repo_root/scripts/backup/postgres-container-lifecycle.sh" wait 'invalid/container' 1 \
  >/dev/null 2>&1; then
  echo 'unsafe container identifier was accepted' >&2
  exit 1
fi

echo 'BACKUP_POSTGRES_LIFECYCLE_CONTRACT_PASS'
