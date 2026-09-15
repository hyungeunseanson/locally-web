#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 3 && $# -ne 4 ]]; then
  echo "usage: verify-downloaded-backup.sh CIPHERTEXT CIPHERTEXT_SHA256 AGE_IDENTITY [SECURITY_ASSERTIONS_SQL]" >&2
  exit 64
fi

ciphertext="$1"
ciphertext_checksum="$2"
identity="$3"
assertions_sql="${4:-}"

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{ print $1 }'
  else
    shasum -a 256 "$1" | awk '{ print $1 }'
  fi
}

file_mode() {
  if stat -f '%Lp' "$1" >/dev/null 2>&1; then
    stat -f '%Lp' "$1"
  else
    stat -c '%a' "$1"
  fi
}

test -f "$ciphertext"
test -f "$ciphertext_checksum"
test -f "$identity"
test "$(file_mode "$identity")" = "600"
if [[ -n "$assertions_sql" ]]; then
  test -f "$assertions_sql"
fi
expected_ciphertext_sha="$(awk 'NR == 1 { print $1 }' "$ciphertext_checksum")"
[[ "$expected_ciphertext_sha" =~ ^[0-9a-f]{64}$ ]]
actual_ciphertext_sha="$(sha256_file "$ciphertext")"
[[ "$expected_ciphertext_sha" == "$actual_ciphertext_sha" ]]
echo "R2_CIPHERTEXT_CHECKSUM_PASS"

verification_dir="$(mktemp -d)"
trap 'rm -rf "$verification_dir"' EXIT
chmod 700 "$verification_dir"
plaintext_archive="$verification_dir/backup.tar.gz"
touch "$plaintext_archive"
chmod 600 "$plaintext_archive"

age --decrypt --identity "$identity" "$ciphertext" \
  > "$plaintext_archive"

python3 - "$plaintext_archive" "$verification_dir/extracted" <<'PY'
import os
import pathlib
import sys
import tarfile

archive_path = pathlib.Path(sys.argv[1])
destination = pathlib.Path(sys.argv[2])
destination.mkdir(mode=0o700)
destination_root = destination.resolve()

with tarfile.open(archive_path, mode="r:gz") as archive:
    for member in archive.getmembers():
        member_path = pathlib.PurePosixPath(member.name)
        if member_path.is_absolute() or ".." in member_path.parts:
            raise SystemExit("unsafe backup archive path")
        if member.issym() or member.islnk() or member.isdev() or member.isfifo():
            raise SystemExit("unsafe backup archive member type")
        resolved = (destination / member.name).resolve()
        if os.path.commonpath((destination_root, resolved)) != str(destination_root):
            raise SystemExit("backup archive path escapes verification directory")
    archive.extractall(destination)
PY

python3 - "$verification_dir/extracted" <<'PY'
import hashlib
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1]).resolve()
manifest = root / "SHA256SUMS"
if not manifest.is_file():
    raise SystemExit("missing internal checksum manifest")

for line in manifest.read_text(encoding="utf-8").splitlines():
    match = re.fullmatch(r"([0-9a-f]{64})  (.+)", line)
    if not match:
        raise SystemExit("invalid internal checksum entry")
    expected, relative_name = match.groups()
    candidate = (root / relative_name).resolve()
    if root not in candidate.parents or not candidate.is_file() or candidate.is_symlink():
        raise SystemExit("unsafe internal checksum path")
    digest = hashlib.sha256()
    with candidate.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest() != expected:
        raise SystemExit("internal backup checksum mismatch")
PY

echo "R2_DOWNLOAD_DECRYPT_AND_INTERNAL_CHECKSUM_PASS"

if [[ -n "$assertions_sql" ]]; then
  rm "$plaintext_archive"
  scripts/backup/restore-test.sh "$verification_dir/extracted" "$assertions_sql"
  echo "R2_DOWNLOAD_DECRYPT_RESTORE_PASS"
fi
