#!/usr/bin/env bash

set -Eeuo pipefail

if [[ $# -ne 4 ]]; then
  echo "usage: package-r2-repair-journal.sh <repair-dir> <action> <apply-outcome> <encrypted-output>" >&2
  exit 64
fi

repair_dir="$1"
action="$2"
apply_outcome="$3"
encrypted_output="$4"

if [[ "$action" != "canary" && "$action" != "full" ]]; then
  echo "journal packaging supports only canary or full actions" >&2
  exit 64
fi

journal_path="$repair_dir/rollback-journal.json"
receipt_name="${action}-receipt.json"
receipt_path="$repair_dir/$receipt_name"

if [[ ! -s "$journal_path" ]]; then
  if [[ "$apply_outcome" == "success" ]]; then
    echo "successful apply is missing its rollback journal" >&2
    exit 1
  fi
  exit 0
fi

if [[ -z "${R2_REPAIR_ARTIFACT_KEY:-}" ]]; then
  echo "R2_REPAIR_ARTIFACT_KEY is required to preserve the rollback journal" >&2
  exit 1
fi

umask 077
mkdir -p "$(dirname "$encrypted_output")"
archive_path="${encrypted_output}.tar.gz"
temporary_output="${encrypted_output}.tmp"
files=(rollback-journal.json)
missing_success_receipt=false

if [[ -s "$receipt_path" ]]; then
  files+=("$receipt_name")
elif [[ "$apply_outcome" == "success" ]]; then
  missing_success_receipt=true
fi

cleanup() {
  rm -f "$archive_path" "$temporary_output"
}
trap cleanup EXIT

tar -C "$repair_dir" -czf "$archive_path" "${files[@]}"
openssl enc -aes-256-cbc -pbkdf2 -salt \
  -in "$archive_path" \
  -out "$temporary_output" \
  -pass env:R2_REPAIR_ARTIFACT_KEY
mv "$temporary_output" "$encrypted_output"
rm -f "$journal_path" "$receipt_path"

if [[ "$missing_success_receipt" == "true" ]]; then
  echo "successful apply is missing its receipt; rollback journal was preserved" >&2
  exit 1
fi
