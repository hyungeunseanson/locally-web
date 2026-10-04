import datetime as dt
import hashlib
import io
import json
import os
import pathlib
import shutil
import tempfile
import time
import unittest
from unittest import mock

import storage_byte_backup as backup


class SupabaseApiKeyCompatibilityTests(unittest.TestCase):
    def test_storage_http_uses_modern_apikey_only_and_preserves_legacy_bearer(self):
        for key in ("legacy.service-role.fixture", "sb_secret_phase1_fixture", "sb_publishable_phase1_fixture"):
            with self.subTest(format="modern" if key.startswith("sb_") else "legacy"):
                source = backup.SupabaseStorageSource("https://uhinvcydgzqlpnvieyal.supabase.co", key)
                with mock.patch.object(backup.urllib.request, "urlopen", return_value=io.BytesIO(b"fixture")) as open_request:
                    source._request("GET", "/storage/v1/object/authenticated/fixture/object")
                request = open_request.call_args.args[0]
                self.assertEqual(request.get_header("Apikey"), key)
                self.assertEqual(request.get_header("Authorization"), None if key.startswith("sb_") else "Bearer " + key)
                self.assertEqual(request.get_method(), "GET")

    def test_credential_errors_and_transport_causes_are_sanitized(self):
        key = "sb_secret_phase1_fixture"
        with self.assertRaises(backup.ValidationError) as invalid:
            backup.supabase_api_key_headers(key + "\ninvalid")
        self.assertNotIn(key, str(invalid.exception))
        source = backup.SupabaseStorageSource("https://uhinvcydgzqlpnvieyal.supabase.co", key)
        with mock.patch.object(backup.urllib.request, "urlopen", side_effect=backup.urllib.error.URLError(key)):
            with self.assertRaises(backup.BackupError) as failure:
                source._request("GET", "/storage/v1/object/authenticated/fixture/object")
        self.assertNotIn(key, str(failure.exception))
        self.assertTrue(failure.exception.__suppress_context__)


def entry(bucket, key, body, content_type="application/octet-stream", version="v1"):
    return {
        "bucket": bucket,
        "key": key,
        "identity": backup.source_identity(bucket, key),
        "size": len(body),
        "contentType": content_type,
        "metadata": {"size": len(body), "mimetype": content_type},
        "sourceVersion": version,
        "sourceEtag": '"etag-' + version + '"',
        "sourceUpdatedAt": "2026-09-15T00:00:00Z",
        "sourceSha256": None,
        "cacheFile": None,
        "ciphertextKey": None,
        "ciphertextChecksumKey": None,
        "proof": "metadata-only",
        "reuse": None,
    }


class FakeSource:
    def __init__(self, items, bodies):
        self.items = [dict(item) for item in items]
        self.bodies = dict(bodies)
        self.downloads = 0
        self.mutate_after_download = None

    def inventory(self):
        return [dict(item) for item in self.items]

    def download(self, item, destination, budget):
        self.downloads += 1
        budget.begin_source()
        body = self.bodies[(item["bucket"], item["key"])]
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(body)
        os.chmod(destination, 0o600)
        budget.receive_source(len(body))
        if self.mutate_after_download:
            self.mutate_after_download(self)
            self.mutate_after_download = None
        return {"sha256": hashlib.sha256(body).hexdigest(), "etag": item["sourceEtag"], "contentType": item["contentType"]}


class Precondition(Exception):
    def __init__(self):
        self.response = {"Error": {"Code": "PreconditionFailed"}, "ResponseMetadata": {"HTTPStatusCode": 412}}


class FakeS3:
    def __init__(self):
        self.objects = {}
        self.put_calls = 0
        self.delete_calls = 0
        self.copy_calls = 0
        self.fail_after = None
        self.concurrent = None

    def put_object(self, **kwargs):
        self.put_calls += 1
        if self.fail_after is not None and self.put_calls > self.fail_after:
            raise RuntimeError("credential=secret path/private")
        key = kwargs["Key"]
        body = kwargs["Body"].read()
        if self.concurrent and key == self.concurrent[0] and key not in self.objects:
            self.objects[key] = self.concurrent[1]
        if key in self.objects:
            raise Precondition()
        self.objects[key] = {"body": body, "metadata": dict(kwargs["Metadata"]), "contentType": kwargs["ContentType"]}

    def head_object(self, Bucket, Key):
        item = self.objects[Key]
        return {"ContentLength": len(item["body"]), "Metadata": dict(item["metadata"]), "ContentType": item["contentType"]}

    def get_object(self, Bucket, Key):
        item = self.objects[Key]
        return {"ContentLength": len(item["body"]), "Body": io.BytesIO(item["body"])}


