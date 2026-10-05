"""Deterministic restore-only failures; no remote credentials or mutations."""
import http.client
import io
import json
import pathlib
import tempfile
import unittest
from unittest import mock

import storage_byte_backup as backup
from storage_byte_backup_test import FakeAge, FakeS3, FakeSource
from storage_multi_source_test import provider_entry

PRIVATE = "originals/private-owner/private-image.png"
SECRET = "sb_secret_restore_do_not_emit"


def error(status=None, name="ClientError"):
    value = type(name, (Exception,), {})(SECRET + PRIVATE + " https://private.invalid/signed?secret=" + SECRET)
    if status:
        value.response = {"ResponseMetadata": {"HTTPStatusCode": status},
                          "Error": {"Code": SECRET, "Message": PRIVATE}}
    return value


class RestoreReads(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.root = pathlib.Path(self.temp.name)
        self.client = FakeS3(); self.store = backup.R2Store(self.client, backup.PRIVATE_R2_BUCKET)
        self.target = self.root / "private-cipher.age"

    def tearDown(self): self.temp.cleanup()

    def download(self, script):
        calls = []
        def get(**params):
            calls.append(params)
            outcome = script.pop(0)
            if isinstance(outcome, Exception): raise outcome
            return {"Body": outcome}
        self.client.get_object = get
        diag = backup.RestoreDiagnostics()
        with mock.patch.object(backup.time, "sleep"):
            try:
                self.store.download(PRIVATE, self.target, diagnostics=diag)
                failure = None
            except backup.RestoreReadError as caught: failure = caught
        return calls, diag, failure

    def test_get_success(self):
        calls, diag, failure = self.download([io.BytesIO(b"ciphertext")])
        self.assertIsNone(failure); self.assertEqual(len(calls), 1)
        self.assertEqual(self.target.read_bytes(), b"ciphertext")
        self.assertEqual(diag.state["restoreRetryCount"], 0)

    def test_transient_get_has_only_one_retry_for_same_exact_key(self):
        failures = [error(429), error(503), error(name="ConnectTimeoutError"), error(name="ReadTimeoutError"),
                    error(name="EndpointConnectionError"), ConnectionResetError(SECRET), http.client.IncompleteRead(b"private")]
        for failure in failures:
            with self.subTest(kind=type(failure).__name__):
                self.target.unlink(missing_ok=True)
                calls, diag, failed = self.download([failure, io.BytesIO(b"complete")])
                self.assertIsNone(failed); self.assertEqual(len(calls), 2); self.assertEqual(calls[0], calls[1])
                self.assertEqual(diag.state["restoreRetryCount"], 1); self.assertEqual(self.target.read_bytes(), b"complete")

    def test_repeated_transient_failure_is_sanitized_and_bounded(self):
        calls, diag, failure = self.download([error(503), error(503)])
        self.assertEqual(len(calls), 2); self.assertEqual(diag.state["restoreRetryCount"], 1)
        self.assertEqual(failure.code, "restore_provider_5xx"); self.assertTrue(failure.evidence["retryable"])
        self.assertEqual(failure.evidence["sdkExceptionClass"], "ClientError")
        self.assertEqual(failure.evidence["providerErrorCode"], "Other")
        self.assertFalse(self.target.exists())
        for private in (SECRET, PRIVATE, "https://", str(self.root)):
            self.assertNotIn(private, json.dumps(failure.evidence) + str(failure))

    def test_auth_missing_and_validation_fail_without_retry(self):
        for status in (401, 403, 404, 400):
            with self.subTest(status=status):
                calls, diag, failure = self.download([error(status)])
                self.assertEqual(len(calls), 1); self.assertFalse(failure.evidence["retryable"])
                self.assertEqual(diag.state["restoreRetryCount"], 0); self.assertFalse(self.target.exists())
                self.assertEqual(failure.evidence["httpStatus"], status)

    def test_partial_ciphertext_removed_before_retry(self):
        class Partial(io.BytesIO):
            def read(self, size):
                if self.tell(): raise error(name="ReadTimeoutError")
                return super().read(size)
        first = Partial(b"partial private bytes"); calls = []
        def get(**params):
            calls.append(params)
            self.assertEqual(self.target.stat().st_size, 0)
            return {"Body": first if len(calls) == 1 else io.BytesIO(b"whole")}
        def before_retry(_): self.assertFalse(self.target.exists())
        self.client.get_object = get
        with mock.patch.object(backup.time, "sleep", side_effect=before_retry):
            self.store.download(PRIVATE, self.target)
        self.assertTrue(first.closed); self.assertEqual(calls[0], calls[1])
        self.assertEqual(self.target.read_bytes(), b"whole")


class RestoreCheckpoints(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.root = pathlib.Path(self.temp.name)
        items = [provider_entry("r2", backup.R2_SOURCE_BUCKET, PRIVATE, b"first"),
                 provider_entry("supabase", "avatars", "private-second.png", b"second")]
        source = FakeSource(items, {(x["bucket"], x["key"]): body for x, body in zip(items, (b"first", b"second"))})
        plan = backup.make_plan(items, "2026-10-05T00-00-00Z-fixture", "fixture-db", "2026-10-04T23:59:00Z")
        prepared, _ = backup.prepare_plan(plan, source, self.root / "cache")
        self.client = FakeS3(); self.store = backup.R2Store(self.client, backup.PRIVATE_R2_BUCKET)
        self.summary, _ = backup.apply_plan(prepared, prepared["planDigest"], source, self.store, FakeAge(), self.root / "cache", self.root / "work")
        self.items = prepared["objects"]; self.checkpoint = self.root / "sanitized-checkpoint.json"
        self.destination = self.root / "plaintext"; self.identity = self.root / "offline-identity"
        self.identity.write_text("fixture"); self.identity.chmod(0o600); self.calls = []
        get = self.client.get_object
        def tracked(**params): self.calls.append(params["Key"]); return get(**params)
        self.client.get_object = tracked

    def tearDown(self): self.temp.cleanup()

    def restore(self, age=None):
        return backup.restore_snapshot(self.store, self.summary["manifestKey"], self.summary["manifestChecksumKey"],
                                       self.identity, self.destination, age or FakeAge(), diagnostics=backup.RestoreDiagnostics(self.checkpoint))

    def test_full_fixture_still_passes_and_never_mutates_remote(self):
        puts = self.client.put_calls; result = self.restore()
        self.assertEqual((result["objectCount"], result["sourceBytes"]), (2, 11))
        self.assertEqual((result["missing"], result["shaMismatch"], result["collision"], result["restoreRetryCount"]), (0, 0, 0, 0))
        self.assertEqual(json.loads(self.checkpoint.read_text())["restoredBytes"], 11)
        self.assertEqual(self.client.put_calls, puts); self.assertEqual(self.client.delete_calls, 0)

    def test_failed_read_checkpoint_survives_plaintext_cleanup(self):
        get = self.client.get_object; key = self.items[1]["ciphertextChecksumKey"]
        def failing(**params):
            if params["Key"] == key: raise error(403)
            return get(**params)
        self.client.get_object = failing
        with self.assertRaises(backup.RestoreReadError) as caught: self.restore()
        result = json.loads(self.checkpoint.read_text())
        self.assertEqual(result, caught.exception.restore_evidence)
        self.assertEqual((result["restoredObjectCount"], result["restoredBytes"], result["remainingObjectCount"]), (1, 5, 1))
        self.assertEqual((result["objectOrdinal"], result["objectCount"]), (2, 2))
        self.assertEqual(result["objectIdentityHash"], self.items[1]["identity"])
        self.assertEqual(result["operation"], "restore_ciphertext_checksum_download")
        self.assertEqual(result["httpStatus"], 403); self.assertEqual(result["restoreRetryCount"], 0)
        self.assertFalse(self.destination.exists())
        for private in (PRIVATE, SECRET, str(self.identity), str(self.root), self.store.bucket, "https://"):
            self.assertNotIn(private, self.checkpoint.read_text())

    def test_404_records_missing_and_fails(self):
        self.client.get_object = mock.Mock(side_effect=error(404))
        with self.assertRaises(backup.RestoreReadError): self.restore()
        result = json.loads(self.checkpoint.read_text())
        self.assertEqual(result["missing"], 1); self.assertEqual(result["restoreRetryCount"], 0)
        self.assertEqual(result["operation"], "restore_manifest_download")
        self.assertEqual(result["snapshotId"], "2026-10-05T00-00-00Z-fixture")
        self.assertEqual(self.client.get_object.call_count, 1)

    def test_full_restore_transient_retry_is_counted(self):
        get = self.client.get_object; key = self.summary["manifestChecksumKey"]; attempts = []
        def transient(**params):
            if params["Key"] == key:
                attempts.append(params["Key"])
                if len(attempts) == 1: raise error(429)
            return get(**params)
        self.client.get_object = transient
        with mock.patch.object(backup.time, "sleep"): result = self.restore()
        self.assertEqual(result["restoreRetryCount"], 1)
        self.assertEqual(json.loads(self.checkpoint.read_text())["restoreRetryCount"], 1)
        self.assertEqual(attempts, [key, key])

    def test_decryption_failure_never_retries(self):
        class CannotDecrypt(FakeAge):
            def decrypt(self, source, identity, destination): raise backup.BackupError(SECRET + str(identity))
        with self.assertRaises(backup.BackupError): self.restore(CannotDecrypt())
        result = json.loads(self.checkpoint.read_text())
        self.assertEqual(result["restoreRetryCount"], 0)
        self.assertEqual(result["operation"], "restore_decrypt")
        self.assertFalse(self.destination.exists())
        self.assertNotIn(SECRET, self.checkpoint.read_text()); self.assertNotIn(str(self.identity), self.checkpoint.read_text())

    def test_checksum_mismatch_never_retries(self):
        key = self.items[0]["ciphertextKey"]; self.client.objects[key]["body"] += b"corrupt"
        with self.assertRaises(backup.ValidationError): self.restore()
        result = json.loads(self.checkpoint.read_text())
        self.assertEqual(result["shaMismatch"], 1); self.assertEqual(result["restoreRetryCount"], 0)
        self.assertEqual(self.calls.count(key), 1); self.assertFalse(self.destination.exists())

    def test_plaintext_sha_mismatch_never_retries(self):
        class Altered(FakeAge):
            def decrypt(self, source, identity, destination):
                super().decrypt(source, identity, destination)
                if destination.name == "private-image.png": destination.write_bytes(b"wrong")
        with self.assertRaises(backup.ValidationError): self.restore(Altered())
        result = json.loads(self.checkpoint.read_text())
        self.assertEqual((result["shaMismatch"], result["restoreRetryCount"]), (1, 0))
        self.assertEqual(result["operation"], "restore_plaintext_validation")
        self.assertEqual(self.calls.count(self.items[0]["ciphertextKey"]), 1)
        self.assertFalse(self.destination.exists())


if __name__ == "__main__": unittest.main()
