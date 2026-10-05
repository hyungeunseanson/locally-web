"""Destination errors and conditional recovery; no provider access or source writes."""
import contextlib
import io
import json
import pathlib
import tempfile
import unittest
from unittest import mock

import storage_byte_backup as backup
import probe_storage_destination as probe
from storage_byte_backup_test import FakeS3, FakeAge, Precondition

PRIVATE = 'raw/private/key/secret-fragment'


def sdk_error(name='ClientError', status=None, code=None):
    error = type(name, (Exception,), {})(PRIVATE + ' https://secret.invalid')
    error.response = {'ResponseMetadata': {'HTTPStatusCode': status, 'HTTPHeaders': {'private': PRIVATE}},
                      'Error': {'Code': code, 'Message': PRIVATE}, 'Body': PRIVATE}
    return error


class ScriptedS3(FakeS3):
    def __init__(self, actions=()):
        super().__init__()
        self.actions = list(actions)
        self.conditional_calls = []
        self.head_failure = None

    def put_object(self, **kwargs):
        self.conditional_calls.append(kwargs['IfNoneMatch'])
        action = self.actions.pop(0) if self.actions else None
        if isinstance(action, tuple):
            super().put_object(**kwargs)  # Commit then lose the acknowledgement.
            raise action[0]
        if isinstance(action, Exception):
            self.put_calls += 1
            raise action
        return super().put_object(**kwargs)

    def head_object(self, **kwargs):
        if self.head_failure:
            raise self.head_failure
        if kwargs['Key'] not in self.objects:
            raise sdk_error(status=404, code='NotFound')
        return super().head_object(**kwargs)


class DestinationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.temp.name)
        self.path = self.root / PRIVATE.replace('/', '-')
        self.path.write_bytes(b'opaque encrypted fixture')
        self.digest, self.size = backup.sha256_file(self.path)
        self.key = backup.R2_PREFIX + PRIVATE
        self.budget = backup.TransferBudget()
        self.sleep = mock.patch.object(backup.time, 'sleep')
        self.sleep.start()

    def tearDown(self):
        self.sleep.stop()
        self.temp.cleanup()

    def put(self, client, proof=None):
        return backup.R2Store(client, backup.PRIVATE_R2_BUCKET).put_create_only(
            self.key, self.path, self.digest, self.budget, 'fixture', proof)

    def evidence(self, failure):
        result = backup.BackupDiagnostics().summary('failed', failure.code, error=failure)
        encoded = json.dumps(result) + str(failure)
        self.assertNotIn(PRIVATE, encoded)
        self.assertNotIn('secret.invalid', encoded)
        self.assertTrue(failure.__suppress_context__)
        self.assertEqual(result['sourceDeletes'], 0)
        return result

    def test_first_put_success(self):
        client = ScriptedS3()
        self.assertEqual(self.put(client), ('created', self.digest, self.size))
        self.assertEqual((self.budget.r2_attempts, self.budget.new_r2_objects, self.budget.new_r2_bytes), (1, 1, self.size))
        self.assertEqual(client.conditional_calls, ['*'])
        self.assertEqual(client.delete_calls, 0)

    def test_first_put_403_no_retry(self):
        client = ScriptedS3([sdk_error(status=403, code='AccessDenied')])
        with self.assertRaises(backup.DestinationError) as caught:
            self.put(client)
        result = self.evidence(caught.exception)
        self.assertEqual(result['diagnosticCode'], 'destination_access_denied')
        self.assertEqual((result['sdkExceptionClass'], result['httpStatus'], result['providerErrorCode'], result['retryable']), ('ClientError', 403, 'AccessDenied', False))
        self.assertEqual((client.put_calls, self.budget.new_r2_objects), (1, 0))

    def test_429_and_5xx_retry_once_and_remain_conditional(self):
        for status, code in [(429, 'SlowDown'), (503, 'ServiceUnavailable')]:
            with self.subTest(status=status):
                self.budget = backup.TransferBudget()
                client = ScriptedS3([sdk_error(status=status, code=code)])
                self.assertEqual(self.put(client)[0], 'created')
                self.assertEqual(client.conditional_calls, ['*', '*'])
                self.assertEqual((self.budget.r2_attempts, self.budget.r2_retries, self.budget.new_r2_objects), (2, 1, 1))

    def test_retry_exhaustion_never_third_put(self):
        client = ScriptedS3([sdk_error(status=503), sdk_error(status=503)])
        with self.assertRaises(backup.DestinationError) as caught:
            self.put(client)
        self.assertEqual(self.evidence(caught.exception)['diagnosticCode'], 'destination_provider_5xx')
        self.assertEqual(client.conditional_calls, ['*', '*'])
        self.assertEqual(self.budget.new_r2_objects, 0)

    def test_transport_committed_exact_no_retry(self):
        client = ScriptedS3([(sdk_error('ReadTimeoutError'),)])
        self.assertEqual(self.put(client), ('committed-exact-success', self.digest, self.size))
        self.assertEqual((self.budget.r2_attempts, self.budget.r2_retries, self.budget.new_r2_objects), (1, 0, 1))

    def test_transport_missing_one_conditional_retry(self):
        for name in ['ConnectTimeoutError', 'ReadTimeoutError', 'ConnectionClosedError', 'EndpointConnectionError', 'ConnectionResetError']:
            with self.subTest(name=name):
                self.budget = backup.TransferBudget()
                client = ScriptedS3([sdk_error(name)])
                self.assertEqual(self.put(client)[0], 'created')
                self.assertEqual(client.conditional_calls, ['*', '*'])
                self.assertEqual(self.budget.r2_retries, 1)

    def test_412_head_exact_skip(self):
        client = ScriptedS3()
        self.put(client)
        self.assertEqual(self.put(client), ('concurrent-exact-skip', self.digest, self.size))
        self.assertEqual((self.budget.r2_attempts, self.budget.new_r2_objects), (2, 1))
        self.assertEqual(client.conditional_calls, ['*', '*'])

    def test_412_head_404_explicit_failure(self):
        client = ScriptedS3([sdk_error(status=412, code='PreconditionFailed')])
        with self.assertRaises(backup.DestinationError) as caught:
            self.put(client)
        result = self.evidence(caught.exception)
        self.assertEqual((result['diagnosticCode'], result['operation'], result['httpStatus'], result['providerErrorCode'], result['retryable']),
                         ('destination_head_not_found_after_precondition', 'head_after_precondition', 404, 'NotFound', False))
        self.assertEqual(client.put_calls, 1)

    def test_412_head_provider_failure_has_head_diagnostic(self):
        client = ScriptedS3([Precondition()])
        client.head_failure = sdk_error(status=403, code='AccessDenied')
        with self.assertRaises(backup.DestinationError) as caught:
            self.put(client)
        result = self.evidence(caught.exception)
        self.assertEqual((result['diagnosticCode'], result['operation'], result['httpStatus']), ('destination_access_denied', 'head_after_precondition', 403))
        self.assertEqual(client.put_calls, 1)

    def test_409_head_exact_concurrent_skip_and_sanitized_status(self):
        client = ScriptedS3()
        proof = {'source-identity': 'a'*64, 'source-sha256': 'b'*64, 'plan-digest': 'c'*64}
        self.put(client, proof)
        client.actions = [sdk_error(status=409, code=PRIVATE)]
        store = backup.R2Store(client, backup.PRIVATE_R2_BUCKET)
        with mock.patch.object(client, 'head_object', wraps=client.head_object) as head:
            result = store.put_create_only(self.key, self.path, self.digest, self.budget, 'fixture', proof)
        self.assertEqual(result, ('concurrent-exact-skip', self.digest, self.size))
        head.assert_called_once_with(Bucket=backup.PRIVATE_R2_BUCKET, Key=self.key)
        self.assertEqual(store.last_precondition_evidence, dict(sdkExceptionClass='ClientError', httpStatus=409, providerErrorCode='Other', retryable=False))
        self.assertNotIn(PRIVATE, json.dumps(store.last_precondition_evidence))
        self.assertEqual((self.budget.r2_attempts, self.budget.r2_retries, self.budget.new_r2_objects), (2, 0, 1))
        self.assertEqual(client.conditional_calls, ['*', '*'])

    def test_409_head_missing_one_conditional_retry(self):
        client = ScriptedS3([sdk_error(status=409)])
        self.assertEqual(self.put(client), ('created', self.digest, self.size))
        self.assertEqual(client.conditional_calls, ['*', '*'])
        self.assertEqual((self.budget.r2_attempts, self.budget.r2_retries, self.budget.new_r2_objects), (2, 1, 1))
        self.assertEqual(client.delete_calls, 0)

    def test_409_exact_identity_all_metadata_sha_and_size_required(self):
        proof = {'source-identity': 'a'*64, 'source-sha256': 'b'*64, 'plan-digest': 'c'*64, 'cipher-sha256': self.digest}
        changes = [(name, 'mismatch') for name in ['kind', 'schema', *proof, 'sha256']] + [('body', b'different length')]
        for name, value in changes:
            with self.subTest(field=name):
                self.budget = backup.TransferBudget()
                client = ScriptedS3()
                self.put(client, proof)
                if name == 'body':
                    client.objects[self.key]['body'] = value
                else:
                    client.objects[self.key]['metadata'][name] = value
                client.actions = [sdk_error(status=409)]
                with self.assertRaises(backup.DestinationConflictError) as caught:
                    self.put(client, proof)
                result = self.evidence(caught.exception)
                self.assertEqual((result['diagnosticCode'], result['operation'], result['retryable']), ('destination_identity_mismatch', 'head_after_conditional_conflict', False))
                self.assertEqual((client.put_calls, self.budget.r2_retries), (2, 0))

    def test_409_head_auth_and_transport_error_fail_closed(self):
        for error in [sdk_error(status=403, code='AccessDenied'), sdk_error('ReadTimeoutError'), sdk_error(status=503)]:
            with self.subTest(status=error.response['ResponseMetadata']['HTTPStatusCode']):
                self.budget = backup.TransferBudget()
                client = ScriptedS3([sdk_error(status=409)])
                client.head_failure = error
                with self.assertRaises(backup.DestinationError) as caught:
                    self.put(client)
                result = self.evidence(caught.exception)
                self.assertEqual(result['operation'], 'head_after_conditional_conflict')
                self.assertNotEqual(result['diagnosticCode'], 'destination_conditional_conflict')
                self.assertEqual((client.put_calls, self.budget.r2_retries), (1, 0))

    def test_repeated_409_head_missing_explicit_failure_no_third_put(self):
        client = ScriptedS3([sdk_error(status=409, code=PRIVATE), sdk_error(status=409, code=PRIVATE)])
        with self.assertRaises(backup.DestinationError) as caught:
            self.put(client)
        result = self.evidence(caught.exception)
        self.assertEqual((result['diagnosticCode'], result['operation'], result['sdkExceptionClass'], result['httpStatus'], result['providerErrorCode'], result['retryable']),
                         ('destination_conditional_conflict', 'put_create_only', 'ClientError', 409, 'Other', False))
        self.assertEqual((client.put_calls, self.budget.r2_retries, self.budget.new_r2_objects), (2, 1, 0))
        self.assertEqual(client.conditional_calls, ['*', '*'])

    def test_arbitrary_409_not_accepted_without_conditional_put_context(self):
        error = sdk_error(status=409)
        for operation, conditional in [('put_create_only', False), ('destination_head', False), ('verify_bytes', False), ('verify_bytes', True)]:
            with self.subTest(operation=operation, conditional=conditional):
                result = backup.destination_error(error, operation, conditional_create=conditional)
                self.assertEqual(result.code, 'destination_provider_validation_failed')
                self.assertFalse(result.evidence['retryable'])
        client = ScriptedS3()
        self.put(client)
        store = backup.R2Store(client, backup.PRIVATE_R2_BUCKET)
        with mock.patch.object(client, 'get_object', side_effect=error):
            with self.assertRaises(backup.DestinationError) as caught:
                store.verify_bytes(self.key, self.digest, self.size)
        self.assertEqual(self.evidence(caught.exception)['diagnosticCode'], 'destination_provider_validation_failed')
        client.head_failure = error
        with self.assertRaises(backup.DestinationError) as caught:
            store.head(self.key)
        self.assertEqual(self.evidence(caught.exception)['diagnosticCode'], 'destination_provider_validation_failed')
        self.assertEqual(client.put_calls, 1)

    def test_transport_head_error_is_not_blindly_retried(self):
        client = ScriptedS3([sdk_error('ReadTimeoutError')])
        client.head_failure = sdk_error('ConnectTimeoutError')
        with self.assertRaises(backup.DestinationError) as caught:
            self.put(client)
        result = self.evidence(caught.exception)
        self.assertEqual((result['diagnosticCode'], result['operation']), ('destination_connect_timeout', 'head_after_ambiguous_put'))
        self.assertEqual(client.put_calls, 1)

    def test_no_retry_validation_conflict_or_identity_mismatch(self):
        for error in [sdk_error('ParamValidationError'), sdk_error(status=401), sdk_error(status=400, code='BadDigest')]:
            with self.subTest(code=error.response['Error']['Code']):
                client = ScriptedS3([error])
                with self.assertRaises(backup.DestinationError) as caught:
                    self.put(client)
                self.assertFalse(self.evidence(caught.exception)['retryable'])
                self.assertEqual(client.put_calls, 1)
        client = ScriptedS3()
        self.put(client)
        client.objects[self.key]['metadata']['sha256'] = 'a'*64
        client.actions = [sdk_error('ReadTimeoutError')]
        with self.assertRaises(backup.DestinationConflictError):
            self.put(client)
        self.assertEqual(client.put_calls, 2)

    def test_retry_rejects_changed_local_payload_before_second_write(self):
        client = ScriptedS3([sdk_error('ReadTimeoutError')])
        def mutate(_):
            self.path.write_bytes(b'changed')
        with mock.patch.object(backup.time, 'sleep', side_effect=mutate):
            with self.assertRaises(backup.DestinationChecksumError) as caught:
                self.put(client)
        self.assertEqual(self.evidence(caught.exception)['diagnosticCode'], 'destination_checksum_mismatch')
        self.assertEqual(client.put_calls, 1)

    def test_destination_error_keeps_manifest_caller_stage(self):
        diagnostics = backup.BackupDiagnostics()
        diagnostics.at('manifest_publish', 'r2', 'publish_manifest')
        error = backup.destination_error(sdk_error(status=403), 'put_create_only')
        result = diagnostics.summary('failed', error.code, error=error)
        self.assertEqual((result['stage'], result['operation']), ('manifest_publish', 'put_create_only'))

    def test_missing_local_file_failure_sanitized_before_remote_attempt(self):
        self.path.unlink()
        client = ScriptedS3()
        with self.assertRaises(backup.DestinationError) as caught:
            self.put(client)
        result = self.evidence(caught.exception)
        self.assertEqual((result['diagnosticCode'], result['operation'], result['sdkExceptionClass']), ('destination_local_io_failed', 'destination_local_read', 'FileNotFoundError'))
        self.assertEqual((client.put_calls, self.budget.r2_attempts), (0, 0))

    def test_unallowlisted_provider_fields_not_emitted(self):
        client = ScriptedS3([sdk_error(PRIVATE, status=403, code=PRIVATE)])
        with self.assertRaises(backup.DestinationError) as caught:
            self.put(client)
        result = self.evidence(caught.exception)
        self.assertEqual((result['sdkExceptionClass'], result['providerErrorCode']), ('Other', 'Other'))

    def test_verify_get_error_and_checksum_are_classified_without_retry(self):
        client = ScriptedS3()
        self.put(client)
        store = backup.R2Store(client, backup.PRIVATE_R2_BUCKET)
        for error in [sdk_error(status=403), sdk_error('ReadTimeoutError')]:
            with mock.patch.object(client, 'get_object', side_effect=error):
                with self.assertRaises(backup.DestinationError) as caught:
                    store.verify_bytes(self.key, self.digest, self.size)
                result = self.evidence(caught.exception)
                self.assertEqual((result['stage'], result['operation']), ('destination_byte_verify', 'verify_bytes'))
        client.objects[self.key]['body'] = b'corrupt'
        with self.assertRaises(backup.DestinationChecksumError) as caught:
            store.verify_bytes(self.key, self.digest, self.size)
        self.assertEqual(self.evidence(caught.exception)['diagnosticCode'], 'destination_checksum_mismatch')

    def test_verify_streaming_read_failure_is_classified(self):
        store = backup.R2Store(ScriptedS3(), backup.PRIVATE_R2_BUCKET)
        stream = mock.Mock()
        stream.read.side_effect = sdk_error('ConnectionClosedError')
        with mock.patch.object(store.client, 'get_object', return_value={'Body': stream}):
            with self.assertRaises(backup.DestinationError) as caught:
                store.verify_bytes(self.key, self.digest, self.size)
        self.assertEqual(self.evidence(caught.exception)['diagnosticCode'], 'destination_connection_closed')
        stream.close.assert_called_once()

    def test_ceilings_unchanged_and_retry_budget_enforced(self):
        self.assertEqual((backup.MAX_OBJECTS, backup.MAX_SOURCE_BYTES, backup.MAX_R2_OBJECTS, backup.MAX_R2_BYTES), (5000, 2*1024**3, 12000, 3*1024**3))
        self.budget.max_new_r2_objects = 1
        client = ScriptedS3([sdk_error(status=503)])
        with self.assertRaises(backup.BudgetError):
            self.put(client)
        self.assertEqual((client.put_calls, self.budget.r2_attempts, self.budget.r2_retries), (1, 1, 0))
        self.budget = backup.TransferBudget(max_new_r2_bytes=self.size-1)
        client = ScriptedS3()
        with self.assertRaises(backup.BudgetError):
            self.put(client)
        self.assertEqual(client.put_calls, 0)


