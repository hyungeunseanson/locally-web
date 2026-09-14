import hashlib
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SPEC = importlib.util.spec_from_file_location("recovery", Path(__file__).with_name("r2-public-image-recovery.py"))
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ConditionalError(Exception):
    def __init__(self):
        super().__init__("conditional conflict")
        self.response = {"Error": {"Code": "PreconditionFailed"}, "ResponseMetadata": {"HTTPStatusCode": 412}}


class FakeClient:
    def __init__(self, concurrent=False, conflict=False, fail_after=None):
        self.objects = {}
        self.concurrent = concurrent
        self.conflict = conflict
        self.fail_after = fail_after
        self.put_calls = []
        self.copy_calls = []
        self.delete_calls = []

    def put_object(self, **kwargs):
        self.put_calls.append(kwargs)
        if self.fail_after is not None and len(self.put_calls) > self.fail_after:
            raise RuntimeError("bounded injected failure")
        key = kwargs["Key"]
        body = kwargs["Body"].read()
        if self.concurrent:
            self.concurrent = False
            self.objects[key] = {
                "body": b"conflict" if self.conflict else body,
                "contentType": kwargs["ContentType"], "cacheControl": kwargs["CacheControl"],
                "metadata": kwargs["Metadata"],
            }
            raise ConditionalError()
        if key in self.objects:
            raise ConditionalError()
        self.objects[key] = {"body": body, "contentType": kwargs["ContentType"], "cacheControl": kwargs["CacheControl"], "metadata": kwargs["Metadata"]}

    def head_object(self, Bucket, Key):
        item = self.objects[Key]
        return {"ContentLength": len(item["body"]), "ContentType": item["contentType"], "CacheControl": item["cacheControl"], "Metadata": item["metadata"]}

    def get_object(self, Bucket, Key):
        return {"Body": io.BytesIO(self.objects[Key]["body"])}


def original_item(root, body=b"source-bytes", name="original"):
    source_sha = hashlib.sha256(body).hexdigest()
    source_key_sha = "a" * 64
    key = f"originals/v1/aa/{source_key_sha}/{source_sha}.jpg"
    path = root / name
    path.write_bytes(body)
    return {"key": key, "path": path.name, "bytes": len(body), "sha256": source_sha, "contentType": "image/jpeg", "sourceKeySha256": source_key_sha, "sourceByteSha256": source_sha, "sourceSize": len(body), "copiedAt": "2026-09-14T00:00:00.000Z"}


class RecoveryConditionalWriteTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.item = original_item(self.root)

    def tearDown(self):
        self.temp.cleanup()

    def test_conditional_original_create_and_second_run_exact_skip(self):
        client = FakeClient()
        self.assertEqual(MODULE.create_original(client, "bucket", self.root, self.item), "created")
        self.assertEqual(MODULE.create_original(client, "bucket", self.root, self.item), "concurrent_exact_skip")
        self.assertEqual(len(client.put_calls), 2)
        self.assertTrue(all(call["IfNoneMatch"] == "*" for call in client.put_calls))
        self.assertEqual(client.copy_calls, [])
        self.assertEqual(client.delete_calls, [])

    def test_concurrent_exact_writer_is_verified_without_overwrite(self):
        client = FakeClient(concurrent=True)
        self.assertEqual(MODULE.create_original(client, "bucket", self.root, self.item), "concurrent_exact_skip")
        self.assertEqual(len(client.put_calls), 1)

    def test_concurrent_conflict_fails_closed(self):
        client = FakeClient(concurrent=True, conflict=True)
        with self.assertRaisesRegex(RuntimeError, "Original conflict"):
            MODULE.create_original(client, "bucket", self.root, self.item)
        self.assertEqual(len(client.put_calls), 1)

    def test_plan_requires_exact_digest_and_rejects_conflicts(self):
        payload = {"version": 1, "items": []}
        digest = hashlib.sha256(MODULE.stable_json(payload).encode()).hexdigest()
        plan = {"digestPayload": payload, "planDigest": digest, "conflicts": [], "originals": [], "derivatives": [], "budget": {"maxOriginalCreates": 0, "maxDerivativeCreates": 0, "maxTransforms": 0}, "progress": {"transformCount": 0}}
        MODULE.validate_plan(plan, digest)
        with self.assertRaisesRegex(RuntimeError, "confirmation"):
            MODULE.validate_plan(plan, "0" * 64)
        with self.assertRaisesRegex(RuntimeError, "contains conflicts"):
            MODULE.validate_plan({**plan, "conflicts": [{"reason": "conflict"}]}, digest)

    def test_plan_digest_matches_node_stable_json_contract(self):
        payload = {"version": 1, "items": [{"b": 2, "a": "한글"}]}
        digest = hashlib.sha256(MODULE.stable_json(payload).encode()).hexdigest()
        self.assertEqual(digest, "865b80541b286b8a0bc2aaf1b42d10d615c847564395374de3845e944622a7d5")

    def test_existing_exact_original_allows_additional_metadata_without_rewrite(self):
        client = FakeClient()
        self.assertEqual(MODULE.create_original(client, "bucket", self.root, self.item), "created")
        client.objects[self.item["key"]]["metadata"]["future_provenance"] = "preserved"
        self.assertTrue(MODULE.verify_original(client, "bucket", self.item))
        self.assertEqual(MODULE.create_original(client, "bucket", self.root, self.item), "concurrent_exact_skip")
        self.assertEqual(client.objects[self.item["key"]]["metadata"]["future_provenance"], "preserved")

    def test_partial_failure_result_is_preserved_for_safe_rerun(self):
        second = original_item(self.root, b"second-source", "second")
        plan = {"planDigest": "d" * 64, "r2StateDigest": "state", "originals": [self.item, second], "derivatives": []}
        output = self.root / "result.json"
        client = FakeClient(fail_after=1)
        with mock.patch.object(MODULE, "normalize_metadata", return_value=([], "state", {})):
            with self.assertRaisesRegex(RuntimeError, "injected"):
                MODULE.apply_plan(client, "bucket", plan, self.root / "plan.json", output)
        result = json.loads(output.read_text())
        self.assertEqual(result["status"], "partial_failure")
        self.assertEqual(result["originalCreatedCount"], 1)
        self.assertEqual(result["pendingObjectCount"], 1)
        self.assertEqual(result["deletedObjectCount"], 0)
        self.assertEqual(result["copiedObjectCount"], 0)


if __name__ == "__main__":
    unittest.main()
