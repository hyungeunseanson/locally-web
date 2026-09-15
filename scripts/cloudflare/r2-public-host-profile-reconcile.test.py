import importlib.util
import io
import sys
import tempfile
import types
import unittest
import urllib.error
from pathlib import Path
from types import SimpleNamespace
from unittest import mock


sys.modules.setdefault("boto3", types.SimpleNamespace(client=lambda *args, **kwargs: None))
botocore = types.ModuleType("botocore")
botocore_config = types.ModuleType("botocore.config")
botocore_config.Config = object
botocore_exceptions = types.ModuleType("botocore.exceptions")
class FakeClientError(RuntimeError):
    def __init__(self, code="PreconditionFailed", status=412):
        super().__init__(code)
        self.response = {"Error": {"Code": code}, "ResponseMetadata": {"HTTPStatusCode": status}}


botocore_exceptions.ClientError = FakeClientError
sys.modules.setdefault("botocore", botocore)
sys.modules.setdefault("botocore.config", botocore_config)
sys.modules.setdefault("botocore.exceptions", botocore_exceptions)

MODULE_PATH = Path(__file__).with_name("r2-public-host-profile-reconcile.py")
SPEC = importlib.util.spec_from_file_location("profile_r2", MODULE_PATH)
profile_r2 = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(profile_r2)


class PublicResponse:
    def __init__(self, status=200, content_type="image/webp", content_length="123"):
        self.status = status
        self.headers = {
            "Content-Type": content_type,
            "Content-Length": content_length,
        }

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


def public_http_error(status):
    return urllib.error.HTTPError("https://profiles.example/object", status, "error", {}, None)


class PublicVerificationTests(unittest.TestCase):
    def test_uses_explicit_reconciliation_user_agent(self):
        captured = []

        def open_request(request, timeout):
            captured.append((request, timeout))
            return PublicResponse()

        with mock.patch.object(profile_r2.urllib.request, "urlopen", side_effect=open_request):
            profile_r2.verify_public_object("hosts/host/avatar.webp", 123)

        self.assertEqual(len(captured), 1)
        request, timeout = captured[0]
        self.assertEqual(request.get_method(), "HEAD")
        self.assertEqual(request.get_header("User-agent"), "Locally-R2-Reconciliation/1.0")
        self.assertEqual(timeout, 30)

    def test_retries_only_transient_http_statuses(self):
        for status in (403, 404, 429, 500, 503, 599):
            with self.subTest(status=status), mock.patch.object(
                profile_r2.urllib.request,
                "urlopen",
                side_effect=[public_http_error(status), PublicResponse()],
            ) as urlopen, mock.patch.object(profile_r2.time, "sleep") as sleep:
                profile_r2.verify_public_object("hosts/host/avatar.webp", 123)
                self.assertEqual(urlopen.call_count, 2)
                sleep.assert_called_once_with(profile_r2.PUBLIC_RETRY_DELAYS[0])

    def test_non_transient_http_status_fails_immediately(self):
        with mock.patch.object(
            profile_r2.urllib.request,
            "urlopen",
            side_effect=public_http_error(401),
        ) as urlopen, mock.patch.object(profile_r2.time, "sleep") as sleep:
            with self.assertRaisesRegex(RuntimeError, "HTTP 401"):
                profile_r2.verify_public_object("hosts/host/avatar.webp", 123)
            self.assertEqual(urlopen.call_count, 1)
            sleep.assert_not_called()

    def test_content_type_mismatch_fails_immediately(self):
        with mock.patch.object(
            profile_r2.urllib.request,
            "urlopen",
            return_value=PublicResponse(content_type="text/html"),
        ) as urlopen, mock.patch.object(profile_r2.time, "sleep") as sleep:
            with self.assertRaisesRegex(RuntimeError, "unexpected content type"):
                profile_r2.verify_public_object("hosts/host/avatar.webp", 123)
            self.assertEqual(urlopen.call_count, 1)
            sleep.assert_not_called()

    def test_content_length_mismatch_fails_immediately(self):
        with mock.patch.object(
            profile_r2.urllib.request,
            "urlopen",
            return_value=PublicResponse(content_length="122"),
        ) as urlopen, mock.patch.object(profile_r2.time, "sleep") as sleep:
            with self.assertRaisesRegex(RuntimeError, "content length mismatch"):
                profile_r2.verify_public_object("hosts/host/avatar.webp", 123)
            self.assertEqual(urlopen.call_count, 1)
            sleep.assert_not_called()

    def test_retry_limit_is_bounded(self):
        with mock.patch.object(profile_r2, "PUBLIC_RETRY_DELAYS", (0, 0)), mock.patch.object(
            profile_r2.urllib.request,
            "urlopen",
            side_effect=public_http_error(403),
        ) as urlopen, mock.patch.object(profile_r2.time, "sleep") as sleep:
            with self.assertRaisesRegex(RuntimeError, "HTTP 403"):
                profile_r2.verify_public_object("hosts/host/avatar.webp", 123)
            self.assertEqual(urlopen.call_count, 3)
            self.assertEqual(sleep.call_count, 2)

    def test_production_retry_window_is_five_minutes(self):
        self.assertEqual(sum(profile_r2.PUBLIC_RETRY_DELAYS), 300)


