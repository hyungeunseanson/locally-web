#!/usr/bin/env python3
from datetime import datetime, timezone
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest


MODULE_PATH = Path(__file__).with_name("r2-public-image-repair.py")
SPEC = importlib.util.spec_from_file_location("r2_public_image_repair", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def sha(value):
    return hashlib.sha256(value).hexdigest()


def state(key, body, *, cache="max-age=60", metadata=None):
    return {
        "key": key,
        "etag": hashlib.md5(body).hexdigest(),
        "size": len(body),
        "storageClass": "STANDARD",
        "httpMetadata": {
            "ContentType": "image/webp",
            "CacheControl": cache,
            "ContentDisposition": "inline",
            "ContentLanguage": "ko",
        },
        "customMetadata": dict(metadata or {"legacy": "preserve"}),
    }


class FakeRepairClient:
    def __init__(self, objects, bodies):
        self.objects = {item["key"]: json.loads(json.dumps(item)) for item in objects}
        self.bodies = dict(bodies)
        self.copy_calls = []
        self.put_calls = []
        self.operations = {"listRequests": 0, "headRequests": 0, "getRequests": 0, "putRequests": 0, "copyRequests": 0}

    def list_metadata(self, _bucket):
        self.operations["listRequests"] += 1
        self.operations["headRequests"] += len(self.objects)
        return [json.loads(json.dumps(self.objects[key])) for key in sorted(self.objects)]

    def get_bytes(self, _bucket, key):
        self.operations["getRequests"] += 1
        body = self.bodies[key]
        return len(body), sha(body)

    def head(self, _bucket, key):
        self.operations["headRequests"] += 1
        return json.loads(json.dumps(self.objects[key]))

    def copy_metadata(self, _bucket, key, source_etag, http_metadata, custom_metadata, storage_class):
        self.operations["copyRequests"] += 1
        if self.objects[key]["etag"] != source_etag:
            raise RuntimeError("precondition")
        self.copy_calls.append({"key": key, "sourceEtag": source_etag, "http": http_metadata, "custom": custom_metadata})
        self.objects[key]["httpMetadata"] = json.loads(json.dumps(http_metadata))
        self.objects[key]["customMetadata"] = json.loads(json.dumps(custom_metadata))
        self.objects[key]["storageClass"] = storage_class
        self.objects[key]["etag"] = hashlib.md5((source_etag + str(len(self.copy_calls))).encode()).hexdigest()

    def put_original(self, _bucket, key, source_path, content_type, metadata):
        self.operations["putRequests"] += 1
        if key in self.objects:
            raise RuntimeError("precondition")
        body = source_path.read_bytes()
        self.put_calls.append({"key": key, "ifNoneMatch": "*"})
        self.bodies[key] = body
        self.objects[key] = {
            "key": key,
            "etag": hashlib.md5(body).hexdigest(),
            "size": len(body),
            "storageClass": "STANDARD",
            "httpMetadata": {"ContentType": content_type, "CacheControl": MODULE.IMMUTABLE_CACHE_CONTROL},
            "customMetadata": dict(metadata),
        }


class ControlledRepairTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "source-cache").mkdir()
        self.source_body = b"immutable source bytes"
        self.source_sha = sha(self.source_body)
        self.source_key = "experience/11111111-1111-4111-8111-111111111111/hero/a.jpg"
        self.source_key_sha = sha(self.source_key.encode())
        self.original_key = f"originals/v1/{self.source_key_sha[:2]}/{self.source_key_sha}/{self.source_sha}.jpg"
        (self.root / "source-cache" / self.source_sha).write_bytes(self.source_body)
        self.derivative_key = "cards/experience-1-primary-safe-w384-q65.webp"
        self.derivative_body = b"legacy derivative bytes"
        self.source_plan = {
            "version": 1,
            "generatedAt": "2026-09-13T00:00:00.000Z",
            "target": {"supabaseProjectRef": MODULE.EXPECTED_SUPABASE_PROJECT_REF, "bucket": "experiences"},
            "sourceSnapshotDigest": "a" * 64,
            "sourceObjects": [{
                "sourceKey": self.source_key,
                "sourceKeySha256": self.source_key_sha,
                "sourceByteSha256": self.source_sha,
                "sourceSize": len(self.source_body),
                "contentType": "image/jpeg",
                "originalKey": self.original_key,
                "localFile": f"source-cache/{self.source_sha}",
            }],
            "expectedDerivatives": [{
                "key": self.derivative_key,
                "kind": "card",
                "sourceKeySha256": self.source_key_sha,
                "sourceByteSha256": self.source_sha,
                "width": 384,
                "quality": 65,
                "format": "webp",
                "expectedContentType": "image/webp",
                "expectedCacheControl": MODULE.IMMUTABLE_CACHE_CONTROL,
            }],
        }
        self.source_plan_path = self.root / ".source-plan.json"
        self.source_plan_path.write_text(json.dumps(self.source_plan))
        derivative = state(self.derivative_key, self.derivative_body)
        self.client = FakeRepairClient([derivative], {self.derivative_key: self.derivative_body})
        self.usage = {
            "currentMonthClassA": 100,
            "currentMonthClassB": 1000,
            "accountStorageBytes": 100_000,
            "observedAt": datetime.now(timezone.utc).isoformat(),
        }

    def tearDown(self):
        self.temp.cleanup()

    def plan(self):
        return MODULE.build_repair_plan(
            self.client,
            MODULE.EXPECTED_BUCKET,
            self.source_plan,
            self.source_plan_path,
            self.usage,
        )

    def test_plan_is_read_only_and_computes_dynamic_costs(self):
        plan = self.plan()
        self.assertEqual(plan["counts"]["copyObject"], 1)
        self.assertEqual(plan["counts"]["putOriginal"], 1)
        self.assertEqual(plan["counts"]["cacheControlMismatch"], 1)
        self.assertEqual(plan["cost"]["planClassA"], 1)
        self.assertEqual(plan["cost"]["planClassB"], 2)
        self.assertEqual(plan["cost"]["applyClassA"], 4)
        self.assertEqual(plan["cost"]["applyClassB"], 8)
        self.assertEqual(plan["cost"]["expectedClassA"], 5)
        self.assertEqual(plan["cost"]["expectedClassB"], 10)
        self.assertEqual(plan["cost"]["expectedR2StorageIncreaseBytes"], len(self.source_body))
        self.assertEqual(plan["cost"]["expectedSupabaseSourceEgressBytes"], len(self.source_body) * 3)
        self.assertEqual(self.client.operations["putRequests"], 0)
        self.assertEqual(self.client.operations["copyRequests"], 0)
        derivative = plan["derivatives"][0]
        self.assertEqual(derivative["desiredCustomMetadata"]["legacy"], "preserve")
        self.assertEqual(derivative["desiredCustomMetadata"]["provenance_status"], "legacy-observed")
        self.assertNotIn("sharp_version", derivative["desiredCustomMetadata"])
        self.assertNotIn("libvips_version", derivative["desiredCustomMetadata"])
        self.assertNotIn("runtime_id", derivative["desiredCustomMetadata"])

    def test_canary_requires_exact_digest_and_performs_exact_two_conditional_operations(self):
        plan = self.plan()
        journal_path = self.root / "journal.json"
        with self.assertRaisesRegex(RuntimeError, "Exact plan digest"):
            MODULE.validate_plan_digest(plan, "wrong")
        MODULE.validate_plan_digest(plan, plan["planDigest"])
        receipt = MODULE.apply_plan(
            self.client,
            MODULE.EXPECTED_BUCKET,
            plan,
            self.source_plan_path,
            "canary",
            journal_path,
            self.usage,
        )
        self.assertEqual(receipt["copyObjectCount"], 1)
        self.assertEqual(receipt["putOriginalCount"], 1)
        self.assertEqual(len(self.client.copy_calls), 1)
        self.assertEqual(len(self.client.put_calls), 1)
        self.assertEqual(self.client.copy_calls[0]["sourceEtag"], plan["derivatives"][0]["before"]["etag"])
        self.assertEqual(self.client.put_calls[0]["ifNoneMatch"], "*")
        journal = json.loads(journal_path.read_text())
        self.assertTrue(journal["completed"])
        self.assertEqual(oct(journal_path.stat().st_mode & 0o777), "0o600")
        serialized = json.dumps(journal)
        self.assertNotIn(self.source_key, serialized)
        self.assertNotIn("11111111-1111", serialized)
        self.assertNotIn("https://", serialized)

    def test_full_apply_requires_matching_verified_canary_receipt(self):
        plan = self.plan()
        with self.assertRaisesRegex(RuntimeError, "canary receipt"):
            MODULE.apply_plan(self.client, MODULE.EXPECTED_BUCKET, plan, self.source_plan_path, "full", self.root / "journal.json", self.usage)
        with self.assertRaisesRegex(RuntimeError, "exact two-operation"):
            MODULE.verify_canary_receipt({"verified": True, "copyObjectCount": 0, "putOriginalCount": 1}, plan)

    def test_metadata_rollback_is_conditional_and_original_is_retained(self):
        plan = self.plan()
        journal_path = self.root / "journal.json"
        MODULE.apply_plan(self.client, MODULE.EXPECTED_BUCKET, plan, self.source_plan_path, "canary", journal_path, self.usage)
        journal = json.loads(journal_path.read_text())
        result = MODULE.rollback_metadata(self.client, MODULE.EXPECTED_BUCKET, journal, journal["journalDigest"])
        self.assertEqual(result, {"restoredMetadataObjectCount": 1, "retainedOriginalCount": 1})
        restored = self.client.objects[self.derivative_key]
        self.assertEqual(restored["httpMetadata"]["CacheControl"], "max-age=60")
        self.assertEqual(restored["httpMetadata"]["ContentDisposition"], "inline")
        self.assertEqual(restored["customMetadata"], {"legacy": "preserve"})
        self.assertIn(self.original_key, self.client.objects)

    def test_partial_journal_can_restore_a_copy_completed_before_post_etag_was_recorded(self):
        plan = self.plan()
        journal_path = self.root / "journal.json"
        MODULE.apply_plan(self.client, MODULE.EXPECTED_BUCKET, plan, self.source_plan_path, "canary", journal_path, self.usage)
        journal = json.loads(journal_path.read_text())
        journal["completed"] = False
        journal.pop("completedAt", None)
        journal["entries"][0]["postCopyEtag"] = None
        MODULE.persist_journal(journal_path, journal)
        result = MODULE.rollback_metadata(self.client, MODULE.EXPECTED_BUCKET, journal, journal["journalDigest"])
        self.assertEqual(result["restoredMetadataObjectCount"], 1)

    def test_quota_preflight_fails_before_apply_can_be_planned(self):
        usage = dict(self.usage)
        usage["currentMonthClassA"] = int(MODULE.FREE_CLASS_A * MODULE.SAFETY_RATIO)
        with self.assertRaisesRegex(RuntimeError, "free-tier safety ceiling"):
            MODULE.build_repair_plan(self.client, MODULE.EXPECTED_BUCKET, self.source_plan, self.source_plan_path, usage)

    def test_repair_source_has_no_r2_removal_api(self):
        source = MODULE_PATH.read_text()
        forbidden = "delete" + "_object"
        self.assertNotIn(forbidden, source)
        self.assertNotIn("upload_file", source)


if __name__ == "__main__":
    unittest.main()
