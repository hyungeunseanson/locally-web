"""Deterministic tests of the actual local Cloudflare REST OAuth transport."""
import contextlib
import io
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest
import urllib.error
import urllib.parse
from unittest import mock

import restore_cloudflare_oauth as oauth
import storage_byte_backup as backup
from storage_byte_backup_test import FakeAge, FakeS3, FakeSource
from storage_multi_source_test import provider_entry
from storage_restore_test import DeadlineBody

ACCOUNT = "0" * 32
OLD, NEW = "fixture-old-private-oauth", "fixture-new-private-oauth"
KEY = backup.R2_PREFIX + "fixture/private-original.age"


def http_error(status):
    return urllib.error.HTTPError("https://private.invalid/key", status, OLD, {}, io.BytesIO(OLD.encode()))


class Provider:
    def __init__(self, callback=None): self.calls, self.callback = 0, callback
    def get_token(self):
        self.calls += 1
        if self.callback: self.callback(self.calls)
        return OLD if self.calls == 1 else NEW


class OAuthReads(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.root = pathlib.Path(self.temp.name)
        self.target = self.root / "cipher.age"; self.diag = oauth.OAuthRestoreDiagnostics(self.root / "checkpoint.json")
        self.requests = []

    def tearDown(self): self.temp.cleanup()

    def transport(self, script, provider=None):
        def open_get(request, timeout):
            self.requests.append((request.full_url, request.get_method(), request.get_header("Authorization")))
            self.assertEqual(timeout, 60)
            outcome = script.pop(0)
            if isinstance(outcome, Exception): raise outcome
            return outcome
        self.provider = provider or Provider()
        return oauth.CloudflareOAuthRestoreTransport(ACCOUNT, self.provider, diagnostics=self.diag, opener=open_get)

    def download(self, store, key=KEY):
        with mock.patch.object(oauth.time, "sleep"):
            try: store.download(key, self.target, diagnostics=self.diag)
            except backup.BackupError as error:
                self.diag.failed(error)
                return error

    def test_401_refresh_once_same_get_then_verified_payload(self):
        failed = http_error(401)
        def before_provider(call):
            if call == 2:
                self.assertFalse(self.target.exists()); self.assertTrue(failed.closed)
        store = self.transport([failed, io.BytesIO(b"complete")], Provider(before_provider))
        self.assertIsNone(self.download(store))
        self.assertEqual(self.provider.calls, 2)
        self.assertEqual(self.target.read_bytes(), b"complete")
        self.assertEqual(self.requests[0][:2], self.requests[1][:2])
        self.assertEqual([x[2] for x in self.requests], ["Bearer " + OLD, "Bearer " + NEW])
        self.assertEqual(self.diag.state["oauthRefreshCount"], 1)
        self.assertTrue(self.diag.state["oauthRefreshAttempted"]); self.assertTrue(self.diag.state["oauthRefreshSucceeded"])
        self.assertEqual(self.diag.state["restoreRetryCount"], 0); self.assertEqual(self.diag.state["missing"], 0)

    def test_second_401_stops_without_second_refresh(self):
        store = self.transport([http_error(401), http_error(401)])
        error = self.download(store)
        self.assertEqual(error.code, "restore_access_denied"); self.assertEqual(error.evidence["httpStatus"], 401)
        self.assertFalse(error.evidence["retryable"])
        self.assertEqual((self.provider.calls, len(self.requests), self.diag.state["oauthRefreshCount"]), (2, 2, 1))
        self.assertFalse(self.diag.state["oauthRefreshSucceeded"]); self.assertIsNone(store._bearer)
        self.assertFalse(self.target.exists())

    def test_403_404_do_not_refresh(self):
        for status in (403, 404):
            with self.subTest(status=status):
                self.diag = oauth.OAuthRestoreDiagnostics()
                store = self.transport([http_error(status)])
                failure = self.download(store)
                self.assertEqual(failure.evidence["httpStatus"], status)
                self.assertEqual(self.provider.calls, 1); self.assertEqual(self.diag.state["oauthRefreshCount"], 0)
                self.assertEqual(self.diag.state["missing"], int(status == 404))

    def test_partial_and_body_closed_before_refresh(self):
        failed = http_error(401)
        class Partial(io.BytesIO):
            def read(inner, size):
                if inner.tell(): raise failed
                return super(Partial, inner).read(size)
        body = Partial(b"partial")
        def before_provider(call):
            if call == 2:
                self.assertFalse(self.target.exists()); self.assertTrue(body.closed); self.assertTrue(failed.closed)
        store = self.transport([body, io.BytesIO(b"whole")], Provider(before_provider))
        self.assertIsNone(self.download(store)); self.assertEqual(self.target.read_bytes(), b"whole")

    def test_restore_wide_refresh_ceiling_three(self):
        store = self.transport(sum(([http_error(401), io.BytesIO(b"ok")] for _ in range(3)), []) + [http_error(401)])
        for ordinal in range(3):
            self.assertIsNone(self.download(store, KEY + str(ordinal))); self.target.unlink()
        failure = self.download(store, KEY + "fourth")
        self.assertEqual(failure.code, "restore_oauth_refresh_limit")
        self.assertEqual(self.provider.calls, 4)  # startup plus three renewals
        self.assertEqual(store.refresh_count, 3); self.assertEqual(len(self.requests), 7)

    def test_normal_reads_reuse_one_startup_token(self):
        store = self.transport([io.BytesIO(b"ok") for _ in range(4)])
        for ordinal in range(4):
            self.assertIsNone(self.download(store, KEY + str(ordinal))); self.target.unlink()
        self.assertEqual(self.provider.calls, 1); self.assertEqual(self.diag.state["oauthRefreshCount"], 0)
        self.assertTrue(all(x[1] == "GET" for x in self.requests))

    def test_transient_and_internal_timeout_keep_one_retry(self):
        for failure in (http_error(429), http_error(503), TimeoutError(OLD), DeadlineBody(b"partial")):
            with self.subTest(kind=type(failure).__name__):
                self.diag = oauth.OAuthRestoreDiagnostics(); self.target.unlink(missing_ok=True)
                store = self.transport([failure, io.BytesIO(b"complete")])
                self.assertIsNone(self.download(store)); self.assertEqual(self.diag.state["restoreRetryCount"], 1)
                self.assertEqual(self.provider.calls, 1); self.assertEqual(self.diag.state["oauthRefreshCount"], 0)

    def test_transport_retry_budget_not_reset_by_auth_recovery(self):
        store = self.transport([http_error(503), http_error(401), http_error(503)])
        failure = self.download(store)
        self.assertEqual(failure.code, "restore_provider_5xx")
        self.assertEqual(self.diag.state["restoreRetryCount"], 1)
        self.assertEqual(self.provider.calls, 2); self.assertEqual(len(self.requests), 3)

    def test_provider_failure_after_401_sanitized(self):
        runner = mock.Mock(side_effect=[subprocess.CompletedProcess([], 0, json.dumps({"type": "oauth", "token": OLD})),
                                       subprocess.CompletedProcess([], 1, NEW, OLD)])
        provider = oauth.WranglerOAuthTokenProvider(self.root, runner=runner)
        store = self.transport([http_error(401)], provider)
        output = io.StringIO()
        with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output): error = self.download(store)
        self.assertEqual(error.code, "restore_oauth_provider_failed"); self.assertEqual(runner.call_count, 2)
        self.assertEqual(self.diag.state["oauthRefreshCount"], 1); self.assertFalse(self.target.exists())
        serialized = output.getvalue() + json.dumps(self.diag.summary()) + str(error) + self.diag.path.read_text()
        for private in (OLD, NEW, "Bearer", "Authorization", str(self.root), "https://private.invalid"):
            self.assertNotIn(private, serialized)

    def test_no_non_get_methods_or_wrong_namespace(self):
        store = self.transport([])
        for key, operation in (("outside-prefix", "restore_ciphertext_download"), (KEY, "put_create_only")):
            with self.assertRaises(backup.ValidationError): store.download(key, self.target, operation=operation)
        self.assertEqual(store.operations, 0)
        for method in ("put", "delete", "copy", "head", "list_objects_v2"):
            self.assertFalse(hasattr(store, method))


