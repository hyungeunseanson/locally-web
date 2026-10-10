#!/usr/bin/env bash
set -Eeuo pipefail
image="${1:?digest-pinned image required}"
if [[ ! "$image" =~ ^public\.ecr\.aws/supabase/postgres:[a-zA-Z0-9._-]+@sha256:[a-f0-9]{64}$ ]]; then
  echo 'BACKUP_REGISTRY_UNPINNED_IMAGE_REJECTED' >&2
  exit 64
fi
expected="public.ecr.aws/supabase/postgres@${image##*@}"
verify() {
  docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$image" 2>/dev/null | grep -Fxq "$expected"
}
if verify; then
  echo 'BACKUP_REGISTRY_VERIFIED_CACHE_HIT'
  exit 0
fi
log_file="$(mktemp)"
trap 'rm -f "$log_file"' EXIT
for attempt in 1 2 3 4; do
  if docker pull "$image" >"$log_file" 2>&1; then
    if ! verify; then
      echo 'BACKUP_REGISTRY_DIGEST_MISMATCH' >&2
      exit 65
    fi
    echo 'BACKUP_REGISTRY_PINNED_IMAGE_READY'
    exit 0
  fi
  # Retry only an explicit registry rate limit. Authentication, missing
  # manifests, generic transport failures and restore failures are terminal.
  if grep -Eiq 'unauthorized|authentication required|manifest unknown|denied' "$log_file"; then
    echo 'BACKUP_REGISTRY_PERMANENT_FAILURE' >&2
    exit 69
  fi
  if ! grep -Eiq 'toomanyrequests|(^|[^0-9])429([^0-9]|$)|rate exceeded' "$log_file"; then
    echo 'BACKUP_REGISTRY_NON_RATE_LIMIT_FAILURE' >&2
    exit 69
  fi
  if [[ "$attempt" == 4 ]]; then
    echo 'BACKUP_REGISTRY_RATE_LIMIT_EXHAUSTED' >&2
    exit 75
  fi
  delay=$((2 ** attempt))
  echo "BACKUP_REGISTRY_RATE_LIMIT_RETRY attempt=$attempt delay_seconds=$delay" >&2
  sleep "$delay"
done