class FakePaginator:
    def __init__(self, client):
        self.client = client

    def paginate(self, Bucket, Prefix):
        keys = sorted(key for key in self.client.buckets.get(Bucket, {}) if key.startswith(Prefix))
        return [{"Contents": [{"Key": key} for key in keys]}] if keys else [{}]


class FakeClient:
    def __init__(self, buckets):
        self.buckets = buckets
        self.put_calls = []
        self.delete_calls = 0
        self.on_put = None

    def get_paginator(self, name):
        if name != "list_objects_v2":
            raise AssertionError(name)
        return FakePaginator(self)

    def head_object(self, Bucket, Key):
        item = self.buckets[Bucket][Key]
        return {
            "ContentLength": len(item["body"]),
            "ContentType": item.get("content_type", "application/octet-stream"),
            "Metadata": item.get("metadata", {}),
            "CacheControl": item.get("cache_control", ""),
        }

    def get_object(self, Bucket, Key):
        return {"Body": io.BytesIO(self.buckets[Bucket][Key]["body"])}

    def download_file(self, Bucket, Key, Filename):
        Path(Filename).write_bytes(self.buckets[Bucket][Key]["body"])

    def upload_file(self, Filename, Bucket, Key, ExtraArgs):
        self.buckets.setdefault(Bucket, {})[Key] = {
            "body": Path(Filename).read_bytes(),
            "content_type": ExtraArgs["ContentType"],
            "metadata": ExtraArgs.get("Metadata", {}),
        }

    def put_object(self, **kwargs):
        self.put_calls.append(kwargs)
        if self.on_put:
            self.on_put(kwargs)
        bucket = kwargs["Bucket"]
        key = kwargs["Key"]
        if kwargs.get("IfNoneMatch") != "*":
            raise AssertionError("conditional create required")
        if key in self.buckets.setdefault(bucket, {}):
            raise FakeClientError()
        body = kwargs["Body"].read()
        self.buckets[bucket][key] = {
            "body": body,
            "content_type": kwargs.get("ContentType"),
            "cache_control": kwargs.get("CacheControl", ""),
            "metadata": kwargs.get("Metadata", {}),
        }

    def delete_objects(self, Bucket, Delete):
        self.delete_calls += len(Delete["Objects"])
        for item in Delete["Objects"]:
            self.buckets.get(Bucket, {}).pop(item["Key"], None)