class TokenProviderTests(unittest.TestCase):
    def test_private_json_oauth_only_and_noninteractive_command(self):
        runner = mock.Mock(return_value=subprocess.CompletedProcess([], 0, json.dumps({"type": "oauth", "token": OLD, "ignored": NEW}), NEW))
        provider = oauth.WranglerOAuthTokenProvider(pathlib.Path("fixture-repository"), runner=runner)
        self.assertEqual(provider.get_token(), OLD)
        args, kwargs = runner.call_args
        self.assertEqual(args[0][1:], ["auth", "token", "--json"])
        self.assertTrue(kwargs["capture_output"]); self.assertEqual(kwargs["stdin"], subprocess.DEVNULL)
        self.assertEqual(kwargs["timeout"], 35); self.assertEqual(kwargs["env"]["CI"], "true")
        self.assertEqual(kwargs["env"]["WRANGLER_WRITE_LOGS"], "false")
        self.assertEqual(kwargs["env"]["WRANGLER_SEND_METRICS"], "false")
        self.assertEqual(kwargs["env"]["WRANGLER_LOG"], "log")
        self.assertEqual(kwargs["env"]["WRANGLER_LOG_SANITIZE"], "true")

    def test_malformed_json_non_oauth_and_empty_token_fail_closed(self):
        for stdout, code in ((OLD, "restore_oauth_provider_invalid_json"),
                             (json.dumps({"type": "api_token", "token": OLD}), "restore_oauth_type_required"),
                             ("[]", "restore_oauth_type_required"),
                             (json.dumps({"type": "oauth", "token": ""}), "restore_oauth_token_invalid")):
            with self.subTest(code=code):
                runner = mock.Mock(return_value=subprocess.CompletedProcess([], 0, stdout, NEW))
                with self.assertRaises(oauth.RestoreOAuthError) as caught:
                    oauth.WranglerOAuthTokenProvider("private-repository", runner=runner).get_token()
                self.assertEqual(caught.exception.code, code)
                self.assertNotIn(OLD, str(caught.exception)); self.assertNotIn(NEW, str(caught.exception))

    def test_subprocess_timeout_is_sanitized(self):
        runner = mock.Mock(side_effect=subprocess.TimeoutExpired(OLD, 35, output=NEW, stderr=OLD))
        with self.assertRaises(oauth.RestoreOAuthError) as caught:
            oauth.WranglerOAuthTokenProvider("private-repository", runner=runner).get_token()
        self.assertEqual(caught.exception.code, "restore_oauth_provider_failed")
        self.assertFalse(caught.exception.evidence["retryable"])
        self.assertNotIn(OLD, str(caught.exception)); self.assertNotIn(NEW, str(caught.exception))

    def test_startup_provider_failure_checkpoint_never_contains_private_output(self):
        with tempfile.TemporaryDirectory() as directory:
            checkpoint = pathlib.Path(directory) / "checkpoint.json"
            diag = oauth.OAuthRestoreDiagnostics(checkpoint)
            runner = mock.Mock(return_value=subprocess.CompletedProcess([], 1, OLD, NEW))
            provider = oauth.WranglerOAuthTokenProvider(directory, runner=runner)
            opener = mock.Mock()
            with self.assertRaises(oauth.RestoreOAuthError):
                oauth.CloudflareOAuthRestoreTransport(ACCOUNT, provider, diagnostics=diag, opener=opener)
            opener.assert_not_called()
            proof = checkpoint.read_text()
            for private in (OLD, NEW, "Authorization", directory): self.assertNotIn(private, proof)
            self.assertEqual(diag.state["status"], "failed"); self.assertEqual(diag.state["oauthRefreshCount"], 0)

    def test_cli_report_preserves_single_missing_count_without_private_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory); output = io.StringIO()
            argv = ["restore_cloudflare_oauth.py", "--account-id", ACCOUNT,
                    "--manifest-key", KEY, "--manifest-checksum-key", KEY + ".sha256",
                    "--identity", str(root / "private-identity"), "--destination", str(root / "plaintext"),
                    "--summary", str(root / "checkpoint.json")]
            def fail_restore(*args, diagnostics):
                error = backup.restore_read_error(http_error(404), "restore_manifest_download")
                diagnostics.failed(error)
                raise error
            with mock.patch.object(sys, "argv", argv), contextlib.redirect_stdout(output), \
                    mock.patch.object(oauth, "CloudflareOAuthRestoreTransport"), \
                    mock.patch.object(oauth, "restore_snapshot", side_effect=fail_restore):
                self.assertEqual(oauth.main(), 1)
            report = json.loads(output.getvalue())
            self.assertEqual(report["missing"], 1); self.assertEqual(report["httpStatus"], 404)
            for private in (OLD, NEW, "Authorization", directory, KEY): self.assertNotIn(private, output.getvalue())


