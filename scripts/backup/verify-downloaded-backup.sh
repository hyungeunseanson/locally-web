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
expected_ciphertext_sha="$(awk 'NR == 1 { print $1 }' "$ciphertext_checksum")"
actual_ciphertext_sha="$(shasum -a 256 "$ciphertext" | awk '{ print $1 }')"
[[ "$expected_ciphertext_sha" == "$actual_ciphertext_sha" ]]
echo "R2_CIPHERTEXT_CHECKSUM_PASS"

verification_dir="$(mktemp -d)"
trap 'rm -rf "$verification_dir"' EXIT

age --decrypt --identity "$identity" "$ciphertext" \
  | tar -xzf - -C "$verification_dir"

(
  cd "$verification_dir"
  shasum -a 256 -c SHA256SUMS
)

echo "R2_DOWNLOAD_DECRYPT_AND_INTERNAL_CHECKSUM_PASS"
