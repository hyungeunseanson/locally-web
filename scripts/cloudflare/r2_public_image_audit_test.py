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


def object_metadata(key, body, *, cache=MODULE.EXPECTED_DERIVATIVE_CACHE_CONTROL, content_type="image/webp", stored_sha=True, source_key_sha=None):
    metadata = {"sha256": hashlib.sha256(body).hexdigest()} if stored_sha else {}
    if source_key_sha:
        metadata["source_key_sha256"] = source_key_sha
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
        self.expected_original_hash = hashlib.sha256(b"experience/source/hero/original.jpg").hexdigest()
        self.plan = {
            "expected": [
                {"key": "cards/expected.webp", "kind": "card"},
                {"key": "details/missing.webp", "kind": "detail"},
            ],
            "knownManifestKeys": ["cards/expected.webp", "details/missing.webp", "details/stale.webp"],
            "publicActiveOriginalSourceKeyHashes": [self.expected_original_hash],
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
            object_metadata("originals/source-hash/original.jpg", self.bodies["originals/source-hash/original.jpg"], content_type="image/jpeg", stored_sha=False, source_key_sha=self.expected_original_hash),
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
        self.assertEqual(report["metadata"]["expectedCustomShaCoverage"], 1)
        self.assertEqual(report["originalIdentityCoverage"], {
            "expectedCount": 1,
            "actualObjectCount": 1,
            "sourceKeyMetadataCoverage": 1,
            "matchingExpectedCount": 1,
            "missingCount": 0,
            "unexpectedCount": 0,
            "duplicateSourceKeyCount": 0,
            "invalidSourceKeyMetadataCount": 0,
        })
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

    def test_original_identity_gap_is_reported_without_exposing_source_keys(self):
        objects = list(self.objects)
        objects[2] = {
            **objects[2],
            "customMetadata": {"source_key_sha256": "f" * 64},
        }
        client = FakeReadOnlyClient(objects, self.bodies)
        report = MODULE.audit(client, MODULE.EXPECTED_BUCKET, self.plan, "metadata")
        coverage = report["originalIdentityCoverage"]
        self.assertEqual(coverage["matchingExpectedCount"], 0)
        self.assertEqual(coverage["missingCount"], 1)
        self.assertEqual(coverage["unexpectedCount"], 1)
        self.assertNotIn("experience/source/hero/original.jpg", json.dumps(report))
        self.assert_no_mutations(client)

    def test_completeness_distinguishes_consistent_conflicting_and_unverifiable_metadata(self):
        source_key_sha = "a" * 64
        output_sha = hashlib.sha256(b"expected").hexdigest()
        base_metadata = {
            "sha256": output_sha,
            "output_byte_sha256": output_sha,
            "source_byte_sha256": "b" * 64,
            "source_key_sha256": source_key_sha,
            "source_size": "321",
            "transform_width": "384",
            "transform_quality": "65",
            "transform_format": "webp",
            "derivative_role": "card",
            "transform_schema_version": MODULE.TRANSFORM_SCHEMA_VERSION,
            "transform_engine": next(iter(MODULE.ALLOWED_DERIVATIVE_ENGINES)),
            "provenance_status": MODULE.VERIFIED_PROVENANCE_STATUS,
        }
        plan = {
            "expected": [{
                "key": "cards/expected.webp", "kind": "card", "role": "card",
                "width": 384, "quality": 65, "format": "webp", "sourceKeySha256": source_key_sha,
            }],
            "knownManifestKeys": ["cards/expected.webp"],
            "publicActiveOriginalSourceKeyHashes": [],
        }
        consistent = object_metadata("cards/expected.webp", b"expected")
        consistent["customMetadata"] = base_metadata
        report = MODULE.audit(FakeReadOnlyClient([consistent], {"cards/expected.webp": b"expected"}), MODULE.EXPECTED_BUCKET, plan, "metadata")
        self.assertEqual(report["completeness"]["derivativeMetadataConsistentCount"], 1)
        self.assertEqual(report["completeness"]["derivativeConflictCount"], 0)

        conflicting = {**consistent, "customMetadata": {**base_metadata, "transform_quality": "75"}}
        report = MODULE.audit(FakeReadOnlyClient([conflicting], {"cards/expected.webp": b"expected"}), MODULE.EXPECTED_BUCKET, plan, "metadata")
        self.assertEqual(report["completeness"]["derivativeConflictCount"], 1)

        unverifiable = {**consistent, "customMetadata": {**base_metadata, "transform_engine": "unknown-engine"}}
        report = MODULE.audit(FakeReadOnlyClient([unverifiable], {"cards/expected.webp": b"expected"}), MODULE.EXPECTED_BUCKET, plan, "metadata")
        self.assertEqual(report["completeness"]["derivativeUnverifiableCount"], 1)

    def test_legacy_observed_derivative_without_source_size_is_metadata_consistent(self):
        source_key_sha = "a" * 64
        output_sha = hashlib.sha256(b"expected").hexdigest()
        legacy = object_metadata("cards/expected.webp", b"expected")
        legacy["customMetadata"] = {
            "sha256": output_sha,
            "output_byte_sha256": output_sha,
            "source_byte_sha256": "b" * 64,
            "source_key_sha256": source_key_sha,
            "transform_width": "384",
            "transform_quality": "65",
            "transform_format": "webp",
            "provenance_status": "legacy-observed",
        }
        plan = {
            "expected": [{
                "key": "cards/expected.webp", "kind": "card", "role": "card",
                "width": 384, "quality": 65, "format": "webp", "sourceKeySha256": source_key_sha,
            }],
            "knownManifestKeys": ["cards/expected.webp"],
            "publicActiveOriginalSourceKeyHashes": [],
        }
        report = MODULE.audit(FakeReadOnlyClient([legacy], {"cards/expected.webp": b"expected"}), MODULE.EXPECTED_BUCKET, plan, "metadata")
        self.assertEqual(report["completeness"]["derivativeMetadataConsistentCount"], 1)
        self.assertEqual(report["completeness"]["derivativeConflictCount"], 0)
        self.assertEqual(report["completeness"]["derivativeUnverifiableCount"], 0)

    def test_legacy_original_core_metadata_is_consistent_but_partial_provenance_conflicts(self):
        source_hash = "a" * 64
        body = b"original"
        digest = hashlib.sha256(body).hexdigest()
        original = object_metadata(
            "originals/source-hash/original.jpg",
            body,
            content_type="image/jpeg",
            stored_sha=False,
            source_key_sha=source_hash,
        )
        original["customMetadata"].update({
            "source_byte_sha256": digest,
            "output_byte_sha256": digest,
            "source_size": str(len(body)),
        })
        plan = {"expected": [], "knownManifestKeys": [], "publicActiveOriginalSourceKeyHashes": [source_hash]}
        report = MODULE.audit(FakeReadOnlyClient([original], {original["key"]: body}), MODULE.EXPECTED_BUCKET, plan, "metadata")
        self.assertEqual(report["completeness"]["originalMetadataConsistentCount"], 1)
        self.assertEqual(report["completeness"]["originalConflictCount"], 0)

        partial = {**original, "customMetadata": {**original["customMetadata"], "provenance_status": "verified"}}
        report = MODULE.audit(FakeReadOnlyClient([partial], {partial["key"]: body}), MODULE.EXPECTED_BUCKET, plan, "metadata")
        self.assertEqual(report["completeness"]["originalMetadataConsistentCount"], 0)
        self.assertEqual(report["completeness"]["originalConflictCount"], 1)

    def test_whole_state_digest_covers_http_metadata(self):
        base = object_metadata("cards/expected.webp", b"expected")
        content_type_changed = {**base, "contentType": "application/octet-stream"}
        cache_changed = {**base, "cacheControl": "max-age=60"}
        self.assertNotEqual(MODULE.r2_state_digest([base]), MODULE.r2_state_digest([content_type_changed]))
        self.assertNotEqual(MODULE.r2_state_digest([base]), MODULE.r2_state_digest([cache_changed]))


if __name__ == "__main__":
    unittest.main()