class OAuthFullRestore(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.root = pathlib.Path(self.temp.name)
        items = [provider_entry("r2", backup.R2_SOURCE_BUCKET, "originals/private/source.png", b"first"),
                 provider_entry("supabase", "avatars", "private/second.png", b"second")]
        source = FakeSource(items, {(x["bucket"], x["key"]): body for x, body in zip(items, (b"first", b"second"))})
        plan = backup.make_plan(items, "2026-10-05T00-00-00Z-fixture", "fixture-db", "2026-10-04T23:59:00Z")
        prepared, _ = backup.prepare_plan(plan, source, self.root / "cache")
        self.client = FakeS3(); store = backup.R2Store(self.client, backup.PRIVATE_R2_BUCKET)
        self.summary, _ = backup.apply_plan(prepared, prepared["planDigest"], source, store, FakeAge(), self.root / "cache", self.root / "work")
        self.items = prepared["objects"]; self.destination = self.root / "plaintext"
        self.identity = self.root / "private-offline-identity"; self.identity.write_text("fixture"); self.identity.chmod(0o600)
        self.diag = oauth.OAuthRestoreDiagnostics(self.root / "checkpoint.json"); self.provider = Provider(); self.calls = []

    def tearDown(self): self.temp.cleanup()

    def restore(self, faults=None, age=None):
        faults = faults or {}
        def open_get(request, timeout):
            key = urllib.parse.unquote(request.full_url.split("/objects/", 1)[1]); self.calls.append(key)
            if key in faults and faults[key]:
                failure = faults[key].pop(0)
                if isinstance(failure, Exception): raise failure
                return failure
            return io.BytesIO(self.client.objects[key]["body"])
        store = oauth.CloudflareOAuthRestoreTransport(ACCOUNT, self.provider, diagnostics=self.diag, opener=open_get)
        with mock.patch.object(oauth.time, "sleep"):
            return backup.restore_snapshot(store, self.summary["manifestKey"], self.summary["manifestChecksumKey"],
                                           self.identity, self.destination, age or FakeAge(), diagnostics=self.diag)

    def test_401_then_full_restore_continues_with_all_integrity_checks(self):
        puts = self.client.put_calls; key = self.items[0]["ciphertextKey"]
        result = self.restore({key: [http_error(401)]})
        self.assertEqual((result["objectCount"], result["sourceBytes"]), (2, 11))
        self.assertEqual((result["missing"], result["shaMismatch"], result["collision"]), (0, 0, 0))
        self.assertEqual(self.calls.count(key), 2); self.assertEqual(self.provider.calls, 2)
        self.assertTrue(result["metadataMappingVerified"]); self.assertEqual(self.diag.state["status"], "complete")
        self.assertEqual(self.diag.state["oauthRefreshCount"], 1); self.assertTrue(self.diag.state["oauthRefreshSucceeded"])
        self.assertEqual(self.client.put_calls, puts); self.assertEqual(self.client.delete_calls, 0)
        for private in (OLD, NEW, "Authorization", str(self.identity)):
            self.assertNotIn(private, json.dumps(result) + self.diag.path.read_text())

    def test_repeated_401_checkpoint_and_plaintext_cleanup(self):
        key = self.items[1]["ciphertextKey"]
        with self.assertRaises(backup.RestoreReadError): self.restore({key: [http_error(401), http_error(401)]})
        self.assertFalse(self.destination.exists())
        self.assertEqual((self.diag.state["restoredObjectCount"], self.diag.state["objectOrdinal"]), (1, 2))
        self.assertEqual((self.diag.state["httpStatus"], self.diag.state["oauthRefreshCount"]), (401, 1))
        self.assertEqual(self.provider.calls, 2)

    def test_integrity_and_decrypt_failures_never_refresh(self):
        for failure in ("checksum", "plaintext", "decrypt"):
            with self.subTest(failure=failure):
                self.diag = oauth.OAuthRestoreDiagnostics(); self.provider = Provider()
                key = self.items[0]["ciphertextKey"]; original = self.client.objects[key]["body"]
                age = FakeAge(); faults = None
                if failure == "checksum": faults = {key: [io.BytesIO(b"wrong-cipher")]}
                elif failure == "plaintext":
                    decrypt = age.decrypt
                    def wrong_plain(cipher, identity, output):
                        decrypt(cipher, identity, output)
                        if output.name != "manifest.json": output.write_bytes(b"wrong")
                    age.decrypt = wrong_plain
                else:
                    age.decrypt = mock.Mock(side_effect=backup.ValidationError("fixture decrypt failure"))
                with self.assertRaises(backup.ValidationError): self.restore(faults, age)
                self.assertEqual(self.provider.calls, 1); self.assertEqual(self.diag.state["oauthRefreshCount"], 0)
                self.assertFalse(self.destination.exists()); self.assertEqual(self.client.objects[key]["body"], original)


if __name__ == "__main__": unittest.main()
