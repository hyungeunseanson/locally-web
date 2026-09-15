#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  echo "usage: postgres-container-lifecycle.sh wait CONTAINER [TIMEOUT_SECONDS] | diagnose CONTAINER" >&2
  exit 64
}

if [[ $# -lt 2 || $# -gt 3 ]]; then
  usage
fi

operation="$1"
container="$2"
timeout_seconds="${3:-180}"

if [[ ! "$container" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]]; then
  echo "invalid restore container identifier" >&2
  exit 64
fi

diagnose() {
  local state
  state="$(docker inspect --format \
    'state={{.State.Status}} oomKilled={{.State.OOMKilled}} exitCode={{.State.ExitCode}} restartCount={{.RestartCount}} startedAt={{.State.StartedAt}} finishedAt={{.State.FinishedAt}}' \
    "$container" 2>/dev/null || true)"
  if [[ -z "$state" ]]; then
    state="state=unavailable"
  fi
  echo "BACKUP_RESTORE_CONTAINER_DIAGNOSTIC $state" >&2

  docker logs --timestamps "$container" 2>&1 \
    | grep -E \
      'PostgreSQL init process complete|database system is ready to accept connections|received fast shutdown request|database system is shut down|init process failed|FATAL:' \
    | tail -n 24 \
    | sed 's/^/BACKUP_RESTORE_LIFECYCLE /' >&2 || true
}

case "$operation" in
  diagnose)
    [[ $# -eq 2 ]] || usage
    diagnose
    ;;
  wait)
    [[ "$timeout_seconds" =~ ^[0-9]+$ ]] || usage
    if (( timeout_seconds < 1 || timeout_seconds > 600 )); then
      echo "restore readiness timeout must be between 1 and 600 seconds" >&2
      exit 64
    fi

    deadline=$((SECONDS + timeout_seconds))
    final_marker='PostgreSQL init process complete; ready for start up.'
    poll_seconds="${BACKUP_RESTORE_POLL_SECONDS:-1}"

    while (( SECONDS < deadline )); do
      state="$(docker inspect --format '{{.State.Status}}' "$container" 2>/dev/null || true)"
      if [[ "$state" != "running" ]]; then
        echo "restore container exited before final PostgreSQL readiness" >&2
        diagnose
        exit 1
      fi

      container_logs="$(docker logs "$container" 2>&1 || true)"
      if grep -Fq "$final_marker" <<< "$container_logs"; then
        if docker exec "$container" \
          pg_isready --host /var/run/postgresql --username postgres --dbname postgres \
          >/dev/null 2>&1 \
          && docker exec "$container" \
            psql --host /var/run/postgresql --username postgres --dbname postgres \
              --tuples-only --no-align --variable ON_ERROR_STOP=1 \
              --command 'SELECT pg_is_in_recovery() = false' \
            | grep -Fxq 't'; then
          echo "BACKUP_RESTORE_FINAL_POSTGRES_READY"
          exit 0
        fi
      fi

      sleep "$poll_seconds"
    done

    echo "timed out waiting for final PostgreSQL server readiness" >&2
    diagnose
    exit 1
    ;;
  *)
    usage
    ;;
esac
