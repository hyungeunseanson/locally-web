import hashlib
import importlib.util
import json
import os
import pathlib
import tempfile
import types
import unittest
from unittest import mock

boto3 = types.ModuleType("boto3")
boto3.client = lambda *args, **kwargs: None
config = types.ModuleType("botocore.config")
config.Config = lambda **kwargs: kwargs
exceptions = types.ModuleType("botocore.exceptions")
import sys


class FakeError(Exception):
    def __init__(self, status): self.response = {"ResponseMetadata": {"HTTPStatusCode": status}}


exceptions.ClientError = FakeError
sys.modules.setdefault("boto3", boto3)
sys.modules.setdefault("botocore", types.ModuleType("botocore"))
sys.modules.setdefault("botocore.config", config)
sys.modules.setdefault("botocore.exceptions", exceptions)

spec = importlib.util.spec_from_file_location("source_copy", pathlib.Path(__file__).with_name("r2-experience-media-source-copy.py"))
source_copy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source_copy)


class FakeBody:
    def __init__(self, value): self.value = value
    def read(self, _):
        value, self.value = self.value, b""
        return value


class FakeClient:
    class exceptions: ClientError = FakeError
    def __init__(self): self.objects = {}; self.puts = 0
    def head_object(self, Bucket, Key):
        if Key not in self.objects: raise FakeError(404)
        item = self.objects[Key]
        return {"ContentLength": len(item["body"]), "ContentType": item["type"], "CacheControl": item["cache"], "Metadata": item["metadata"]}
    def get_object(self, Bucket, Key): return {"Body": FakeBody(self.objects[Key]["body"])}
    def put_object(self, **kwargs):
        if kwargs["Key"] in self.objects: raise FakeError(412)
        self.puts += 1
        self.objects[kwargs["Key"]] = {"body": kwargs["Body"].read(), "type": kwargs["ContentType"], "cache": kwargs["CacheControl"], "metadata": kwargs["Metadata"]}


class SourceCopyTest(unittest.TestCase):
    def plan(self, root):
        body = b"source"
        sha = hashlib.sha256(body).hexdigest()
        source_key = hashlib.sha256(b"key").hexdigest()
        key = f"originals/v1/{source_key[:2]}/{source_key}/{sha}.png"
        (root / "objects").mkdir()
        (root / "objects/source").write_bytes(body)
        execution = {"schema": source_copy.SCHEMA, "scope": {"source": "supabase-all-current-referenced-experiences", "projectRef": "uhinvcydgzqlpnvieyal", "destinationBucket": source_copy.BUCKET, "writeMode": "conditional-create-only"}, "sourceSnapshotDigest": "f" * 64, "limits": {"maxObjects": source_copy.MAX_OBJECTS, "maxBytes": source_copy.MAX_BYTES}, "originals": [{"key": key, "path": "objects/source", "bytes": len(body), "sha256": sha, "contentType": "image/png", "sourceKeySha256": source_key, "sourceByteSha256": sha, "sourceSize": len(body)}]}
        return {"execution": execution, "planDigest": source_copy.digest(execution)}, key

    def test_actual_executor_is_create_only_and_second_run_skips(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder); plan, key = self.plan(root)
            plan_path = root / "plan.json"; plan_path.write_text(json.dumps(plan))
            client = FakeClient()
            with mock.patch.object(source_copy, "client", return_value=client):
                source_copy.apply(plan_path, plan["planDigest"], root / "result.json")
                source_copy.apply(plan_path, plan["planDigest"], root / "result2.json")
            self.assertEqual(client.puts, 1)
            self.assertIn(key, client.objects)

    def test_tampering_is_rejected_before_write(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder); plan, _ = self.plan(root)
            plan["execution"]["originals"][0]["bytes"] += 1
            plan_path = root / "plan.json"; plan_path.write_text(json.dumps(plan))
            client = FakeClient()
            with mock.patch.object(source_copy, "client", return_value=client):
                with self.assertRaises(RuntimeError): source_copy.apply(plan_path, plan["planDigest"], root / "result.json")
            self.assertEqual(client.puts, 0)


if __name__ == "__main__": unittest.main()
