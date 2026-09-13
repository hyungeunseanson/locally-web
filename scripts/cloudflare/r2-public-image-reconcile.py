#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError


EXPECTED_BUCKET = "locally-public-experience-canary"
EXPECTED_BASE_URL = "https://media-canary.locally-travel.com"
PUBLIC_VERIFICATION_RETRY_DELAYS_SECONDS = (2, 4, 8, 16, 30, 30, 30, 30, 30, 30, 30, 30)
CONCURRENT_OBJECT_RETRY_DELAYS_SECONDS = (0.25, 0.5, 1, 2)
EXPECTED_CONTENT_TYPE = "image/webp"
EXPECTED_CACHE_CONTROL = "public, max-age=31536000, immutable"


def is_retryable_public_status(status):
    return status in (403, 404, 429) or 500 <= status <= 599


def require_environment(name):
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def load_configuration():
    endpoint = require_environment("R2_ENDPOINT")
    bucket = require_environment("R2_BUCKET")
    base_url = os.environ.get("R2_PUBLIC_BASE_URL", EXPECTED_BASE_URL).rstrip("/")
    if bucket != EXPECTED_BUCKET:
        raise RuntimeError(f"Refusing unexpected R2 bucket: {bucket}")
    if not re.fullmatch(r"https://[a-f0-9]{32}\.r2\.cloudflarestorage\.com", endpoint):
        raise RuntimeError("Refusing unexpected R2 endpoint")
    if base_url != EXPECTED_BASE_URL:
        raise RuntimeError(f"Refusing unexpected public R2 URL: {base_url}")
    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=require_environment("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=require_environment("R2_SECRET_ACCESS_KEY"),
        region_name="auto",
        config=Config(signature_version="s3v4", retries={"max_attempts": 5, "mode": "standard"}),
    )
    return client, bucket, base_url


def list_keys(client, bucket):
    keys = set()
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket):
        keys.update(item["Key"] for item in page.get("Contents", []))
    return keys


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sanitized_object_id(key):
    return hashlib.sha256(key.encode()).hexdigest()[:12]


def client_error_details(error):
    response = getattr(error, "response", {}) or {}
    error_payload = response.get("Error", {}) or {}
    metadata = response.get("ResponseMetadata", {}) or {}
    return str(error_payload.get("Code", "")), metadata.get("HTTPStatusCode")


def is_conditional_write_conflict(error):
    code, status = client_error_details(error)
    return code in {"PreconditionFailed", "ConditionalRequestConflict"} or status in {409, 412}


def is_not_found(error):
    code, status = client_error_details(error)
    return code in {"404", "NoSuchKey", "NotFound"} or status == 404


def read_stream_sha256(body):
    digest = hashlib.sha256()
    size = 0
    try:
        for chunk in iter(lambda: body.read(1024 * 1024), b""):
            digest.update(chunk)
            size += len(chunk)
    finally:
        close = getattr(body, "close", None)
        if close:
            close()
    return size, digest.hexdigest()


def verify_exact_r2_object(client, bucket, item, retry_delays=()):
    object_id = sanitized_object_id(item["key"])
    attempts = len(retry_delays) + 1
    for attempt in range(attempts):
        try:
            head = client.head_object(Bucket=bucket, Key=item["key"])
            if head.get("ContentLength") != item["bytes"]:
                raise RuntimeError(f"R2 object size conflict ({object_id})")
            if head.get("ContentType") != EXPECTED_CONTENT_TYPE:
                raise RuntimeError(f"R2 object Content-Type conflict ({object_id})")
            if head.get("CacheControl") != EXPECTED_CACHE_CONTROL:
                raise RuntimeError(f"R2 object Cache-Control conflict ({object_id})")
            metadata = head.get("Metadata") or {}
            if metadata.get("sha256") != item["sha256"]:
                raise RuntimeError(f"R2 object sha256 metadata conflict ({object_id})")
            response = client.get_object(Bucket=bucket, Key=item["key"])
            actual_size, actual_sha256 = read_stream_sha256(response["Body"])
            if actual_size != item["bytes"] or actual_sha256 != item["sha256"]:
                raise RuntimeError(f"R2 object byte conflict ({object_id})")
            return
        except ClientError as error:
            if is_not_found(error) and attempt < attempts - 1:
                time.sleep(retry_delays[attempt])
                continue
            raise RuntimeError(f"R2 object unavailable for exact verification ({object_id})") from error


