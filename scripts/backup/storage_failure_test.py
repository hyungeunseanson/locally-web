"""Deterministic provider failures; no remote credentials or source mutations."""
import contextlib
import copy
import io
import json
import pathlib
import tempfile
import unittest
from unittest import mock

import storage_byte_backup as backup
import run_storage_backup as operator
from storage_byte_backup_test import entry, FakeS3, FakeAge, ScriptedResponse
from storage_multi_source_test import ReadOnlyR2


PRIVATE = 'originals/private-owner/private-image.png'
SECRET = 'sb_secret_do_not_emit_fixture_fragment'


def sdk_error(name):
    return type(name, (Exception,), {})(SECRET + ' https://private.invalid/' + PRIVATE)


def http_error(status, code='fixture'):
    error = RuntimeError(SECRET + PRIVATE)
    error.response = {'Error': {'Code': code, 'Message': SECRET + PRIVATE},
                      'ResponseMetadata': {'HTTPStatusCode': status}}
    return error


class Failures(unittest.TestCase):
    def test_provider_classification_does_not_read_private_messages(self):
        cases = [(sdk_error('ConnectTimeoutError'), 'source_connect_timeout', True),
                 (sdk_error('ReadTimeoutError'), 'source_read_timeout', True),
                 (sdk_error('ConnectionClosedError'), 'source_connection_closed', True),
                 (ConnectionResetError(SECRET), 'source_connection_closed', True),
                 (sdk_error('EndpointConnectionError'), 'source_endpoint_connection', True),
                 (http_error(429), 'source_throttled', True), (http_error(503), 'source_provider_5xx', True),
                 (http_error(403), 'source_access_denied', False),
                 (http_error(400, 'SignatureDoesNotMatch'), 'source_access_denied', False),
                 (http_error(412), 'source_precondition_failed', False),
                 (sdk_error('ParamValidationError'), 'source_provider_validation_failed', False)]
        for error, code, retry in cases:
            with self.subTest(code=code):
                result = backup.provider_read_error(error)
                self.assertEqual(result.code, code)
                self.assertEqual(isinstance(result, backup.SourceTransientError), retry)
                self.assertNotIn(SECRET, str(result)); self.assertNotIn(PRIVATE, str(result))

    def download(self, errors):
        client = ReadOnlyR2(); calls = []
        def get(**params):
            calls.append(params)
            if errors:
                raise errors.pop(0)
            return {'Body': io.BytesIO(client.body), 'ContentType': 'image/png', 'ETag': '"v1"'}
        client.get_object = get
        item = dict(entry(backup.R2_SOURCE_BUCKET, PRIVATE, client.body, 'image/png'), provider='r2', sourceEtag='"v1"')
        diagnostics = backup.BackupDiagnostics()
        source = backup.R2StorageSource(client, diagnostics=diagnostics)
        with tempfile.TemporaryDirectory() as root:
            target = pathlib.Path(root) / 'private.source'
            try:
                result = backup.resume_or_download_source(source, item, target, diagnostics.source_budget)
                return result, calls, diagnostics.summary(), None
            except backup.BackupError as error:
                self.assertFalse(target.exists())
                return None, calls, diagnostics.summary('failed', error.code), error

    def test_r2_timeout_and_5xx_receive_exactly_one_retry(self):
        for error in [sdk_error('ConnectTimeoutError'), sdk_error('ReadTimeoutError'), http_error(503)]:
            proof, calls, summary, failure = self.download([error])
            self.assertIsNone(failure); self.assertEqual(len(calls), 2)
            self.assertEqual(summary['sourceAttempts'], 2); self.assertEqual(summary['sourceRetryCount'], 1)
            self.assertEqual(summary['completedObjectCount'], 1)
            self.assertEqual(proof['sha256'], backup.sha256_bytes(b'actual bytes'))

    def test_repeated_r2_timeout_is_sanitized_without_third_attempt(self):
        _, calls, summary, error = self.download([sdk_error('ReadTimeoutError'), sdk_error('ReadTimeoutError')])
        self.assertEqual(len(calls), 2); self.assertEqual(summary['diagnosticCode'], 'source_read_timeout')
        self.assertEqual(summary['sourceRetryCount'], 1); self.assertEqual(summary['destinationObjectsCreated'], 0)
        self.assertEqual(summary['stage'], 'prepare_r2_download')
        self.assertEqual(summary['provider'], 'r2'); self.assertEqual(summary['operation'], 'get')
        self.assertEqual(len(summary['objectIdentityHash']), 64)
        self.assertNotIn(SECRET, json.dumps(summary)); self.assertNotIn(PRIVATE, json.dumps(summary))
        self.assertTrue(error.__suppress_context__)

    def test_403_precondition_drift_and_validation_never_retry(self):
        for error in [http_error(403), http_error(412), backup.SourceDriftError(SECRET), backup.ValidationError(PRIVATE)]:
            _, calls, summary, failure = self.download([error])
            self.assertIsNotNone(failure); self.assertEqual(len(calls), 1)
            self.assertEqual(summary['sourceRetryCount'], 0)

    def test_r2_partial_read_timeout_removes_cache_and_charges_failed_bytes(self):
        item = dict(entry(backup.R2_SOURCE_BUCKET, PRIVATE, b'actual bytes', 'image/png'), provider='r2', sourceEtag='"v1"')
        client = ReadOnlyR2()
        bodies = [ScriptedResponse(b'part', sdk_error('ReadTimeoutError')), io.BytesIO(b'actual bytes')]
        client.get_object = mock.Mock(side_effect=lambda **_: {'Body': bodies.pop(0), 'ETag': '"v1"', 'ContentType': 'image/png'})
        budget = backup.TransferBudget()
        with tempfile.TemporaryDirectory() as root:
            result = backup.resume_or_download_source(backup.R2StorageSource(client), item, pathlib.Path(root)/'bytes', budget)
        self.assertEqual(result['sha256'], backup.sha256_bytes(b'actual bytes'))
        self.assertEqual((budget.source_attempts, budget.source_retries, budget.source_bytes, budget.source_completed_bytes), (2, 1, 16, 12))

    def test_inventory_403_is_not_retried(self):
        client = ReadOnlyR2(); client.list_objects_v2 = mock.Mock(side_effect=http_error(403))
        with self.assertRaises(backup.BackupError) as failure:
            backup.R2StorageSource(client).inventory({})
        self.assertEqual(failure.exception.code, 'source_access_denied'); self.assertEqual(client.list_objects_v2.call_count, 1)

    def test_inventory_list_and_head_transients_are_bounded_and_stage_is_retained(self):
        for operation in ('list', 'head'):
            client = ReadOnlyR2(); diagnostics = backup.BackupDiagnostics()
            diagnostics.inventory_stage = 'preapply_inventory'
            failing = mock.Mock(side_effect=[sdk_error('ReadTimeoutError'), sdk_error('ReadTimeoutError')])
            setattr(client, 'list_objects_v2' if operation == 'list' else 'head_object', failing)
            refs = {('r2', backup.R2_SOURCE_BUCKET, 'originals/a.png'): []}
            with self.assertRaises(backup.SourceTransientError):
                backup.R2StorageSource(client, diagnostics=diagnostics).inventory(refs)
            self.assertEqual(failing.call_count, 2)
            summary = diagnostics.summary()
            self.assertEqual(summary['stage'], 'preapply_inventory'); self.assertEqual(summary['operation'], operation)
            self.assertEqual(summary['inventoryRetryCount'], 1); self.assertEqual(summary['sourceAttempts'], 0)

    def test_supabase_payload_etag_and_version_are_checked_before_body_read(self):
        source = backup.SupabaseStorageSource('https://uhinvcydgzqlpnvieyal.supabase.co', 'fixture')
        item = entry('images', PRIVATE, b'bytes', 'image/png')
        for headers in [{}, {'ETag': '"different"'}, {'ETag': '"etag-v1"', 'x-version-id': 'different'}]:
            response = ScriptedResponse(b'bytes', b''); response.headers = headers
            with tempfile.TemporaryDirectory() as root, mock.patch.object(source, '_request', return_value=response):
                target = pathlib.Path(root) / 'bytes'
                budget = backup.TransferBudget()
                with self.assertRaises(backup.SourceDriftError): source.download(item, target, budget)
                self.assertFalse(target.exists()); self.assertEqual(budget.source_bytes, 0)
                self.assertTrue(response.closed)

    def test_failure_summary_is_allowlisted_even_for_malicious_error_code(self):
        result = backup.BackupDiagnostics().summary('failed', SECRET + PRIVATE)
        self.assertEqual(result['diagnosticCode'], 'storage_backup_operator_failed')
        self.assertNotIn(SECRET, json.dumps(result))


