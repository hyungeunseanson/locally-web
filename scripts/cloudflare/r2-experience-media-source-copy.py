#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

SCHEMA = "locally.experience-media-source-copy.v1"
ACCOUNT = "d56f5f850c6f7dc5779a7c2054aca5a5"
ENDPOINT = f"https://{ACCOUNT}.r2.cloudflarestorage.com"
BUCKET = "locally-public-experience-canary"
CACHE = "public, max-age=31536000, immutable"
MAX_OBJECTS = 50
MAX_BYTES = 256 * 1024 * 1024


def stable(value):
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True, separators=(",", ": ")) + "\n"


def digest(value):
    return hashlib.sha256(stable(value).encode()).hexdigest()


def file_sha(path):
    value = hashlib.sha256()
    size = 0
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            size += len(chunk)
            value.update(chunk)
    return size, value.hexdigest()


def client():
    if os.environ.get("R2_ENDPOINT", "").rstrip("/") != ENDPOINT or os.environ.get("R2_BUCKET") != BUCKET:
        raise RuntimeError("unexpected R2 source-copy target")
    return boto3.client("s3", endpoint_url=ENDPOINT, aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"], region_name="auto",
        config=Config(signature_version="s3v4", retries={"total_max_attempts": 1, "mode": "standard"}))


def inspect(output):
    api = client()
    grouped = {}
    for page in api.get_paginator("list_objects_v2").paginate(Bucket=BUCKET, Prefix="originals/v1/"):
        for item in page.get("Contents", []):
            head = api.head_object(Bucket=BUCKET, Key=item["Key"])
            metadata = head.get("Metadata") or {}
            source = metadata.get("source_key_sha256")
            if source:
                grouped.setdefault(source, []).append({"key": item["Key"], "size": head["ContentLength"],
                    "contentType": head.get("ContentType", "").split(";", 1)[0].lower(),
                    "cacheControl": head.get("CacheControl"), "customMetadata": metadata})
    Path(output).write_text(stable({"originalsBySourceKeySha256": grouped}), encoding="utf-8")
    os.chmod(output, 0o600)
    print(stable({"originalCount": sum(map(len, grouped.values())), "sourceIdentityCount": len(grouped)}), end="")


def validate(plan, confirmation, root):
    execution = plan.get("execution") if isinstance(plan, dict) else None
    if not execution or plan.get("planDigest") != confirmation or digest(execution) != confirmation:
        raise RuntimeError("exact source-copy plan digest confirmation is required")
    if execution.get("schema") != SCHEMA or execution.get("scope") != {
        "source": "supabase-all-current-referenced-experiences", "projectRef": "uhinvcydgzqlpnvieyal",
        "destinationBucket": BUCKET, "writeMode": "conditional-create-only"}:
        raise RuntimeError("unexpected source-copy scope")
    if execution.get("limits") != {"maxObjects": MAX_OBJECTS, "maxBytes": MAX_BYTES}:
        raise RuntimeError("unexpected source-copy limits")
    items = execution.get("originals")
    if not isinstance(items, list) or len(items) > MAX_OBJECTS or sum(x.get("bytes", MAX_BYTES + 1) for x in items) > MAX_BYTES:
        raise RuntimeError("source-copy ceiling exceeded")
    seen = set()
    files = {}
    for item in items:
        if set(item) != {"key", "path", "bytes", "sha256", "contentType", "sourceKeySha256", "sourceByteSha256", "sourceSize"}:
            raise RuntimeError("invalid source-copy item")
        for name in ("sha256", "sourceKeySha256", "sourceByteSha256"):
            if not re.fullmatch(r"[0-9a-f]{64}", item.get(name, "")):
                raise RuntimeError("invalid source-copy digest")
        extension = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif"}.get(item.get("contentType"))
        expected = f"originals/v1/{item['sourceKeySha256'][:2]}/{item['sourceKeySha256']}/{item['sourceByteSha256']}.{extension}"
        if item["key"] != expected or item["key"] in seen or item["bytes"] <= 0 or item["bytes"] != item["sourceSize"] or item["sha256"] != item["sourceByteSha256"]:
            raise RuntimeError("invalid source-copy object contract")
        seen.add(item["key"])
        relative = Path(item["path"])
        file = (root / relative).resolve()
        if relative.is_absolute() or ".." in relative.parts or root not in file.parents or not file.is_file() or file.is_symlink():
            raise RuntimeError("unsafe source-copy file")
        if file_sha(file) != (item["bytes"], item["sha256"]):
            raise RuntimeError("source-copy file proof mismatch")
        files[item["key"]] = file
    return execution, files


def verify(api, item):
    head = api.head_object(Bucket=BUCKET, Key=item["key"])
    body = api.get_object(Bucket=BUCKET, Key=item["key"])["Body"]
    sha = hashlib.sha256(); size = 0
    for chunk in iter(lambda: body.read(1024 * 1024), b""):
        size += len(chunk); sha.update(chunk)
    meta = head.get("Metadata") or {}
    return size == item["bytes"] and sha.hexdigest() == item["sha256"] and head["ContentLength"] == item["bytes"] \
        and head.get("ContentType", "").split(";", 1)[0].lower() == item["contentType"] and head.get("CacheControl") == CACHE \
        and meta.get("source_key_sha256") == item["sourceKeySha256"] and meta.get("source_byte_sha256") == item["sha256"] \
        and meta.get("output_byte_sha256") == item["sha256"] and meta.get("source_size") == str(item["bytes"])


def apply(plan_path, confirmation, output):
    root = Path(plan_path).resolve().parent
    plan = json.loads(Path(plan_path).read_text(encoding="utf-8"))
    execution, files = validate(plan, confirmation, root)
    api = client()
    result = {"attempted": 0, "created": 0, "exactSkipped": 0, "failed": 0, "bytesCreated": 0}
    copied_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    for item in execution["originals"]:
        result["attempted"] += 1
        try:
            try:
                if verify(api, item):
                    result["exactSkipped"] += 1
                    continue
                raise RuntimeError("existing R2 source conflict")
            except ClientError as error:
                if error.response.get("ResponseMetadata", {}).get("HTTPStatusCode") != 404:
                    raise
            with files[item["key"]].open("rb") as body:
                api.put_object(Bucket=BUCKET, Key=item["key"], Body=body, ContentLength=item["bytes"],
                    ContentType=item["contentType"], CacheControl=CACHE, IfNoneMatch="*", Metadata={
                        "sha256": item["sha256"], "source_key_sha256": item["sourceKeySha256"],
                        "source_byte_sha256": item["sha256"], "output_byte_sha256": item["sha256"],
                        "source_size": str(item["bytes"]), "provenance_status": "verified",
                        "transform_schema_version": "1", "transform_engine": "source-copy", "copied_at": copied_at})
            if not verify(api, item):
                raise RuntimeError("created R2 source verification failed")
            result["created"] += 1; result["bytesCreated"] += item["bytes"]
        except Exception:
            result["failed"] += 1
            Path(output).write_text(stable(result), encoding="utf-8")
            raise
    Path(output).write_text(stable(result), encoding="utf-8")
    print(stable(result), end="")


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("inspect"); p.add_argument("--output", required=True)
    p = sub.add_parser("apply"); p.add_argument("--plan", required=True); p.add_argument("--confirm-digest", required=True); p.add_argument("--output", required=True)
    args = parser.parse_args()
    inspect(args.output) if args.command == "inspect" else apply(args.plan, args.confirm_digest, args.output)


if __name__ == "__main__":
    main()
