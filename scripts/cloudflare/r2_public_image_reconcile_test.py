#!/usr/bin/env python3
import importlib.util
import sys
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
botocore_exceptions.ClientError = Exception
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


if __name__ == "__main__":
    unittest.main()
