#!/usr/bin/env python3
"""Manual-only tiny destination probe; never inventory sources or publish a manifest."""
import argparse
import json
import os
import pathlib
import re
import tempfile

from cleanup_storage_backup import cleanup
from storage_byte_backup import (AgeEncryptor, BackupDiagnostics, BackupError, DestinationError,
                                 PRIVATE_R2_BUCKET, R2_PREFIX, TransferBudget, ValidationError,
                                 boto3_store, safe_write_json, sha256_file)

MAX_PROBE_CIPHERTEXT_BYTES = 4096
MAX_PROBE_CREATE_ATTEMPTS = 4  # Two conditional calls, each with at most one retry.


def run_probe(store, encryptor, root, diagnostics, run_id, attempt):
    if not re.fullmatch(r'[0-9]{1,20}', run_id) or not re.fullmatch(r'[1-9][0-9]{0,4}', attempt):
        raise ValidationError('invalid diagnostic scope')
    budget = TransferBudget(max_source_objects=0, max_source_bytes=0,
                            max_new_r2_objects=MAX_PROBE_CREATE_ATTEMPTS,
                            max_new_r2_bytes=2 * MAX_PROBE_CIPHERTEXT_BYTES)
    diagnostics.destination_budget = budget
    plain, cipher = root / 'opaque.bin', root / 'opaque.age'
    diagnostics.at('encryption', 'none', 'encrypt')
    plain.write_bytes(os.urandom(32))
    plain.chmod(0o600)
    encryptor.encrypt(plain, cipher)
    digest, size = sha256_file(cipher)
    if not 0 < size <= MAX_PROBE_CIPHERTEXT_BYTES:
        raise ValidationError('probe ciphertext exceeds tiny bound')
    key = R2_PREFIX + 'diagnostics/' + run_id + '-' + attempt + '/opaque.age'
    diagnostics.at('destination_create', 'r2', 'put_create_only')
    first, stored_sha, stored_size = store.put_create_only(key, cipher, digest, budget, 'destination-probe')
    if first != 'created' or (stored_sha, stored_size) != (digest, size):
        raise DestinationError('destination_identity_mismatch', 'put_create_only')
    diagnostics.at('destination_byte_verify', 'r2', 'destination_head')
    head = store.head(key)
    metadata = head.get('Metadata') or {}
    if (head.get('ContentLength') != size or metadata.get('sha256') != digest
            or metadata.get('schema') != 'storage-backup-v1' or metadata.get('kind') != 'destination-probe'):
        raise DestinationError('destination_identity_mismatch', 'destination_head', stage='destination_byte_verify')
    diagnostics.at('destination_byte_verify', 'r2', 'verify_bytes')
    store.verify_bytes(key, digest, size)
    diagnostics.at('destination_create', 'r2', 'put_create_only')
    second, second_sha, second_size = store.put_create_only(key, cipher, digest, budget, 'destination-probe')
    precondition = store.last_precondition_evidence or {}
    if (second != 'concurrent-exact-skip' or (second_sha, second_size) != (digest, size)
            or precondition.get('httpStatus') not in {409, 412}):
        raise DestinationError('destination_identity_mismatch', 'put_create_only')
    # Return only fixed outcomes and counters; never the key, payload or endpoint.
    return dict(status='probe_passed', diagnosticCode='destination_probe_passed', firstPut=first, secondPut=second,
                secondPutHttpStatus=precondition['httpStatus'],
                secondPutSdkExceptionClass=precondition['sdkExceptionClass'],
                secondPutProviderErrorCode=precondition['providerErrorCode'],
                secondPutConflict=True, postConflictHeadExact=True, headExact=True, ciphertextShaVerified=True,
                ciphertextBytes=size, completeBackupManifestPublished=False,
                remoteDeletes=0, sourceInventoryOperations=0)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--summary', required=True, type=pathlib.Path)
    args = parser.parse_args(argv)
    diagnostics, root = BackupDiagnostics(args.summary), None
    run_id = os.environ.get('GITHUB_RUN_ID', '')
    result = {}
    try:
        if os.environ.get('GITHUB_EVENT_NAME') != 'workflow_dispatch' or os.environ.get('GITHUB_REF') != 'refs/heads/main':
            raise ValidationError('probe requires manual default-branch invocation')
        if not re.fullmatch(r'[0-9]{1,20}', run_id):
            raise ValidationError('invalid diagnostic scope')
        if (os.environ.get('R2_BUCKET') != PRIVATE_R2_BUCKET or not re.fullmatch(
                r'https://[a-f0-9]{32}\.r2\.cloudflarestorage\.com', os.environ.get('R2_ENDPOINT', ''))):
            raise ValidationError('unexpected private destination configuration')
        root = pathlib.Path(tempfile.mkdtemp(prefix='locally-authoritative-storage-' + run_id + '-probe-', dir=os.environ['RUNNER_TEMP']))
        root.chmod(0o700)
        outcome = run_probe(boto3_store(), AgeEncryptor(os.environ.get('AGE_RECIPIENT')), root,
                            diagnostics, run_id, os.environ.get('GITHUB_RUN_ATTEMPT', ''))
        result = diagnostics.summary()
        result.update(outcome)
    except Exception as error:
        code = error.code if isinstance(error, BackupError) else 'storage_backup_operator_failed'
        result = diagnostics.summary('failed', code, error=error)
        result.update(completeBackupManifestPublished=False, remoteDeletes=0, sourceInventoryOperations=0)
    finally:
        if root:
            cleanup_result = cleanup(root.parent, run_id)
            result['temporaryCleanup'] = cleanup_result
            if cleanup_result['status'] != 'complete':
                result.update(status='failed', diagnosticCode='temporary_cleanup_failed')
    safe_write_json(args.summary, result)
    print(json.dumps(result, sort_keys=True))
    return 0 if result['status'] == 'probe_passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