def create_or_verify_object(client, bucket, base_url, root, item, existed_before):
    key = item["key"]
    object_id = sanitized_object_id(key)
    source = (root / item["path"]).resolve()
    if root not in source.parents or not source.is_file():
        raise RuntimeError(f"Unsafe or missing object path ({object_id})")
    if source.stat().st_size != item["bytes"] or sha256_file(source) != item["sha256"]:
        raise RuntimeError(f"Local object integrity mismatch ({object_id})")

    if existed_before:
        verify_exact_r2_object(client, bucket, item)
        verify_public_object(base_url, key, item["bytes"])
        return "concurrent_exact_skip"

    try:
        with source.open("rb") as body:
            client.put_object(
                Bucket=bucket,
                Key=key,
                Body=body,
                ContentLength=item["bytes"],
                ContentType=EXPECTED_CONTENT_TYPE,
                CacheControl=EXPECTED_CACHE_CONTROL,
                Metadata={"sha256": item["sha256"]},
                IfNoneMatch="*",
            )
    except ClientError as error:
        if not is_conditional_write_conflict(error):
            raise
        verify_exact_r2_object(
            client,
            bucket,
            item,
            retry_delays=CONCURRENT_OBJECT_RETRY_DELAYS_SECONDS,
        )
        verify_public_object(base_url, key, item["bytes"])
        return "concurrent_exact_skip"

    verify_exact_r2_object(client, bucket, item)
    verify_public_object(base_url, key, item["bytes"])
    return "created"


def append_github_output(name, value):
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf-8") as destination:
            destination.write(f"{name}={value}\n")


