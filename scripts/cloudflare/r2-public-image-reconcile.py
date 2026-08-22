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


def verify_public_object(base_url, key, expected_size):
    last_error = None
    for attempt in range(6):
        try:
            request = urllib.request.Request(f"{base_url}/{key}", method="HEAD")
            with urllib.request.urlopen(request, timeout=30) as response:
                if response.status != 200:
                    raise RuntimeError(f"HTTP {response.status}")
                content_type = response.headers.get("Content-Type", "").split(";", 1)[0]
                if content_type != "image/webp":
                    raise RuntimeError(f"unexpected content type {content_type}")
                content_length = response.headers.get("Content-Length")
                if content_length and int(content_length) != expected_size:
                    raise RuntimeError("content length mismatch")
                return
        except (RuntimeError, urllib.error.HTTPError, urllib.error.URLError, OSError) as error:
            last_error = error
            if attempt < 5:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"Public R2 verification failed for {key}: {last_error}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    plan_path = Path(args.plan).resolve()
    root = plan_path.parent
    objects = json.loads(plan_path.read_text())
    if not isinstance(objects, list) or not objects:
        raise RuntimeError("Object plan is empty")
    expected_keys = {item["key"] for item in objects}
    if len(expected_keys) != len(objects):
        raise RuntimeError("Object plan contains duplicate keys")
    client, bucket, base_url = load_configuration()
    before = list_keys(client, bucket)
    uploaded = []
    for item in objects:
        key = item["key"]
        source = (root / item["path"]).resolve()
        if root not in source.parents or not source.is_file():
            raise RuntimeError(f"Unsafe or missing object path for {key}")
        if source.stat().st_size != item["bytes"] or sha256_file(source) != item["sha256"]:
            raise RuntimeError(f"Local object integrity mismatch for {key}")
        if key in before:
            continue
        client.upload_file(
            str(source),
            bucket,
            key,
            ExtraArgs={
                "ContentType": "image/webp",
                "CacheControl": "public, max-age=31536000, immutable",
                "Metadata": {"sha256": item["sha256"]},
            },
        )
        uploaded.append(item)
    after = list_keys(client, bucket)
    missing = sorted(expected_keys - after)
    if missing:
        raise RuntimeError(f"R2 parity failed; {len(missing)} expected objects are missing")
    verification_directory = root / "download-verification"
    verification_directory.mkdir(exist_ok=True)
    for item in uploaded:
        destination = verification_directory / hashlib.sha256(item["key"].encode()).hexdigest()
        client.download_file(bucket, item["key"], str(destination))
        if destination.stat().st_size != item["bytes"] or sha256_file(destination) != item["sha256"]:
            raise RuntimeError(f"Downloaded R2 object integrity mismatch for {item['key']}")
        verify_public_object(base_url, item["key"], item["bytes"])
        destination.unlink()
    result = {
        "expectedObjectCount": len(expected_keys),
        "existingObjectCount": len(expected_keys & before),
        "uploadedObjectCount": len(uploaded),
        "verifiedUploadedObjectCount": len(uploaded),
        "retainedExtraObjectCount": len(after - expected_keys),
        "deletedObjectCount": 0,
        "parity": True,
    }
    Path(args.output).write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ClientError, OSError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
