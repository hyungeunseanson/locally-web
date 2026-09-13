#!/usr/bin/env python3
import importlib.util
import hashlib
import io
import sys
import tempfile
import types
import unittest
import urllib.error
from pathlib import Path
from unittest import mock


sys.modules.setdefault("boto3", types.ModuleType("boto3"))
botocore = types.ModuleType("botocore")
botocore_config = types.ModuleType("botocore.config")
botocore_config.Config = object
botocore_exceptions = types.ModuleType("botocore.exceptions")


class MockClientError(Exception):
    def __init__(self, code, status):
        super().__init__(code)
        self.response = {
            "Error": {"Code": code},
            "ResponseMetadata": {"HTTPStatusCode": status},
        }


botocore_exceptions.ClientError = MockClientError
sys.modules.setdefault("botocore", botocore)
sys.modules.setdefault("botocore.config", botocore_config)
sys.modules.setdefault("botocore.exceptions", botocore_exceptions)

MODULE_PATH = Path(__file__).with_name("r2-public-image-reconcile.py")
SPEC = importlib.util.spec_from_file_location("r2_public_image_reconcile", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class Response:
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


def http_error(status):
    return urllib.error.HTTPError("https://media.example/object", status, "error", {}, None)


class FakeR2Client:
    def __init__(self, objects=None, before_put=None, head_failures=0):
        self.objects = dict(objects or {})
        self.before_put = before_put
        self.head_failures = head_failures
        self.put_calls = []
        self.copy_calls = 0
        self.delete_calls = 0

    def put_object(self, **kwargs):
        self.put_calls.append(kwargs.copy())
        if self.before_put:
            callback = self.before_put
            self.before_put = None
            callback(self, kwargs)
        key = kwargs["Key"]
        if kwargs.get("IfNoneMatch") != "*":
            raise AssertionError("conditional create is required")
        if key in self.objects:
            raise MockClientError("PreconditionFailed", 412)
        body = kwargs["Body"].read()
        self.objects[key] = {
            "body": body,
            "content_type": kwargs["ContentType"],
            "cache_control": kwargs["CacheControl"],
            "metadata": dict(kwargs["Metadata"]),
        }
        return {"ETag": '"created"'}

    def head_object(self, Bucket, Key):
        del Bucket
        if self.head_failures > 0:
            self.head_failures -= 1
            raise MockClientError("NoSuchKey", 404)
        if Key not in self.objects:
            raise MockClientError("NoSuchKey", 404)
        value = self.objects[Key]
        return {
            "ContentLength": len(value["body"]),
            "ContentType": value["content_type"],
            "CacheControl": value["cache_control"],
            "Metadata": dict(value["metadata"]),
        }

    def get_object(self, Bucket, Key):
        del Bucket
        if Key not in self.objects:
            raise MockClientError("NoSuchKey", 404)
        return {"Body": io.BytesIO(self.objects[Key]["body"])}


def object_value(body=b"webp-bytes", content_type="image/webp", cache_control=None, metadata=None):
    digest = hashlib.sha256(body).hexdigest()
    return {
        "body": body,
        "content_type": content_type,
        "cache_control": cache_control or MODULE.EXPECTED_CACHE_CONTROL,
        "metadata": {"sha256": digest} if metadata is None else metadata,
    }


class PublicVerificationTest(unittest.TestCase):
    def test_retries_only_transient_http_statuses(self):
        for status in (403, 404, 429, 500, 503, 599):
            with self.subTest(status=status), mock.patch.object(
                MODULE.urllib.request,
                "urlopen",
                side_effect=[http_error(status), Response()],
            ) as urlopen, mock.patch.object(MODULE.time, "sleep") as sleep:
                MODULE.verify_public_object("https://media.example", "image.webp", 123)
                self.assertEqual(urlopen.call_count, 2)
                sleep.assert_called_once_with(MODULE.PUBLIC_VERIFICATION_RETRY_DELAYS_SECONDS[0])

    def test_non_transient_http_status_fails_immediately(self):
        with mock.patch.object(MODULE.urllib.request, "urlopen", side_effect=http_error(401)) as urlopen, mock.patch.object(
            MODULE.time, "sleep"
        ) as sleep:
            with self.assertRaisesRegex(RuntimeError, "HTTP 401"):
                MODULE.verify_public_object("https://media.example", "image.webp", 123)
            self.assertEqual(urlopen.call_count, 1)
            sleep.assert_not_called()

    def test_content_type_mismatch_fails_immediately(self):
        with mock.patch.object(
            MODULE.urllib.request,
            "urlopen",
            return_value=Response(content_type="text/html"),
        ) as urlopen, mock.patch.object(MODULE.time, "sleep") as sleep:
            with self.assertRaisesRegex(RuntimeError, "unexpected content type"):
                MODULE.verify_public_object("https://media.example", "image.webp", 123)
            self.assertEqual(urlopen.call_count, 1)
            sleep.assert_not_called()

    def test_content_length_mismatch_fails_immediately(self):
        with mock.patch.object(
            MODULE.urllib.request,
            "urlopen",
            return_value=Response(content_length="122"),
        ) as urlopen, mock.patch.object(MODULE.time, "sleep") as sleep:
            with self.assertRaisesRegex(RuntimeError, "content length mismatch"):
                MODULE.verify_public_object("https://media.example", "image.webp", 123)
            self.assertEqual(urlopen.call_count, 1)
            sleep.assert_not_called()

    def test_retry_limit_is_bounded(self):
        with mock.patch.object(MODULE, "PUBLIC_VERIFICATION_RETRY_DELAYS_SECONDS", (0, 0)), mock.patch.object(
            MODULE.urllib.request,
            "urlopen",
            side_effect=http_error(403),
        ) as urlopen, mock.patch.object(MODULE.time, "sleep") as sleep:
            with self.assertRaisesRegex(RuntimeError, "HTTP 403"):
                MODULE.verify_public_object("https://media.example", "image.webp", 123)
            self.assertEqual(urlopen.call_count, 3)
            self.assertEqual(sleep.call_count, 2)


class ConditionalCreateTest(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name).resolve()
        self.source = self.root / "object.webp"
        self.body = b"webp-bytes"
        self.source.write_bytes(self.body)
        self.item = {
            "key": "cards/experience-1-primary-hash-w384-q65.webp",
            "path": self.source.name,
            "bytes": len(self.body),
            "sha256": hashlib.sha256(self.body).hexdigest(),
            "contentType": "image/webp",
            "sourceKeySha256": "a" * 64,
            "sourceByteSha256": "b" * 64,
            "sourceSize": 321,
            "derivativeRole": "card",
            "width": 384,
            "quality": 65,
            "format": "webp",
            "transformSchemaVersion": MODULE.TRANSFORM_SCHEMA_VERSION,
            "transformEngine": MODULE.SCHEDULED_SHARP_TRANSFORM_ENGINE,
            "provenanceStatus": MODULE.VERIFIED_PROVENANCE_STATUS,
            "generatedAt": "2026-09-13T00:00:00.000Z",
        }

    def tearDown(self):
        self.temporary_directory.cleanup()

    def run_reconcile(self, client, existed_before=False):
        with mock.patch.object(MODULE, "verify_public_object") as verify_public:
            outcome = MODULE.create_or_verify_object(
                client,
                "bucket",
                "https://media.example",
                self.root,
                self.item,
                existed_before,
            )
        verify_public.assert_called_once_with(
            "https://media.example",
            self.item["key"],
            len(client.objects[self.item["key"]]["body"]),
        )
        return outcome

    def test_list_missing_conditional_put_success(self):
        client = FakeR2Client()
        self.assertEqual(self.run_reconcile(client), "created")
        self.assertEqual(len(client.put_calls), 1)
        self.assertEqual(client.put_calls[0]["IfNoneMatch"], "*")
        self.assertEqual(client.objects[self.item["key"]]["body"], self.body)
        self.assertEqual(
            client.objects[self.item["key"]]["metadata"],
            MODULE.desired_sharp_metadata(self.item),
        )
        self.assertEqual(
            client.objects[self.item["key"]]["metadata"]["transform_engine"],
            "sharp-libvips",
        )

    def test_concurrent_exact_create_is_verified_without_overwrite(self):
        extra_metadata = {
            "sha256": self.item["sha256"],
            "source-byte-sha256": "future-provenance",
        }

        def concurrent_create(client, _kwargs):
            client.objects[self.item["key"]] = object_value(
                self.body, metadata=extra_metadata
            )

        client = FakeR2Client(before_put=concurrent_create)
        self.assertEqual(self.run_reconcile(client), "concurrent_byte_exact_skip")
        self.assertEqual(len(client.put_calls), 1)
        self.assertEqual(client.objects[self.item["key"]]["metadata"], extra_metadata)

    def test_conditional_conflict_rechecks_with_bounded_visibility_retries(self):
        def concurrent_create(client, _kwargs):
            client.objects[self.item["key"]] = object_value(self.body)

        client = FakeR2Client(before_put=concurrent_create, head_failures=2)
        with mock.patch.object(
            MODULE, "CONCURRENT_OBJECT_RETRY_DELAYS_SECONDS", (0, 0)
        ), mock.patch.object(MODULE.time, "sleep") as sleep:
            self.assertEqual(self.run_reconcile(client), "concurrent_byte_exact_skip")
        self.assertEqual(sleep.call_count, 2)

    def test_recognizes_precondition_and_conditional_conflict_responses(self):
        self.assertTrue(
            MODULE.is_conditional_write_conflict(
                MockClientError("PreconditionFailed", 412)
            )
        )
        self.assertTrue(
            MODULE.is_conditional_write_conflict(
                MockClientError("ConditionalRequestConflict", 409)
            )
        )
        self.assertFalse(
            MODULE.is_conditional_write_conflict(MockClientError("AccessDenied", 403))
        )

    def assert_conflict(self, value, message):
        def concurrent_create(client, _kwargs):
            client.objects[self.item["key"]] = value

        client = FakeR2Client(before_put=concurrent_create)
        with mock.patch.object(MODULE, "verify_public_object") as verify_public:
            with self.assertRaisesRegex(RuntimeError, message):
                MODULE.create_or_verify_object(
                    client,
                    "bucket",
                    "https://media.example",
                    self.root,
                    self.item,
                    False,
                )
        self.assertEqual(len(client.put_calls), 1)
        verify_public.assert_not_called()

    def test_concurrent_byte_sha_mismatch_fails_closed(self):
        self.assert_conflict(
            object_value(
                b"WEBP-bytes", metadata={"sha256": self.item["sha256"]}
            ),
            "byte conflict",
        )

    def test_concurrent_content_type_mismatch_fails_closed(self):
        self.assert_conflict(object_value(self.body, content_type="image/jpeg"), "Content-Type conflict")

    def test_concurrent_cache_control_mismatch_fails_closed(self):
        self.assert_conflict(object_value(self.body, cache_control="max-age=60"), "Cache-Control conflict")

    def test_concurrent_sha_metadata_mismatch_or_missing_fails_closed(self):
        for metadata in ({"sha256": "wrong"}, {}):
            with self.subTest(metadata=metadata):
                self.assert_conflict(object_value(self.body, metadata=metadata), "byte conflict")

    def test_object_present_in_upload_list_is_verified_with_zero_writes(self):
        client = FakeR2Client({self.item["key"]: object_value(self.body)})
        self.assertEqual(self.run_reconcile(client, existed_before=True), "existing_exact")
        self.assertEqual(client.put_calls, [])
        self.assertEqual(client.copy_calls, 0)
        self.assertEqual(client.delete_calls, 0)

    def provenance_metadata(self, body, engine="cloudflare-images-binding", **overrides):
        digest = hashlib.sha256(body).hexdigest()
        metadata = {
            "sha256": digest,
            "output_byte_sha256": digest,
            "source_key_sha256": self.item["sourceKeySha256"],
            "source_byte_sha256": self.item["sourceByteSha256"],
            "source_size": str(self.item["sourceSize"]),
            "transform_width": str(self.item["width"]),
            "transform_quality": str(self.item["quality"]),
            "transform_format": self.item["format"],
            "transform_schema_version": self.item["transformSchemaVersion"],
            "transform_engine": engine,
            "derivative_role": self.item["derivativeRole"],
            "provenance_status": "verified",
        }
        metadata.update(overrides)
        return metadata

    def assert_provenance_conflict(self, metadata_overrides, message="provenance conflict", body=b"queue-output"):
        metadata = self.provenance_metadata(body, **metadata_overrides)
        self.assert_conflict(object_value(body, metadata=metadata), message)

    def test_queue_wins_race_with_different_bytes_and_exact_provenance(self):
        queue_body = b"cloudflare-images-output"
        metadata = self.provenance_metadata(queue_body)
        metadata["additional_provenance"] = "preserved"

        def concurrent_create(client, _kwargs):
            client.objects[self.item["key"]] = object_value(
                queue_body, metadata=metadata
            )

        client = FakeR2Client(before_put=concurrent_create)
        self.assertEqual(
            self.run_reconcile(client), "concurrent_provenance_exact_skip"
        )
        self.assertNotEqual(hashlib.sha256(queue_body).hexdigest(), self.item["sha256"])
        self.assertEqual(
            client.objects[self.item["key"]]["metadata"]["additional_provenance"],
            "preserved",
        )
        self.assertEqual(len(client.put_calls), 1)
        self.assertEqual(client.copy_calls, 0)
        self.assertEqual(client.delete_calls, 0)

    def test_queue_wins_race_with_same_bytes_and_exact_provenance(self):
        metadata = self.provenance_metadata(self.body)

        def concurrent_create(client, _kwargs):
            client.objects[self.item["key"]] = object_value(
                self.body, metadata=metadata
            )

        client = FakeR2Client(before_put=concurrent_create)
        self.assertEqual(
            self.run_reconcile(client), "concurrent_provenance_exact_skip"
        )

    def test_verified_object_actual_bytes_must_match_both_stored_hashes(self):
        metadata = self.provenance_metadata(b"queue-output")
        self.assert_conflict(
            object_value(b"different-bytes", metadata=metadata),
            "provenance conflict",
        )

    def test_logical_provenance_mismatches_fail_closed(self):
        cases = (
            ({"source_key_sha256": "c" * 64}, "source key"),
            ({"source_byte_sha256": "c" * 64}, "source bytes"),
            ({"source_size": "999"}, "source size"),
            ({"transform_width": "640"}, "width"),
            ({"transform_quality": "75"}, "quality"),
            ({"transform_format": "avif"}, "format"),
            ({"derivative_role": "detail"}, "role"),
            ({"transform_schema_version": "999"}, "schema"),
        )
        for overrides, label in cases:
            with self.subTest(label=label):
                self.assert_provenance_conflict(overrides)

    def test_unknown_verified_transform_engine_fails_closed(self):
        self.assert_provenance_conflict(
            {"engine": "unknown-transformer"},
            message="transform engine conflict",
        )

    def test_legacy_observed_production_metadata_remains_compatible(self):
        legacy_body = b"historical-sharp-output"
        digest = hashlib.sha256(legacy_body).hexdigest()
        metadata = {
            "sha256": digest,
            "output_byte_sha256": digest,
            "source_key_sha256": self.item["sourceKeySha256"],
            "source_byte_sha256": self.item["sourceByteSha256"],
            "transform_width": str(self.item["width"]),
            "transform_quality": str(self.item["quality"]),
            "transform_format": "webp",
            "provenance_status": "legacy-observed",
        }

        def concurrent_create(client, _kwargs):
            client.objects[self.item["key"]] = object_value(
                legacy_body, metadata=metadata
            )

        client = FakeR2Client(before_put=concurrent_create)
        self.assertEqual(
            self.run_reconcile(client), "concurrent_provenance_exact_skip"
        )


if __name__ == "__main__":
    unittest.main()
