import importlib.util
import sys
import tempfile
import types
import unittest
from pathlib import Path
from types import SimpleNamespace


sys.modules.setdefault("boto3", types.SimpleNamespace(client=lambda *args, **kwargs: None))
botocore = types.ModuleType("botocore")
botocore_config = types.ModuleType("botocore.config")
botocore_config.Config = object
botocore_exceptions = types.ModuleType("botocore.exceptions")
botocore_exceptions.ClientError = RuntimeError
sys.modules.setdefault("botocore", botocore)
sys.modules.setdefault("botocore.config", botocore_config)
sys.modules.setdefault("botocore.exceptions", botocore_exceptions)

MODULE_PATH = Path(__file__).with_name("r2-public-host-profile-reconcile.py")
SPEC = importlib.util.spec_from_file_location("profile_r2", MODULE_PATH)
profile_r2 = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(profile_r2)


class FakePaginator:
    def __init__(self, client):
        self.client = client

    def paginate(self, Bucket, Prefix):
        keys = sorted(key for key in self.client.buckets.get(Bucket, {}) if key.startswith(Prefix))
        return [{"Contents": [{"Key": key} for key in keys]}] if keys else [{}]


class FakeClient:
    def __init__(self, buckets):
        self.buckets = buckets

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
        }

    def download_file(self, Bucket, Key, Filename):
        Path(Filename).write_bytes(self.buckets[Bucket][Key]["body"])

    def upload_file(self, Filename, Bucket, Key, ExtraArgs):
        self.buckets.setdefault(Bucket, {})[Key] = {
            "body": Path(Filename).read_bytes(),
            "content_type": ExtraArgs["ContentType"],
            "metadata": ExtraArgs.get("Metadata", {}),
        }

    def delete_objects(self, Bucket, Delete):
        for item in Delete["Objects"]:
            self.buckets.get(Bucket, {}).pop(item["Key"], None)


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