class CreateOnlyApplyTests(unittest.TestCase):
    HOST = "11111111-1111-4111-8111-111111111111"
    KEY = f"hosts/{HOST}/0123456789ab/avatar-w128-q80.webp"

    def setUp(self):
        self.directory = Path(tempfile.mkdtemp())
        self.body = b"RIFF-fake-webp"
        self.source = self.directory / "objects" / "avatar.webp"
        self.source.parent.mkdir()
        self.source.write_bytes(self.body)
        self.origin = "https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/avatars/user/avatar.jpg"
        self.item = {
            "hostId": self.HOST,
            "key": self.KEY,
            "path": "objects/avatar.webp",
            "bytes": len(self.body),
            "sha256": profile_r2.hashlib.sha256(self.body).hexdigest(),
            "sourceIdentityHash": profile_r2.hashlib.sha256(self.origin.encode()).hexdigest(),
            "sourceSha256": "2" * 64,
            "sourceBytes": 321,
            "sourceKind": "public-profile-avatar",
            "width": 128,
            "quality": 80,
        }
        self.expected = [{
            "hostId": self.HOST,
            "originUrl": self.origin,
            "sourceKind": "public-profile-avatar",
            "key": self.KEY,
            "width": 128,
            "quality": 80,
        }]
        self.buckets = {profile_r2.ACTIVE_BUCKET: {}, profile_r2.STALE_BUCKET: {}}
        self.active = FakeClient(self.buckets)
        self.stale = FakeClient(self.buckets)

    def make_plan(self):
        output = self.directory / "r2-plan.json"
        profile_r2.plan_mode(SimpleNamespace(output=str(output), snapshot_hash="a" * 64, create_only_plan=True), self.active, self.stale, self.expected)
        return profile_r2.json.loads(output.read_text())

    def apply(self, plan):
        args = SimpleNamespace(plan=str(self.directory / "objects.json"), confirm_digest=plan["planDigest"])
        output = self.directory / "result.json"
        args.output = str(output)
        with mock.patch.object(profile_r2, "verify_public_object"):
            profile_r2.apply_mode(args, self.active, self.stale, [self.item], self.expected, plan, create_only=True)
        return profile_r2.json.loads(output.read_text())

    def test_conditional_create_success_and_second_run_is_exact_without_overwrite(self):
        result = self.apply(self.make_plan())
        self.assertEqual(result["uploadedObjectCount"], 1)
        self.assertEqual(result["deletedObjectCount"], 0)
        self.assertEqual(self.active.put_calls[0]["IfNoneMatch"], "*")
        self.assertEqual(self.active.delete_calls, 0)

        # A fresh plan sees the object as existing and schedules no transformed write.
        second = self.make_plan()
        self.assertEqual(second["missingObjectCount"], 0)

    def test_concurrent_exact_writer_is_verified_and_preserved(self):
        plan = self.make_plan()
        expected_metadata = profile_r2.derivative_metadata(self.item)
        def race(_kwargs):
            self.active.on_put = None
            self.buckets[profile_r2.ACTIVE_BUCKET][self.KEY] = {
                "body": self.body,
                "content_type": "image/webp",
                "cache_control": profile_r2.IMMUTABLE_CACHE_CONTROL,
                "metadata": {**expected_metadata, "producer": "queue"},
            }
        self.active.on_put = race
        result = self.apply(plan)
        self.assertEqual(result["uploadedObjectCount"], 0)
        self.assertEqual(result["concurrentExactSkipCount"], 1)
        self.assertEqual(self.buckets[profile_r2.ACTIVE_BUCKET][self.KEY]["metadata"]["producer"], "queue")

    def test_concurrent_conflict_fails_closed_without_delete_or_retry_put(self):
        plan = self.make_plan()
        def race(_kwargs):
            self.active.on_put = None
            self.buckets[profile_r2.ACTIVE_BUCKET][self.KEY] = {
                "body": b"different",
                "content_type": "image/webp",
                "cache_control": profile_r2.IMMUTABLE_CACHE_CONTROL,
                "metadata": {"sha256": "0" * 64},
            }
        self.active.on_put = race
        with mock.patch.object(profile_r2, "verify_public_object"):
            with self.assertRaisesRegex(RuntimeError, "byte conflict"):
                self.apply(plan)
        self.assertEqual(len(self.active.put_calls), 1)
        self.assertEqual(self.active.delete_calls, 0)

    def test_concurrent_header_or_provenance_conflict_is_not_legacy_skipped(self):
        for mutation in ("content_type", "cache_control", "source-sha256"):
            with self.subTest(mutation=mutation):
                self.setUp()
                plan = self.make_plan()
                metadata = profile_r2.derivative_metadata(self.item)
                if mutation == "source-sha256":
                    metadata[mutation] = "f" * 64
                def race(_kwargs, metadata=metadata, mutation=mutation):
                    self.active.on_put = None
                    self.buckets[profile_r2.ACTIVE_BUCKET][self.KEY] = {
                        "body": self.body,
                        "content_type": "text/html" if mutation == "content_type" else "image/webp",
                        "cache_control": "max-age=0" if mutation == "cache_control" else profile_r2.IMMUTABLE_CACHE_CONTROL,
                        "metadata": metadata,
                    }
                self.active.on_put = race
                with mock.patch.object(profile_r2, "verify_public_object"):
                    with self.assertRaisesRegex(RuntimeError, "conflict"):
                        self.apply(plan)
                self.assertEqual(len(self.active.put_calls), 1)
                self.assertEqual(self.active.delete_calls, 0)

    def test_r2_state_or_source_provenance_drift_refuses_before_write(self):
        plan = self.make_plan()
        self.buckets[profile_r2.ACTIVE_BUCKET][
            f"hosts/{self.HOST}/ffffffffffff/avatar-w256-q80.webp"
        ] = {"body": b"other", "content_type": "image/webp"}
        with self.assertRaisesRegex(RuntimeError, "inventory changed"):
            self.apply(plan)
        self.assertEqual(len(self.active.put_calls), 0)

        self.buckets[profile_r2.ACTIVE_BUCKET].clear()
        plan = self.make_plan()
        self.item["sourceSha256"] = "invalid"
        with self.assertRaisesRegex(RuntimeError, "provenance"):
            self.apply(plan)
        self.assertEqual(len(self.active.put_calls), 0)

    def test_tampered_digest_or_metadata_conflict_refuses_before_write(self):
        plan = self.make_plan()
        plan["executionPayload"]["missingKeys"] = []
        with self.assertRaisesRegex(RuntimeError, "modified"):
            self.apply(plan)
        self.assertEqual(len(self.active.put_calls), 0)


