#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 3 ]]; then
  echo "usage: verify-downloaded-backup.sh CIPHERTEXT CIPHERTEXT_SHA256 AGE_IDENTITY" >&2
  exit 64
fi

ciphertext="$1"
ciphertext_checksum="$2"
identity="$3"

test -f "$identity"
test "$(stat -f '%Lp' "$identity")" = "600"
(
  cd "$(dirname "$ciphertext")"
  shasum -a 256 -c "$(basename "$ciphertext_checksum")"
)

verification_dir="$(mktemp -d)"
trap 'rm -rf "$verification_dir"' EXIT

age --decrypt --identity "$identity" "$ciphertext" \
  | tar -xzf - -C "$verification_dir"

(
  cd "$verification_dir"
  shasum -a 256 -c SHA256SUMS
)

echo "R2_DOWNLOAD_DECRYPT_AND_INTERNAL_CHECKSUM_PASS"