def verify_public_object(base_url, key, expected_size):
    attempts = len(PUBLIC_VERIFICATION_RETRY_DELAYS_SECONDS) + 1
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(f"{base_url}/{key}", method="HEAD")
            with urllib.request.urlopen(request, timeout=30) as response:
                if response.status != 200:
                    if is_retryable_public_status(response.status) and attempt < attempts - 1:
                        time.sleep(PUBLIC_VERIFICATION_RETRY_DELAYS_SECONDS[attempt])
                        continue
                    raise RuntimeError(f"HTTP {response.status}")
                content_type = response.headers.get("Content-Type", "").split(";", 1)[0]
                if content_type != EXPECTED_CONTENT_TYPE:
                    raise RuntimeError(f"unexpected content type {content_type}")
                content_length = response.headers.get("Content-Length")
                if content_length and int(content_length) != expected_size:
                    raise RuntimeError("content length mismatch")
                return
        except urllib.error.HTTPError as error:
            if is_retryable_public_status(error.code) and attempt < attempts - 1:
                time.sleep(PUBLIC_VERIFICATION_RETRY_DELAYS_SECONDS[attempt])
                continue
            raise RuntimeError(f"Public R2 verification failed for {key}: HTTP {error.code}") from error
        except (urllib.error.URLError, OSError) as error:
            raise RuntimeError(f"Public R2 verification failed for {key}: {error}") from error
    raise RuntimeError(f"Public R2 verification failed for {key}: retry limit exceeded")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("plan", "upload"), default="upload")
    parser.add_argument("--plan", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--expected")
    parser.add_argument("--missing")
    args = parser.parse_args()
    plan_path = Path(args.plan).resolve()
    root = plan_path.parent
    plan = json.loads(plan_path.read_text())
    if not isinstance(plan, list):
        raise RuntimeError("Object plan must be an array")
    plan_keys = {item["key"] for item in plan}
    if len(plan_keys) != len(plan):
        raise RuntimeError("Object plan contains duplicate keys")
    client, bucket, base_url = load_configuration()
    before = list_keys(client, bucket)

    if args.mode == "plan":
        if not plan:
            raise RuntimeError("Expected object specification plan is empty")
        missing_keys = sorted(plan_keys - before)
        result = {
            "expectedObjectCount": len(plan_keys),
            "existingObjectCount": len(plan_keys & before),
            "missingObjectCount": len(missing_keys),
            "missingKeys": missing_keys,
        }
        Path(args.output).write_text(json.dumps(result, indent=2) + "\n")
        append_github_output("expected_count", result["expectedObjectCount"])
        append_github_output("existing_count", result["existingObjectCount"])
        append_github_output("missing_count", result["missingObjectCount"])
        print(json.dumps(result, indent=2))
        return

    if not args.expected or not args.missing:
        raise RuntimeError("--expected and --missing are required in upload mode")
    expected_plan = json.loads(Path(args.expected).resolve().read_text())
    missing_plan = json.loads(Path(args.missing).resolve().read_text())
    if not isinstance(expected_plan, list) or not expected_plan:
        raise RuntimeError("Expected object specification plan is empty")
    expected_keys = {item["key"] for item in expected_plan}
    if len(expected_keys) != len(expected_plan):
        raise RuntimeError("Expected object specification plan contains duplicate keys")
    planned_missing_keys = missing_plan.get("missingKeys")
    if not isinstance(planned_missing_keys, list) or any(not isinstance(key, str) for key in planned_missing_keys):
        raise RuntimeError("Missing R2 object plan must contain a string array")
    if len(set(planned_missing_keys)) != len(planned_missing_keys):
        raise RuntimeError("Missing R2 object plan contains duplicate keys")
    if set(planned_missing_keys) - expected_keys:
        raise RuntimeError("Missing R2 object plan contains unexpected keys")
    if plan_keys != set(planned_missing_keys):
        raise RuntimeError("Transformed object plan does not match the planned missing R2 keys")
    newly_missing = (expected_keys - before) - plan_keys
    if newly_missing:
        raise RuntimeError(f"R2 changed during reconciliation; {len(newly_missing)} unplanned objects are now missing")
    created = []
    concurrent_exact_skips = []
    for item in plan:
        key = item["key"]
        outcome = create_or_verify_object(client, bucket, base_url, root, item, key in before)
        if outcome == "created":
            created.append(item)
        else:
            concurrent_exact_skips.append(item)
    after = list_keys(client, bucket)
    missing = sorted(expected_keys - after)
    if missing:
        raise RuntimeError(f"R2 parity failed; {len(missing)} expected objects are missing")
    result = {
        "expectedObjectCount": len(expected_keys),
        "existingObjectCount": len(expected_keys & before),
        "createdObjectCount": len(created),
        "uploadedObjectCount": len(created),
        "concurrentExactSkipCount": len(concurrent_exact_skips),
        "conflictCount": 0,
        "verifiedObjectCount": len(created) + len(concurrent_exact_skips),
        "verifiedUploadedObjectCount": len(created),
        "retainedExtraObjectCount": len(after - expected_keys),
        "deletedObjectCount": 0,
        "parity": True,
    }
    Path(args.output).write_text(json.dumps(result, indent=2) + "\n")
    append_github_output("uploaded_count", result["uploadedObjectCount"])
    append_github_output("created_count", result["createdObjectCount"])
    append_github_output("concurrent_exact_skip_count", result["concurrentExactSkipCount"])
    append_github_output("conflict_count", result["conflictCount"])
    append_github_output("verified_count", result["verifiedObjectCount"])
    append_github_output("verified_uploaded_count", result["verifiedUploadedObjectCount"])
    append_github_output("parity", str(result["parity"]).lower())
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ClientError, OSError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