class PurgeTests(unittest.TestCase):
    HOST = "11111111-1111-1111-1111-111111111111"
    OTHER_HOST = "22222222-2222-2222-2222-222222222222"

    def setUp(self):
        self.buckets = {
            profile_r2.ACTIVE_BUCKET: {
                f"hosts/{self.HOST}/current/avatar-w128-q80.webp": {"body": b"active", "content_type": "image/webp"},
                f"hosts/{self.HOST}/legacy/unexpected-name.jpg": {"body": b"legacy", "content_type": "image/jpeg"},
                f"hosts/{self.OTHER_HOST}/keep/avatar-w128-q80.webp": {"body": b"other", "content_type": "image/webp"},
            },
            profile_r2.STALE_BUCKET: {
                f"hosts/{self.HOST}/past/anything.bin": {"body": b"past", "content_type": "application/octet-stream"},
                f"hosts/{self.OTHER_HOST}/keep/old.webp": {"body": b"other-old", "content_type": "image/webp"},
            },
        }
        self.active = FakeClient(self.buckets)
        self.stale = FakeClient(self.buckets)
        self.args = SimpleNamespace(
            host_id=self.HOST,
            confirm="DELETE ALL R2 PROFILE COPIES",
            output=str(Path(tempfile.mkdtemp()) / "result.json"),
        )

    def test_purge_deletes_all_formats_only_inside_exact_host_namespace(self):
        purged = []
        original = profile_r2.purge_cache_exact_urls
        profile_r2.purge_cache_exact_urls = lambda urls: purged.extend(urls)
        try:
            profile_r2.purge_mode(self.args, self.active, self.stale)
        finally:
            profile_r2.purge_cache_exact_urls = original

        prefix = f"hosts/{self.HOST}/"
        self.assertFalse(any(key.startswith(prefix) for key in self.buckets[profile_r2.ACTIVE_BUCKET]))
        self.assertFalse(any(key.startswith(prefix) for key in self.buckets[profile_r2.STALE_BUCKET]))
        self.assertIn(f"hosts/{self.OTHER_HOST}/keep/avatar-w128-q80.webp", self.buckets[profile_r2.ACTIVE_BUCKET])
        self.assertIn(f"hosts/{self.OTHER_HOST}/keep/old.webp", self.buckets[profile_r2.STALE_BUCKET])
        self.assertEqual(len(purged), 3)
        self.assertTrue(all(f"/hosts/{self.HOST}/" in url for url in purged))

    def test_cache_purge_failure_keeps_private_recovery_inventory(self):
        original = profile_r2.purge_cache_exact_urls
        profile_r2.purge_cache_exact_urls = lambda urls: (_ for _ in ()).throw(RuntimeError("cache unavailable"))
        try:
            with self.assertRaisesRegex(RuntimeError, "cache unavailable"):
                profile_r2.purge_mode(self.args, self.active, self.stale)
        finally:
            profile_r2.purge_cache_exact_urls = original

        prefix = f"hosts/{self.HOST}/"
        self.assertFalse(any(key.startswith(prefix) for key in self.buckets[profile_r2.ACTIVE_BUCKET]))
        private_keys = {key for key in self.buckets[profile_r2.STALE_BUCKET] if key.startswith(prefix)}
        self.assertEqual(len(private_keys), 3)

    def test_rejects_noncanonical_or_expanding_host_ids(self):
        lowercase_with_letters = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        for value in (lowercase_with_letters.upper(), f"{self.HOST}/../", "", "hosts"):
            with self.assertRaises(RuntimeError):
                profile_r2.validate_host_id(value)


if __name__ == "__main__":
    unittest.main()