class FakeAge:
    def encrypt(self, source, destination):
        destination.write_bytes(b"AGE" + source.read_bytes())
        os.chmod(destination, 0o600)

    def decrypt(self, source, identity, destination):
        value = source.read_bytes()
        if not value.startswith(b"AGE"):
            raise backup.BackupError("invalid age fixture")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(value[3:])
        os.chmod(destination, 0o600)


class NondeterministicFakeAge(FakeAge):
    serial = 0

    def encrypt(self, source, destination):
        type(self).serial += 1
        destination.write_bytes(b"AGE" + bytes([type(self).serial % 251]) + source.read_bytes())
        os.chmod(destination, 0o600)

    def decrypt(self, source, identity, destination):
        value = source.read_bytes()
        if not value.startswith(b"AGE"):
            raise backup.BackupError("invalid age fixture")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(value[4:])
        os.chmod(destination, 0o600)


class FailingAge(FakeAge):
    def encrypt(self, source, destination):
        raise backup.BackupError("age encryption failed")


class BlockingResponse:
    headers = {"ETag": '"etag-v1"'}

    def read(self, _amount):
        time.sleep(1)
        return b""

    def close(self):
        pass


class ProgressingResponse:
    headers = {"ETag": '"etag-v1"'}

    def __init__(self):
        self.chunks = iter((b"a", b"b", b"c", b""))

    def read(self, _amount):
        chunk = next(self.chunks)
        if chunk:
            time.sleep(0.12)
        return chunk

    def close(self):
        pass


class ScriptedResponse:
    headers = {"ETag": '"etag-v1"'}

    def __init__(self, *reads):
        self.reads = iter(reads)
        self.closed = False

    def read(self, _amount):
        value = next(self.reads)
        if value == "stall":
            time.sleep(1)
        if isinstance(value, Exception):
            raise value
        return value

    def close(self):
        self.closed = True


class SequencedSource(backup.SupabaseStorageSource):
    def __init__(self, items, responses, timeout=0.03):
        super().__init__("https://uhinvcydgzqlpnvieyal.supabase.co", "fixture", timeout=timeout)
        self.items = items
        self.responses = iter(responses)
        self.requests = 0

    def inventory(self):
        return [dict(item) for item in self.items]

    def _request(self, method, path, body=None):
        self.requests += 1
        response = next(self.responses)
        if isinstance(response, Exception):
            raise response
        return response

