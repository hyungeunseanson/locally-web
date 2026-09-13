#!/usr/bin/env python3
import hashlib
import importlib.util
import json
import unittest
from pathlib import Path
from unittest import mock


MODULE_PATH = Path(__file__).with_name("r2-public-image-audit.py")
SPEC = importlib.util.spec_from_file_location("r2_public_image_audit", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class FakeReadOnlyClient:
    def __init__(self, objects, bodies):
        self.objects = objects
        self.bodies = bodies
        self.operations = {"listRequests": 0, "headRequests": 0, "getRequests": 0, "mutationRequests": 0}
        self.put_object = mock.Mock()
        self.upload_file = mock.Mock()
        self.delete_object = mock.Mock()
        self.delete_objects = mock.Mock()
        self.copy_object = mock.Mock()

    def list_metadata(self, _bucket):
        self.operations["listRequests"] += 1
        self.operations["headRequests"] += len(self.objects)
        return self.objects

    def get_bytes(self, _bucket, key):
        self.operations["getRequests"] += 1
        body = self.bodies[key]
        return len(body), hashlib.sha256(body).hexdigest()


def object_metadata(key, body, *, cache=MODULE.EXPECTED_DERIVATIVE_CACHE_CONTROL, content_type="image/webp", stored_sha=True):
    metadata = {"sha256": hashlib.sha256(body).hexdigest()} if stored_sha else {}
    return {
        "key": key,
        "size": len(body),
        "etag": hashlib.md5(body).hexdigest(),
        "contentType": content_type,
        "cacheControl": cache,
        "customMetadata": metadata,
    }


class R2ReadOnlyAuditTest(unittest.TestCase):
    def setUp(self):
        self.plan = {
            "expected": [
                {"key": "cards/expected.webp", "kind": "card"},
                {"key": "details/missing.webp", "kind": "detail"},
            ],
            "knownManifestKeys": ["cards/expected.webp", "details/missing.webp", "details/stale.webp"],
        }
        self.bodies = {
            "cards/expected.webp": b"expected",
            "details/stale.webp": b"stale",
            "originals/source-hash/original.jpg": b"original",
            "misc/unclassified.webp": b"extra",
        }
        self.objects = [
            object_metadata("cards/expected.webp", self.bodies["cards/expected.webp"]),
            object_metadata("details/stale.webp", self.bodies["details/stale.webp"], stored_sha=False),
            object_metadata("originals/source-hash/original.jpg", self.bodies["originals/source-hash/original.jpg"], content_type="image/jpeg", stored_sha=False),
            object_metadata("misc/unclassified.webp", self.bodies["misc/unclassified.webp"], cache="", stored_sha=False),
        ]

    def assert_no_mutations(self, client):
        self.assertEqual(client.operations["mutationRequests"], 0)
        client.put_object.assert_not_called()
        client.upload_file.assert_not_called()
        client.delete_object.assert_not_called()
        client.delete_objects.assert_not_called()
        client.copy_object.assert_not_called()

    def test_metadata_taxonomy_and_parity_are_read_only(self):
        client = FakeReadOnlyClient(self.objects, self.bodies)
        report = MODULE.audit(client, MODULE.EXPECTED_BUCKET, self.plan, "metadata")
        self.assertEqual(report["taxonomy"], {
            "expectedCard": 1,
            "expectedDetail": 0,
            "staleKnownDerivative": 1,
            "unclassifiedExtra": 1,
            "original": 1,
        })
        self.assertEqual(report["expectedMissing"], {"total": 1, "card": 0, "detail": 1})
        self.assertEqual(report["metadata"]["customShaCoverage"], 1)
        self.assertEqual(report["metadata"]["sizeCoverage"], 4)
        self.assertEqual(report["metadata"]["cacheControlMismatchCount"], 0)
        self.assertEqual(report["metadata"]["contentTypeMismatchCount"], 0)
        self.assertEqual(report["downloadedShaVerification"]["downloadedCount"], 0)
        self.assertRegex(report["identitySetDigests"]["actual"], r"^[0-9a-f]{64}$")
        self.assertRegex(report["identitySetDigests"]["expected"], r"^[0-9a-f]{64}$")
        self.assertRegex(report["identitySetDigests"]["missing"], r"^[0-9a-f]{64}$")
        self.assert_no_mutations(client)

    def test_full_audit_verifies_stored_sha_without_regenerating_transforms(self):
        client = FakeReadOnlyClient(self.objects, self.bodies)
        report = MODULE.audit(client, MODULE.EXPECTED_BUCKET, self.plan, "full")
        verification = report["downloadedShaVerification"]
        self.assertEqual(verification["downloadedCount"], 4)
        self.assertEqual(verification["verifiedCount"], 1)
        self.assertEqual(verification["unverifiableMetadataCount"], 3)
        self.assertEqual(verification["mismatchCount"], 0)
        self.assertEqual(client.operations["getRequests"], 4)
        self.assert_no_mutations(client)

    def test_full_audit_reports_actual_byte_mismatch_separately(self):
        objects = list(self.objects)
        objects[0] = {**objects[0], "customMetadata": {"sha256": "0" * 64}}
        client = FakeReadOnlyClient(objects, self.bodies)
        report = MODULE.audit(client, MODULE.EXPECTED_BUCKET, self.plan, "full")
        self.assertEqual(report["downloadedShaVerification"]["mismatchCount"], 1)
        self.assertEqual(report["downloadedShaVerification"]["verifiedCount"], 0)
        self.assert_no_mutations(client)

    def test_report_never_contains_raw_object_keys(self):
        client = FakeReadOnlyClient(self.objects, self.bodies)
        serialized = json.dumps(MODULE.audit(client, MODULE.EXPECTED_BUCKET, self.plan, "metadata"))
        for key in self.bodies:
            self.assertNotIn(key, serialized)
        self.assertNotIn("https://", serialized)


if __name__ == "__main__":
    unittest.main()
