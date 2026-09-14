#!/usr/bin/env python3
import argparse
import hashlib
import importlib.util
import json
import os
import re
import sys
from pathlib import Path

import boto3
from botocore.config import Config


EXPECTED_ACCOUNT_ID = "d56f5f850c6f7dc5779a7c2054aca5a5"
EXPECTED_ENDPOINT = f"https://{EXPECTED_ACCOUNT_ID}.r2.cloudflarestorage.com"
EXPECTED_BUCKET = "locally-public-experience-canary"
EXPECTED_CACHE_CONTROL = "public, max-age=31536000, immutable"


def load_sibling(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


RECONCILE = load_sibling("r2_reconcile", "r2-public-image-reconcile.py")
AUDIT = load_sibling("r2_audit", "r2-public-image-audit.py")


def stable_json(value):
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True, separators=(",", ": ")) + "\n"


def sha256_bytes(value):
    return hashlib.sha256(value).hexdigest()


def identity_hash(value):
    return hashlib.sha256(("locally-public-experience-media-v1\0" + value).encode()).hexdigest()


def require_environment(name):
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def load_client():
    endpoint = require_environment("R2_ENDPOINT").rstrip("/")
    bucket = require_environment("R2_BUCKET")
    if endpoint != EXPECTED_ENDPOINT or bucket != EXPECTED_BUCKET:
        raise RuntimeError("Refusing an unexpected R2 recovery target")
    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=require_environment("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=require_environment("R2_SECRET_ACCESS_KEY"),
        region_name="auto",
        config=Config(signature_version="s3v4", retries={"max_attempts": 5, "mode": "standard"}),
    )
    return client, bucket


def normalize_metadata(client, bucket):
    wrapped = AUDIT.S3ReadOnlyClient(client)
    objects = wrapped.list_metadata(bucket)
    return objects, AUDIT.r2_state_digest(objects), wrapped.operations


def is_conditional_conflict(error):
    response = getattr(error, "response", {}) or {}
    code = str((response.get("Error") or {}).get("Code", ""))
    status = (response.get("ResponseMetadata") or {}).get("HTTPStatusCode")
    return code in {"PreconditionFailed", "ConditionalRequestConflict"} or status in {409, 412}


def stream_sha(response):
    return RECONCILE.read_stream_sha256(response["Body"])


def desired_original_metadata(item):
    return {
        "sha256": item["sha256"],
        "source_key_sha256": item["sourceKeySha256"],
        "source_byte_sha256": item["sourceByteSha256"],
        "output_byte_sha256": item["sha256"],
        "source_size": str(item["sourceSize"]),
        "provenance_status": "verified",
        "transform_schema_version": RECONCILE.TRANSFORM_SCHEMA_VERSION,
        "transform_engine": "source-copy",
        "copied_at": item["copiedAt"],
    }


def verify_original(client, bucket, item):
    head = client.head_object(Bucket=bucket, Key=item["key"])
    size, digest = stream_sha(client.get_object(Bucket=bucket, Key=item["key"]))
    metadata = head.get("Metadata") or {}
    required = desired_original_metadata(item)
    required["copied_at"] = metadata.get("copied_at", "")
    return (
        size == item["bytes"]
        and head.get("ContentLength") == item["bytes"]
        and digest == item["sha256"]
        and head.get("ContentType", "").split(";", 1)[0].lower() == item["contentType"]
        and head.get("CacheControl") == EXPECTED_CACHE_CONTROL
        and bool(required["copied_at"])
        and all(metadata.get(key) == value for key, value in required.items())
    )


def create_original(client, bucket, root, item):
    if not re.fullmatch(r"[0-9a-f]{64}", item.get("sha256", "")):
        raise RuntimeError("Invalid original SHA")
    root = Path(root).resolve()
    source = (root / item["path"]).resolve()
    if root not in source.parents or not source.is_file() or source.stat().st_size != item["bytes"]:
        raise RuntimeError("Invalid original local file")
    if RECONCILE.sha256_file(source) != item["sha256"]:
        raise RuntimeError("Original local SHA mismatch")
    try:
        with source.open("rb") as body:
            client.put_object(
                Bucket=bucket,
                Key=item["key"],
                Body=body,
                ContentLength=item["bytes"],
                ContentType=item["contentType"],
                CacheControl=EXPECTED_CACHE_CONTROL,
                Metadata=desired_original_metadata(item),
                IfNoneMatch="*",
            )
        created = True
    except Exception as error:
        if not is_conditional_conflict(error):
            raise
        created = False
    if not verify_original(client, bucket, item):
        raise RuntimeError(f"Original conflict ({identity_hash(item['key'])[:16]})")
    return "created" if created else "concurrent_exact_skip"