class ProductionCapacityBudgetTests(unittest.TestCase):
    def plan(self, items):
        return backup.make_plan(items, "capacity-fixture", "db-fixture", "2026-10-04T00:00:00Z", "2026-10-04T00:00:00Z")

    def test_source_plan_accepts_exact_object_and_byte_limits_then_rejects_excess(self):
        items = [entry("images", "capacity-" + str(n), b"") for n in range(backup.MAX_OBJECTS)]
        backup.validate_plan(self.plan(items))
        with self.assertRaises(backup.ValidationError):
            backup.validate_plan(self.plan(items + [entry("images", "one-too-many", b"")]))
        maximum = dict(entry("images", "byte-limit", b""), size=backup.MAX_SOURCE_BYTES)
        backup.validate_plan(self.plan([maximum]))
        with self.assertRaises(backup.ValidationError):
            backup.validate_plan(self.plan([maximum, entry("images", "one-extra-byte", b"x")]))

    def test_source_transfer_rejects_next_attempt_and_byte_with_usage_preserved(self):
        budget = backup.TransferBudget(source_attempts=backup.MAX_OBJECTS - 1)
        budget.begin_source()
        with self.assertRaises(backup.BudgetError):
            budget.begin_source()
        budget.receive_source(backup.MAX_SOURCE_BYTES)
        with self.assertRaises(backup.BudgetError):
            budget.receive_source(1)
        self.assertEqual(budget.as_dict()["source_attempts"], backup.MAX_OBJECTS)
        self.assertEqual(budget.as_dict()["source_bytes"], backup.MAX_SOURCE_BYTES + 1)

    def test_destination_rejects_next_attempt_and_byte_without_mutation(self):
        budget = backup.TransferBudget(r2_attempts=backup.MAX_R2_OBJECTS - 1)
        budget.begin_r2(0)
        with self.assertRaises(backup.BudgetError):
            budget.begin_r2(0)
        byte_budget = backup.TransferBudget(new_r2_bytes=backup.MAX_R2_BYTES - 1)
        byte_budget.begin_r2(1)
        byte_budget.created_r2(1)
        with self.assertRaises(backup.BudgetError):
            byte_budget.begin_r2(1)
        self.assertEqual(byte_budget.as_dict()["new_r2_bytes"], backup.MAX_R2_BYTES)
        self.assertEqual(byte_budget.as_dict()["r2_attempts"], 1)

    def test_destination_can_hold_max_source_ciphertext_checksums_and_manifest(self):
        self.assertGreaterEqual(backup.MAX_R2_OBJECTS, 2 * backup.MAX_OBJECTS + 2)
        # age chunk tags + generous per-file framing + 128 MiB manifest allowance.
        overhead = ((backup.MAX_SOURCE_BYTES + 65535) // 65536) * 16 + backup.MAX_OBJECTS * 4096 + 128 * 1024 * 1024
        self.assertGreaterEqual(backup.MAX_R2_BYTES, backup.MAX_SOURCE_BYTES + overhead)


class StorageByteBackupTests(unittest.TestCase):
    def setUp(self):
        self.root = pathlib.Path(tempfile.mkdtemp())
        self.cache = self.root / "cache"
        self.work = self.root / "work"
        self.items = [
            entry("experiences", "folder/한글.jpg", b"alpha", "image/jpeg"),
            entry("verification-docs", "same-name", b"secret", "application/pdf"),
            entry("images", "empty", b"", "application/octet-stream"),
        ]
        self.source = FakeSource(self.items, {(i["bucket"], i["key"]): body for i, body in zip(self.items, (b"alpha", b"secret", b""))})
        self.plan = backup.make_plan(self.items, "2026-09-15T02-00-00Z-fixture", "34916900214", "2026-09-15T01:21:29Z", "2026-09-15T02:00:00Z")

    def tearDown(self):
        shutil.rmtree(self.root)

    def prepared(self):
        return backup.prepare_plan(self.plan, self.source, self.cache)[0]

    def test_plan_is_read_only_and_binds_unicode_empty_and_same_names(self):
        self.assertEqual(self.plan["summary"], {"objectCount": 3, "sourceBytes": 11})
        self.assertEqual(self.source.downloads, 0)
        backup.validate_plan(self.plan, self.plan["planDigest"])
        changed = json.loads(json.dumps(self.plan))
        changed["objects"][0]["key"] = "other"
        with self.assertRaises(backup.ValidationError):
            backup.validate_plan(changed, self.plan["planDigest"])

    def test_prepare_downloads_once_and_apply_create_only_restore(self):
        prepared = self.prepared()
        self.assertEqual(self.source.downloads, 3)
        client = FakeS3()
        store = backup.R2Store(client, backup.PRIVATE_R2_BUCKET)
        summary, budget = backup.apply_plan(prepared, prepared["planDigest"], self.source, store, FakeAge(), self.cache, self.work)
        self.assertEqual(summary["objectCount"], 3)
        self.assertEqual(budget.new_r2_objects, 8)
        self.assertEqual(client.put_calls, 8)
        self.assertEqual(client.delete_calls, 0)
        self.assertEqual(client.copy_calls, 0)
        identity = self.root / "identity"
        identity.write_text("fixture")
        os.chmod(identity, 0o600)
        restored = self.root / "restored"
        result = backup.restore_snapshot(store, summary["manifestKey"], summary["manifestChecksumKey"], identity, restored, FakeAge())
        self.assertEqual(result["objectCount"], 3)
        self.assertEqual((restored / "experiences/folder/한글.jpg").read_bytes(), b"alpha")
        self.assertEqual((restored / "verification-docs/same-name").read_bytes(), b"secret")
        self.assertEqual((restored / "images/empty").read_bytes(), b"")

    def test_prepare_resumes_only_cache_bound_to_the_exact_plan(self):
        self.cache.mkdir(mode=0o700)
        backup.bind_resume_cache(self.cache, self.plan)
        first = self.plan["objects"][0]
        cached = self.cache / (first["identity"] + ".source")
        cached.write_bytes(b"alpha")
        os.chmod(cached, 0o600)

        prepared, budget = backup.prepare_plan(self.plan, self.source, self.cache)
        self.assertEqual(self.source.downloads, 2)
        self.assertEqual(budget.source_attempts, 2)
        self.assertEqual(budget.source_bytes, 6)
        self.assertEqual(budget.cached_source_objects, 1)
        self.assertEqual(budget.cached_source_bytes, 5)
        self.assertEqual(prepared["summary"]["downloadedObjects"], 3)
        self.assertEqual(prepared["summary"]["downloadedBytes"], 11)
        self.assertEqual(prepared["summary"]["remoteSourceAttempts"], 2)
        self.assertEqual(prepared["summary"]["samePlanCachedObjects"], 1)
        self.assertEqual(prepared["objects"][0]["sourceSha256"], hashlib.sha256(b"alpha").hexdigest())

        other = backup.make_plan(self.items, "other-plan", "34916900214", "2026-09-15T01:21:29Z", "2026-09-15T02:00:00Z")
        with self.assertRaisesRegex(backup.ValidationError, "not bound"):
            backup.prepare_plan(other, self.source, self.cache)

    def test_resume_rejects_unsafe_cache_file_and_binding(self):
        self.cache.mkdir(mode=0o700)
        backup.bind_resume_cache(self.cache, self.plan)
        first = self.plan["objects"][0]
        cached = self.cache / (first["identity"] + ".source")
        cached.write_bytes(b"alpha")
        os.chmod(cached, 0o644)
        with self.assertRaises(backup.ValidationError):
            backup.prepare_plan(self.plan, self.source, self.cache)
        cached.unlink()
        cached.symlink_to(self.root / "missing-source")
        with self.assertRaises(backup.ValidationError):
            backup.prepare_plan(self.plan, self.source, self.cache)
        cached.unlink()
        os.chmod(self.cache / ".plan-digest", 0o644)
        with self.assertRaises(backup.ValidationError):
            backup.prepare_plan(self.plan, self.source, self.cache)
        self.assertEqual(self.source.downloads, 0)

    def test_payload_read_deadline_interrupts_stalled_body_and_removes_partial_file(self):
        source = backup.SupabaseStorageSource("https://uhinvcydgzqlpnvieyal.supabase.co", "fixture", timeout=0.05)
        source._request = lambda *_args, **_kwargs: BlockingResponse()
        target = self.root / "stalled.source"
        budget = backup.TransferBudget()
        with self.assertRaises(backup.SourceTimeoutError):
            source.download(self.items[0], target, budget)
        self.assertFalse(target.exists())
        self.assertEqual(budget.source_attempts, 1)
        self.assertEqual(budget.source_bytes, 0)

    def test_progressing_reads_can_exceed_total_timeout(self):
        source = backup.SupabaseStorageSource("https://uhinvcydgzqlpnvieyal.supabase.co", "fixture", timeout=0.3)
        source._request = lambda *_args, **_kwargs: ProgressingResponse()
        target = self.root / "progressing.source"
        budget = backup.TransferBudget()
        result = source.download(entry("images", "slow", b"abc"), target, budget)
        self.assertEqual(target.read_bytes(), b"abc")
        self.assertEqual(result["sha256"], hashlib.sha256(b"abc").hexdigest())
        self.assertEqual(budget.source_bytes, 3)

    def test_timeout_once_retries_cleanly_and_charges_failed_bytes(self):
        item = entry("images", "private/retry", b"abcd")
        first = ScriptedResponse(b"ab", "stall")
        second = ScriptedResponse(b"abcd", b"")
        source = SequencedSource([item], [first, second])
        target = self.root / "retry.source"
        budget = backup.TransferBudget()
        result = backup.resume_or_download_source(source, item, target, budget)
        self.assertEqual(target.read_bytes(), b"abcd")
        self.assertEqual(result["sha256"], hashlib.sha256(b"abcd").hexdigest())
        self.assertEqual((source.requests, budget.source_attempts, budget.source_retries), (2, 2, 1))
        self.assertEqual((budget.source_completed_downloads, budget.source_bytes), (1, 6))
        self.assertTrue(first.closed and second.closed)

    def test_two_timeouts_propagate_without_third_attempt(self):
        item = entry("images", "private/exhausted", b"abcd")
        source = SequencedSource([item], [ScriptedResponse(b"a", "stall"), ScriptedResponse(b"b", "stall")])
        target = self.root / "exhausted.source"
        budget = backup.TransferBudget()
        with self.assertRaises(backup.SourceTimeoutError) as raised:
            backup.resume_or_download_source(source, item, target, budget)
        self.assertNotIn(item["key"], str(raised.exception))
        self.assertFalse(target.exists())
        self.assertEqual((source.requests, budget.source_attempts, budget.source_retries, budget.source_bytes), (2, 2, 1, 2))

    def test_socket_read_timeout_is_classified_without_private_path(self):
        item = entry("images", "private/secret-name", b"abcd")
        source = SequencedSource([item], [ScriptedResponse(TimeoutError("socket stalled"))])
        target = self.root / "socket-timeout.source"
        budget = backup.TransferBudget()
        with self.assertRaises(backup.SourceTimeoutError) as raised:
            source.download(item, target, budget)
        self.assertNotIn(item["key"], str(raised.exception))
        self.assertNotIn(str(target), str(raised.exception))
        self.assertFalse(target.exists())

    def test_source_drift_and_validation_do_not_retry(self):
        item = entry("images", "private/drift", b"abcd")
        for response, error in ((ScriptedResponse(b"ab", b""), backup.SourceDriftError), (backup.ValidationError("invalid fixture"), backup.ValidationError), (backup.BackupError("HTTP 401"), backup.BackupError)):
            with self.subTest(error=error):
                source = SequencedSource([item], [response])
                target = self.root / "no-retry.source"
                budget = backup.TransferBudget()
                with self.assertRaises(error):
                    backup.resume_or_download_source(source, item, target, budget)
                self.assertEqual((source.requests, budget.source_attempts, budget.source_retries), (1, 1, 0))
                self.assertFalse(target.exists())

    def test_retry_attempt_and_received_byte_ceilings_fail_closed(self):
        item = entry("images", "private/budget", b"abcd")
        attempt_source = SequencedSource([item], [ScriptedResponse(b"a", "stall")])
        attempt_budget = backup.TransferBudget(max_source_objects=1)
        target = self.root / "attempt-budget.source"
        with self.assertRaises(backup.BudgetError):
            backup.resume_or_download_source(attempt_source, item, target, attempt_budget)
        self.assertEqual((attempt_source.requests, attempt_budget.source_attempts, attempt_budget.source_bytes), (1, 1, 1))
        self.assertFalse(target.exists())

        byte_source = SequencedSource([item], [ScriptedResponse(b"ab", "stall"), ScriptedResponse(b"ab", b"cd", b"")])
        byte_budget = backup.TransferBudget(max_source_bytes=3)
        target = self.root / "byte-budget.source"
        with self.assertRaises(backup.BudgetError):
            backup.resume_or_download_source(byte_source, item, target, byte_budget)
        self.assertEqual((byte_source.requests, byte_budget.source_attempts, byte_budget.source_bytes), (2, 2, 4))
        self.assertFalse(target.exists())

    def test_prepared_metrics_keep_logical_objects_separate_from_attempts(self):
        item = entry("images", "private/metrics", b"abcd")
        source = SequencedSource([item], [ScriptedResponse(b"ab", "stall"), ScriptedResponse(b"abcd", b"")])
        plan = backup.make_plan([item], "retry-metrics", "db-fixture", "2026-09-15T01:21:29Z", "2026-09-15T02:00:00Z")
        prepared, budget = backup.prepare_plan(plan, source, self.cache)
        summary = prepared["summary"]
        self.assertEqual(summary["objectCount"], 1)
        self.assertEqual(summary["downloadedObjects"], 1)
        self.assertEqual(summary["downloadedBytes"], 4)
        self.assertEqual((summary["logicalSourceObjects"], summary["logicalSourceBytes"]), (1, 4))
        self.assertEqual(summary["remoteSourceAttempts"], 2)
        self.assertEqual(summary["remoteCompletedDownloads"], 1)
        self.assertEqual(summary["sourceRetryCount"], 1)
        self.assertEqual(summary["cumulativeNetworkBytes"], 6)
        self.assertEqual(summary["samePlanCachedObjects"], 0)
        self.assertEqual(summary["reusedObjects"], 0)
        self.assertEqual(budget.source_bytes, 6)
        backup.validate_plan(prepared, require_prepared=True)

    def test_second_apply_is_exact_skip_without_overwrite(self):
        prepared = self.prepared()
        client = FakeS3()
        store = backup.R2Store(client, backup.PRIVATE_R2_BUCKET)
        backup.apply_plan(prepared, prepared["planDigest"], self.source, store, FakeAge(), self.cache, self.work)
        first_bodies = {k: v["body"] for k, v in client.objects.items()}
        shutil.rmtree(self.work)
        summary, budget = backup.apply_plan(prepared, prepared["planDigest"], self.source, store, FakeAge(), self.cache, self.work)
        self.assertEqual(budget.new_r2_objects, 0)
        self.assertEqual({k: v["body"] for k, v in client.objects.items()}, first_bodies)
        self.assertEqual(summary["status"], "complete")

    def test_concurrent_exact_create_skips_and_conflict_fails(self):
        prepared = self.prepared()
        first = prepared["objects"][0]
        ciphertext = b"AGE" + b"alpha"
        client = FakeS3()
        client.concurrent = (first["ciphertextKey"], {"body": ciphertext, "metadata": {"sha256": hashlib.sha256(ciphertext).hexdigest(), "kind": "source-ciphertext", "schema": "storage-backup-v1", "plan-digest": prepared["planDigest"], "source-identity": first["identity"], "source-sha256": first["sourceSha256"]}, "contentType": "application/octet-stream"})
        backup.apply_plan(prepared, prepared["planDigest"], self.source, backup.R2Store(client, backup.PRIVATE_R2_BUCKET), FakeAge(), self.cache, self.work)
        conflict_client = FakeS3()
        conflict_client.objects[first["ciphertextKey"]] = {"body": b"wrong", "metadata": {"sha256": hashlib.sha256(b"wrong").hexdigest(), "kind": "source-ciphertext"}, "contentType": "application/octet-stream"}
        shutil.rmtree(self.work)
        with self.assertRaises(backup.ConflictError):
            backup.apply_plan(prepared, prepared["planDigest"], self.source, backup.R2Store(conflict_client, backup.PRIVATE_R2_BUCKET), FakeAge(), self.cache, self.work)
        self.assertEqual(conflict_client.objects[first["ciphertextKey"]]["body"], b"wrong")

    def test_source_drift_blocks_first_write(self):
        prepared = self.prepared()
        self.source.items[0]["sourceVersion"] = "v2"
        client = FakeS3()
        with self.assertRaises(backup.SourceDriftError):
            backup.apply_plan(prepared, prepared["planDigest"], self.source, backup.R2Store(client, backup.PRIVATE_R2_BUCKET), FakeAge(), self.cache, self.work)
        self.assertEqual(client.put_calls, 0)

    def test_prepare_detects_source_change_or_deletion_after_download(self):
        def mutate(source):
            source.items.pop()
        self.source.mutate_after_download = mutate
        with self.assertRaises(backup.SourceDriftError):
            backup.prepare_plan(self.plan, self.source, self.cache)

    def test_encryption_failure_creates_no_r2_object(self):
        prepared = self.prepared()
        client = FakeS3()
        with self.assertRaises(backup.BackupError):
            backup.apply_plan(prepared, prepared["planDigest"], self.source, backup.R2Store(client, backup.PRIVATE_R2_BUCKET), FailingAge(), self.cache, self.work)
        self.assertEqual(client.put_calls, 0)

    def test_tampered_cache_digest_and_budget_fail_before_write(self):
        prepared = self.prepared()
        (self.cache / prepared["objects"][0]["cacheFile"]).write_bytes(b"tampered")
        client = FakeS3()
        with self.assertRaises(backup.ValidationError):
            backup.apply_plan(prepared, prepared["planDigest"], self.source, backup.R2Store(client, backup.PRIVATE_R2_BUCKET), FakeAge(), self.cache, self.work)
        self.assertEqual(client.put_calls, 0)
        ledger = backup.TransferBudget(max_source_objects=1, max_source_bytes=2)
        ledger.begin_source()
        ledger.receive_source(2)
        with self.assertRaises(backup.BudgetError):
            ledger.receive_source(1)
        self.assertEqual(ledger.source_bytes, 3)

    def test_partial_failure_preserves_created_objects_and_resume_skips(self):
        prepared = self.prepared()
        client = FakeS3()
        client.fail_after = 2
        with self.assertRaises(backup.BackupError):
            backup.apply_plan(prepared, prepared["planDigest"], self.source, backup.R2Store(client, backup.PRIVATE_R2_BUCKET), FakeAge(), self.cache, self.work)
        self.assertEqual(len(client.objects), 2)
        client.fail_after = None
        shutil.rmtree(self.work)
        result, ledger = backup.apply_plan(prepared, prepared["planDigest"], self.source, backup.R2Store(client, backup.PRIVATE_R2_BUCKET), FakeAge(), self.cache, self.work)
        self.assertEqual(result["status"], "complete")
        self.assertEqual(ledger.new_r2_objects, 6)

    def test_resume_accepts_same_approved_plaintext_when_age_bytes_change(self):
        prepared = self.prepared()
        client = FakeS3()
        client.fail_after = 2
        with self.assertRaises(backup.BackupError):
            backup.apply_plan(prepared, prepared["planDigest"], self.source, backup.R2Store(client, backup.PRIVATE_R2_BUCKET), NondeterministicFakeAge(), self.cache, self.work)
        first_key = prepared["objects"][0]["ciphertextKey"]
        first_bytes = client.objects[first_key]["body"]
        client.fail_after = None
        shutil.rmtree(self.work)
        summary, _ = backup.apply_plan(prepared, prepared["planDigest"], self.source, backup.R2Store(client, backup.PRIVATE_R2_BUCKET), NondeterministicFakeAge(), self.cache, self.work)
        self.assertEqual(summary["status"], "complete")
        self.assertEqual(client.objects[first_key]["body"], first_bytes)

    def test_incremental_unchanged_uses_no_source_get_and_expiry_is_bounded(self):
        prepared = self.prepared()
        client = FakeS3()
        summary, _ = backup.apply_plan(prepared, prepared["planDigest"], self.source, backup.R2Store(client, backup.PRIVATE_R2_BUCKET), FakeAge(), self.cache, self.work)
        manifest_age = client.objects[summary["manifestKey"]]["body"]
        manifest = json.loads(manifest_age[3:])
        new_source = FakeSource(self.items, self.source.bodies)
        fresh_plan = backup.make_plan(self.items, "2026-09-16T02-00-00Z-fixture", "34916900214", "2026-09-15T01:21:29Z", "2026-09-16T02:00:00Z")
        incremental, ledger = backup.prepare_plan(fresh_plan, new_source, self.root / "incremental-cache", manifest, dt.datetime(2026, 9, 16, tzinfo=dt.timezone.utc))
        self.assertEqual(ledger.source_attempts, 0)
        self.assertTrue(all(item["proof"] == "reused-prior-byte-sha256" for item in incremental["objects"]))
        self.assertEqual(incremental["objects"][0]["reuse"]["expiresAt"], prepared["expiresAt"])

    def test_incremental_same_key_with_changed_version_downloads_new_bytes(self):
        prepared = self.prepared()
        client = FakeS3()
        summary, _ = backup.apply_plan(prepared, prepared["planDigest"], self.source, backup.R2Store(client, backup.PRIVATE_R2_BUCKET), FakeAge(), self.cache, self.work)
        manifest = json.loads(client.objects[summary["manifestKey"]]["body"][3:])
        changed_items = [dict(item) for item in self.items]
        changed_items[0]["sourceVersion"] = "v2"
        changed_items[0]["sourceEtag"] = '"etag-v2"'
        changed_items[0]["size"] = 6
        changed_items[0]["metadata"] = {"size": 6, "mimetype": "image/jpeg"}
        changed_bodies = dict(self.source.bodies)
        changed_bodies[("experiences", "folder/한글.jpg")] = b"bravo!"
        changed_source = FakeSource(changed_items, changed_bodies)
        fresh = backup.make_plan(changed_items, "changed", "34916900214", "2026-09-15T01:21:29Z", "2026-09-16T02:00:00Z")
        incremental, ledger = backup.prepare_plan(fresh, changed_source, self.root / "changed-cache", manifest, dt.datetime(2026, 9, 16, tzinfo=dt.timezone.utc))
        self.assertEqual(ledger.source_attempts, 1)
        self.assertEqual(incremental["objects"][0]["proof"], "downloaded-byte-sha256")
        self.assertNotEqual(incremental["objects"][0]["sourceSha256"], manifest["objects"][0]["sourceSha256"])

    def test_download_restore_rejects_ciphertext_tampering(self):
        prepared = self.prepared()
        client = FakeS3()
        store = backup.R2Store(client, backup.PRIVATE_R2_BUCKET)
        summary, _ = backup.apply_plan(prepared, prepared["planDigest"], self.source, store, FakeAge(), self.cache, self.work)
        target = prepared["objects"][0]["ciphertextKey"]
        client.objects[target]["body"] += b"tampered"
        identity = self.root / "identity-tamper"
        identity.write_text("fixture")
        os.chmod(identity, 0o600)
        with self.assertRaises(backup.ValidationError):
            backup.restore_snapshot(store, summary["manifestKey"], summary["manifestChecksumKey"], identity, self.root / "tampered-restore", FakeAge())
        self.assertFalse((self.root / "tampered-restore").exists())

    def test_expired_reference_and_unsafe_restore_are_rejected(self):
        with self.assertRaises(backup.ValidationError):
            backup.previous_by_identity({"schema": backup.MANIFEST_SCHEMA, "status": "complete", "recoverableUntil": "2026-09-15T00:00:00Z", "objects": []}, dt.datetime(2026, 9, 16, tzinfo=dt.timezone.utc))
        with self.assertRaises(backup.ValidationError):
            backup.make_plan([dict(self.items[0], key="../escape", identity=backup.source_identity("experiences", "../escape"))], "unsafe", "db", "2026-09-15T00:00:00Z", "2026-09-15T00:00:00Z")

    def test_apply_rejects_expired_plan_and_reused_ciphertext_before_write(self):
        prepared = self.prepared()
        client = FakeS3()
        store = backup.R2Store(client, backup.PRIVATE_R2_BUCKET)
        after_expiry = dt.datetime(2026, 10, 30, tzinfo=dt.timezone.utc)
        with self.assertRaisesRegex(backup.ValidationError, "plan retention has expired"):
            backup.apply_plan(
                prepared, prepared["planDigest"], self.source, store, FakeAge(),
                self.cache, self.work, now=after_expiry,
            )
        self.assertEqual(client.put_calls, 0)

        prior_client = FakeS3()
        prior_store = backup.R2Store(prior_client, backup.PRIVATE_R2_BUCKET)
        summary, _ = backup.apply_plan(
            prepared, prepared["planDigest"], self.source, prior_store, FakeAge(),
            self.cache, self.work, now=dt.datetime(2026, 9, 16, tzinfo=dt.timezone.utc),
        )
        manifest = json.loads(prior_client.objects[summary["manifestKey"]]["body"][3:])
        fresh = backup.make_plan(
            self.items, "reuse-expiry", "34916900214", "2026-09-15T01:21:29Z",
            "2026-10-19T00:00:00Z",
        )
        incremental, _ = backup.prepare_plan(
            fresh, FakeSource(self.items, self.source.bodies), self.root / "reuse-expiry-cache",
            manifest, dt.datetime(2026, 10, 19, tzinfo=dt.timezone.utc),
        )
        before = prior_client.put_calls
        with self.assertRaisesRegex(backup.ValidationError, "reused ciphertext retention has expired"):
            backup.apply_plan(
                incremental, incremental["planDigest"], FakeSource(self.items, self.source.bodies),
                prior_store, FakeAge(), self.root / "reuse-expiry-cache", self.root / "reuse-expiry-work",
                now=dt.datetime(2026, 10, 21, tzinfo=dt.timezone.utc),
            )
        self.assertEqual(prior_client.put_calls, before)

    def test_failures_do_not_expose_provider_details(self):
        prepared = self.prepared()
        client = FakeS3()
        client.fail_after = 0
        with self.assertRaisesRegex(backup.BackupError, "destination_provider_failed") as caught:
            backup.apply_plan(prepared, prepared["planDigest"], self.source, backup.R2Store(client, backup.PRIVATE_R2_BUCKET), FakeAge(), self.cache, self.work)
        self.assertNotIn("secret", str(caught.exception))
        self.assertNotIn("private", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