class OperatorSafety(unittest.TestCase):
    def test_each_failure_preserves_prior_complete_snapshot_and_never_publishes_new_complete(self):
        for failure in ['r2_inventory', 'r2_get', 'supabase_get', 'encryption', 'destination_put', 'destination_verify']:
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as root:
                client = FakeS3(); old = 'daily/storage-v1/previous/storage-manifest.json.age'
                client.objects[old] = {'body': b'previous COMPLETE', 'metadata': {'retention': 'unchanged'}, 'contentType': 'encrypted'}
                prior = copy.deepcopy(client.objects)
                store = backup.R2Store(client, backup.PRIVATE_R2_BUCKET)
                r2 = ReadOnlyR2()
                if failure == 'r2_inventory': r2.list_objects_v2 = mock.Mock(side_effect=sdk_error('ReadTimeoutError'))
                if failure == 'r2_get': r2.get_object = mock.Mock(side_effect=sdk_error('ReadTimeoutError'))
                if failure == 'destination_put': client.fail_after = 0
                if failure == 'destination_verify': store.verify_bytes = mock.Mock(side_effect=backup.BackupError(SECRET))
                def source_factory(args):
                    supa = backup.SupabaseStorageSource(args.project_url, 'fixture', diagnostics=args.diagnostics)
                    item = entry('images', 'private/supabase.png', b'bytes', 'image/png')
                    supa.inventory = lambda: [item]
                    supa.restore_metadata = lambda _: {'httpMetadata': {'ContentType': 'image/png'}, 'customMetadata': {}}
                    response = ScriptedResponse(b'bytes', b''); response.headers = {'ETag': '"etag-v1"', 'Content-Type': 'image/png'}
                    supa._request = mock.Mock(side_effect=backup.BackupError(SECRET + PRIVATE)) if failure == 'supabase_get' else mock.Mock(return_value=response)
                    r2.diagnostics = args.diagnostics
                    return backup.MultiStorageSource(supa, backup.R2StorageSource(r2, diagnostics=args.diagnostics),
                        reference_reader=lambda _: {('r2', backup.R2_SOURCE_BUCKET, 'originals/a.png'): []}, diagnostics=args.diagnostics)
                age = FakeAge()
                if failure == 'encryption': age.encrypt = mock.Mock(side_effect=backup.BackupError(SECRET))
                summary_path = pathlib.Path(root) / 'summary.json'
                stdout = io.StringIO()
                association = {'id': 'verified-database-fixture', 'capturedAt': '2026-10-04T00:00:00Z', 'ciphertextSha256': 'a'*64, 'workflowRunId': '1', 'runAttempt': 1}
                with mock.patch.object(operator, 'source_from_env', side_effect=source_factory), mock.patch.object(operator, 'boto3_store', return_value=store), mock.patch.object(operator, 'nearest_database_backup', return_value=association), mock.patch.object(operator, 'AgeEncryptor', return_value=age), contextlib.redirect_stdout(stdout):
                    self.assertEqual(operator.main(['--apply', '--summary', str(summary_path)]), 1)
                summary = json.loads(summary_path.read_text())
                self.assertEqual(summary['status'], 'failed'); self.assertEqual(summary['sourceWrites'], 0); self.assertEqual(summary['sourceDeletes'], 0)
                self.assertNotIn(SECRET, stdout.getvalue()); self.assertNotIn(PRIVATE, stdout.getvalue())
                self.assertEqual(client.objects[old], prior[old]); self.assertEqual(client.delete_calls, 0); self.assertEqual(client.copy_calls, 0)
                self.assertFalse(any('storage-manifest' in key for key in client.objects if key != old))
                self.assertEqual(summary['destinationObjectsCreated'], len(client.objects)-len(prior))
                if failure in {'r2_inventory', 'r2_get', 'supabase_get', 'encryption'}:
                    self.assertEqual(client.put_calls, 0); self.assertEqual(summary['destinationBytesCreated'], 0)
                expected = {'r2_inventory': ('source_inventory_r2', 'r2', 'list'), 'r2_get': ('prepare_r2_download', 'r2', 'get'),
                    'supabase_get': ('prepare_supabase_download', 'supabase', 'get'), 'encryption': ('encryption', 'r2', 'encrypt'),
                    'destination_put': ('destination_create', 'r2', 'put_create_only'), 'destination_verify': ('destination_byte_verify', 'r2', 'verify_bytes')}
                self.assertEqual(tuple(summary[x] for x in ['stage','provider','operation']), expected[failure])

    def test_workflow_preserves_failure_evidence_and_bounded_timeout(self):
        workflow = (pathlib.Path(__file__).resolve().parents[2] / '.github/workflows/authoritative-storage-backup.yml').read_text()
        artifact = workflow.split('- name: Preserve only sanitized capture evidence')[1]
        self.assertIn('if: always()', artifact)
        self.assertIn('timeout-minutes: 180', workflow)
        self.assertIn("cron: '37 18 * * *'", workflow)
        self.assertEqual((backup.MAX_OBJECTS, backup.MAX_SOURCE_BYTES, backup.MAX_R2_OBJECTS, backup.MAX_R2_BYTES), (5000, 2*1024**3, 12000, 3*1024**3))


if __name__ == '__main__': unittest.main()
