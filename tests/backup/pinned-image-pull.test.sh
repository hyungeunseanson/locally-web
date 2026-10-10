#!/usr/bin/env bash
set -Eeuo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
fixture="$(mktemp -d)"
trap 'rm -rf "$fixture"' EXIT
export FAKE_PULL_ROOT="$fixture"
export PATH="$fixture:$PATH"
image='public.ecr.aws/supabase/postgres:17.6.1.158@sha256:99b1729aeb0bac314445024fc149fbd39306170b61dd50800ccf180327ab3459'
export FIXTURE_PINNED_IMAGE="$image"
cat > "$fixture/docker" <<'MOCK'
#!/usr/bin/env bash
set -eu
mode="$(cat "$FAKE_PULL_ROOT/mode")"
if [[ "$1" == image ]]; then
  [[ -f "$FAKE_PULL_ROOT/ready" ]] || exit 1
  if [[ "$mode" == mismatch ]]; then echo 'public.ecr.aws/supabase/postgres@sha256:wrong'; else echo "public.ecr.aws/supabase/postgres@${FIXTURE_PINNED_IMAGE##*@}"; fi
  exit 0
fi
[[ "$1" == pull && "$2" == "$FIXTURE_PINNED_IMAGE" ]] || exit 99
count=$(($(cat "$FAKE_PULL_ROOT/count")+1));echo "$count" > "$FAKE_PULL_ROOT/count"
case "$mode" in
  retry) if [[ "$count" -lt 3 ]]; then echo 'toomanyrequests: Rate exceeded' >&2;exit 1;fi ;;
  exhausted) echo 'HTTP 429 Too Many Requests' >&2;exit 1 ;;
  auth) echo 'unauthorized' >&2;exit 1 ;;
  transport) echo 'connection reset' >&2;exit 1 ;;
  missing) echo 'manifest unknown' >&2;exit 1 ;;
esac
touch "$FAKE_PULL_ROOT/ready"
MOCK
cat > "$fixture/sleep" <<'MOCK'
#!/usr/bin/env bash
echo "$1" >> "$FAKE_PULL_ROOT/delays"
MOCK
chmod +x "$fixture/docker" "$fixture/sleep"
for mode in retry exhausted auth transport missing mismatch cached; do
  echo "$mode" > "$fixture/mode";echo 0 > "$fixture/count";rm -f "$fixture/ready" "$fixture/delays"
  [[ "$mode" != cached ]] || touch "$fixture/ready"
  status=0
  "$repo_root/scripts/backup/pull-pinned-image.sh" "$image" > "$fixture/result" 2>&1 || status=$?
  count=$(cat "$fixture/count")
  case "$mode" in
    retry) [[ "$status" == 0 && "$count" == 3 ]]; [[ "$(cat "$fixture/delays")" == $'2\n4' ]] ;;
    exhausted) [[ "$status" == 75 && "$count" == 4 ]]; [[ "$(cat "$fixture/delays")" == $'2\n4\n8' ]] ;;
    mismatch) [[ "$status" == 65 && "$count" == 1 ]] ;;
    cached) [[ "$status" == 0 && "$count" == 0 ]] ;;
    *) [[ "$status" == 69 && "$count" == 1 ]] ;;
  esac
done
if "$repo_root/scripts/backup/pull-pinned-image.sh" 'public.ecr.aws/supabase/postgres:latest' > "$fixture/result" 2>&1; then exit 1;fi
echo 'BACKUP_PINNED_IMAGE_RATE_LIMIT_CONTRACT_PASS'