def validate_plan(plan, confirmation):
    digest_payload = plan.get("digestPayload")
    calculated = sha256_bytes(stable_json(digest_payload).encode()) if isinstance(digest_payload, dict) else ""
    if not confirmation or confirmation != plan.get("planDigest") or confirmation != calculated:
        raise RuntimeError("Exact fresh recovery plan digest confirmation is required")
    if plan.get("conflicts"):
        raise RuntimeError("Recovery plan contains conflicts; writes are forbidden")
    progress = plan.get("progress") or {}
    budget = plan.get("budget") or {}
    if len(plan.get("originals") or []) > budget.get("maxOriginalCreates", -1):
        raise RuntimeError("Original create plan exceeds budget")
    if len(plan.get("derivatives") or []) > budget.get("maxDerivativeCreates", -1):
        raise RuntimeError("Derivative create plan exceeds budget")
    if progress.get("transformCount", 0) > budget.get("maxTransforms", -1):
        raise RuntimeError("Transform plan exceeds budget")


def public_result(result):
    return {
        "version": 1,
        "planDigest": result["planDigest"],
        "status": result["status"],
        "originalCreatedCount": result["originalCreatedCount"],
        "originalConcurrentExactSkipCount": result["originalConcurrentExactSkipCount"],
        "derivativeCreatedCount": result["derivativeCreatedCount"],
        "derivativeConcurrentExactSkipCount": result["derivativeConcurrentExactSkipCount"],
        "verifiedObjectCount": result["verifiedObjectCount"],
        "pendingObjectCount": result["pendingObjectCount"],
        "conflictCount": result["conflictCount"],
        "deletedObjectCount": 0,
        "copiedObjectCount": 0,
    }


def persist(path, result):
    Path(path).write_text(stable_json(public_result(result)), encoding="utf-8")


def apply_plan(client, bucket, plan, plan_path, output_path):
    root = Path(plan_path).resolve().parent
    _before, state_digest, _operations = normalize_metadata(client, bucket)
    if state_digest != plan.get("r2StateDigest"):
        raise RuntimeError("R2 state changed after planning; write count is zero")
    total = len(plan["originals"]) + len(plan["derivatives"])
    result = {
        "planDigest": plan["planDigest"], "status": "running",
        "originalCreatedCount": 0, "originalConcurrentExactSkipCount": 0,
        "derivativeCreatedCount": 0, "derivativeConcurrentExactSkipCount": 0,
        "verifiedObjectCount": 0, "pendingObjectCount": total, "conflictCount": 0,
    }
    persist(output_path, result)
    try:
        for item in plan["originals"]:
            outcome = create_original(client, bucket, root, item)
            result["originalCreatedCount" if outcome == "created" else "originalConcurrentExactSkipCount"] += 1
            result["verifiedObjectCount"] += 1
            result["pendingObjectCount"] -= 1
            persist(output_path, result)
        for item in plan["derivatives"]:
            outcome = RECONCILE.create_or_verify_object(client, bucket, RECONCILE.EXPECTED_BASE_URL, root, item, False)
            result["derivativeCreatedCount" if outcome == "created" else "derivativeConcurrentExactSkipCount"] += 1
            result["verifiedObjectCount"] += 1
            result["pendingObjectCount"] -= 1
            persist(output_path, result)
    except Exception:
        result["status"] = "partial_failure"
        result["conflictCount"] += 1
        persist(output_path, result)
        raise
    result["status"] = "complete"
    persist(output_path, result)
    return public_result(result)


def main():
    parser = argparse.ArgumentParser(description="Create-only public experience media recovery")
    parser.add_argument("--plan", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--confirm-digest", required=True)
    args = parser.parse_args()
    plan = json.loads(Path(args.plan).read_text(encoding="utf-8"))
    validate_plan(plan, args.confirm_digest)
    client, bucket = load_client()
    result = apply_plan(client, bucket, plan, args.plan, args.output)
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