class ProbeTests(unittest.TestCase):
    def test_tiny_probe_put_head_get_second_412_only_one_remote_object(self):
        with tempfile.TemporaryDirectory() as root:
            client, diagnostics = ScriptedS3(), backup.BackupDiagnostics()
            result = probe.run_probe(backup.R2Store(client, backup.PRIVATE_R2_BUCKET), FakeAge(), pathlib.Path(root), diagnostics, '123', '1')
            self.assertEqual((result['firstPut'], result['secondPut'], result['secondPutHttpStatus']), ('created', 'concurrent-exact-skip', 412))
            self.assertEqual(len(client.objects), 1)
            self.assertEqual(list(client.objects), ['daily/storage-v1/diagnostics/123-1/opaque.age'])
            self.assertEqual(client.conditional_calls, ['*', '*'])
            self.assertEqual((client.delete_calls, client.copy_calls, diagnostics.source_budget.source_attempts), (0, 0, 0))
            self.assertTrue(result['ciphertextShaVerified'])
            self.assertFalse(result['completeBackupManifestPublished'])
            self.assertLessEqual(result['ciphertextBytes'], probe.MAX_PROBE_CIPHERTEXT_BYTES)
            self.assertNotIn('opaque.age', json.dumps(result))

    def test_tiny_probe_accepts_actual_409_after_exact_head_and_sha(self):
        with tempfile.TemporaryDirectory() as root:
            client, diagnostics = ScriptedS3([None, sdk_error(status=409, code=PRIVATE)]), backup.BackupDiagnostics()
            result = probe.run_probe(backup.R2Store(client, backup.PRIVATE_R2_BUCKET), FakeAge(), pathlib.Path(root), diagnostics, '123', '1')
            self.assertEqual((result['firstPut'], result['secondPut'], result['secondPutHttpStatus']), ('created', 'concurrent-exact-skip', 409))
            self.assertTrue(result['secondPutConflict'])
            self.assertTrue(result['postConflictHeadExact'])
            self.assertTrue(result['headExact'])
            self.assertTrue(result['ciphertextShaVerified'])
            self.assertEqual((result['secondPutSdkExceptionClass'], result['secondPutProviderErrorCode']), ('ClientError', 'Other'))
            self.assertEqual((client.put_calls, diagnostics.destination_budget.r2_retries, len(client.objects)), (2, 0, 1))
            self.assertEqual((result['sourceInventoryOperations'], result['remoteDeletes']), (0, 0))
            self.assertFalse(result['completeBackupManifestPublished'])
            self.assertNotIn(PRIVATE, json.dumps(result))

    def test_probe_requires_first_created_not_recovered_commit(self):
        with tempfile.TemporaryDirectory() as root:
            client = ScriptedS3([(sdk_error('ReadTimeoutError'),)])
            with self.assertRaises(backup.DestinationError):
                probe.run_probe(backup.R2Store(client, backup.PRIVATE_R2_BUCKET), FakeAge(), pathlib.Path(root), backup.BackupDiagnostics(), '123', '1')
            self.assertEqual(client.put_calls, 1)

    def test_probe_invalid_scope_fails_before_any_upload(self):
        for run, attempt in [('private/key', '1'), ('123', '0'), ('123', '1/private'), ('1'*21, '1')]:
            with tempfile.TemporaryDirectory() as root:
                client = ScriptedS3()
                with self.assertRaises(backup.ValidationError):
                    probe.run_probe(backup.R2Store(client, backup.PRIVATE_R2_BUCKET), FakeAge(), pathlib.Path(root), backup.BackupDiagnostics(), run, attempt)
                self.assertEqual(client.put_calls, 0)

    def test_probe_tiny_bound_before_remote_write(self):
        class TooLarge:
            def encrypt(self, source, destination):
                destination.write_bytes(b'x' * (probe.MAX_PROBE_CIPHERTEXT_BYTES+1))
        with tempfile.TemporaryDirectory() as root:
            client = ScriptedS3()
            with self.assertRaises(backup.ValidationError):
                probe.run_probe(backup.R2Store(client, backup.PRIVATE_R2_BUCKET), TooLarge(), pathlib.Path(root), backup.BackupDiagnostics(), '123', '1')
            self.assertEqual(client.put_calls, 0)

    def test_probe_main_sanitized_failure_and_local_cleanup(self):
        with tempfile.TemporaryDirectory() as root:
            summary = pathlib.Path(root) / 'summary.json'
            env = dict(GITHUB_EVENT_NAME='workflow_dispatch', GITHUB_REF='refs/heads/main', GITHUB_RUN_ID='123', GITHUB_RUN_ATTEMPT='1', RUNNER_TEMP=root, R2_BUCKET=backup.PRIVATE_R2_BUCKET, R2_ENDPOINT='https://'+'a'*32+'.r2.cloudflarestorage.com')
            client = ScriptedS3([sdk_error(status=403)])
            with mock.patch.dict(probe.os.environ, env, clear=True), mock.patch.object(probe, 'AgeEncryptor', return_value=FakeAge()), mock.patch.object(probe, 'boto3_store', return_value=backup.R2Store(client, backup.PRIVATE_R2_BUCKET)), contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(probe.main(['--summary', str(summary)]), 1)
            result = json.loads(summary.read_text())
            self.assertEqual(result['diagnosticCode'], 'destination_access_denied')
            self.assertEqual(result['temporaryCleanup']['status'], 'complete')
            self.assertEqual(list(pathlib.Path(root).iterdir()), [summary])
            self.assertNotIn(PRIVATE, output.getvalue())

    def test_probe_main_success_and_cleanup_failure_are_distinct(self):
        for cleanup_fails in (False, True):
            with tempfile.TemporaryDirectory() as root:
                summary = pathlib.Path(root) / 'summary.json'
                env = dict(GITHUB_EVENT_NAME='workflow_dispatch', GITHUB_REF='refs/heads/main', GITHUB_RUN_ID='123', GITHUB_RUN_ATTEMPT='1', RUNNER_TEMP=root, R2_BUCKET=backup.PRIVATE_R2_BUCKET, R2_ENDPOINT='https://'+'a'*32+'.r2.cloudflarestorage.com')
                client = ScriptedS3()
                with mock.patch.dict(probe.os.environ, env, clear=True), mock.patch.object(probe, 'AgeEncryptor', return_value=FakeAge()), mock.patch.object(probe, 'boto3_store', return_value=backup.R2Store(client, backup.PRIVATE_R2_BUCKET)), contextlib.redirect_stdout(io.StringIO()):
                    if cleanup_fails:
                        with mock.patch.object(probe, 'cleanup', return_value=dict(status='failed', diagnosticCode='temporary_cleanup_failed')):
                            code = probe.main(['--summary', str(summary)])
                    else:
                        code = probe.main(['--summary', str(summary)])
                result = json.loads(summary.read_text())
                self.assertEqual(code, 1 if cleanup_fails else 0)
                self.assertEqual(result['status'], 'failed' if cleanup_fails else 'probe_passed')
                self.assertEqual(client.delete_calls, 0)
                if not cleanup_fails:
                    self.assertEqual(list(pathlib.Path(root).iterdir()), [summary])

    def test_manual_workflow_destination_credentials_only_and_shared_lock(self):
        base = pathlib.Path(__file__).resolve().parents[2]
        workflow = (base / '.github/workflows/storage-destination-probe.yml').read_text()
        self.assertIn('workflow_dispatch:', workflow)
        self.assertNotIn('schedule:', workflow)
        self.assertIn('group: production-authoritative-storage-byte-backup', workflow)
        for banned in ['SUPABASE_SERVICE_ROLE_KEY', 'R2_SOURCE_', 'source_from_env', 'run_storage_backup.py', 'AGE_IDENTITY']:
            self.assertNotIn(banned, workflow)
        self.assertIn('secrets.R2_ACCESS_KEY_ID', workflow)
        self.assertIn('secrets.R2_SECRET_ACCESS_KEY', workflow)
        self.assertIn('timeout-minutes: 10', workflow)


if __name__ == '__main__':
    unittest.main()
