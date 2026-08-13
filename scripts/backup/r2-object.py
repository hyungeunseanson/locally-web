#!/usr/bin/env python3
import os
import sys

import boto3
from botocore.config import Config


def require_environment(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise SystemExit(f"missing environment variable: {name}")
    return value


if len(sys.argv) != 4 or sys.argv[1] not in {"put", "get"}:
    raise SystemExit("usage: r2-object.py put|get LOCAL_FILE OBJECT_KEY")

operation, local_file, object_key = sys.argv[1:]
bucket = require_environment("R2_BUCKET")

client = boto3.client(
    "s3",
    endpoint_url=require_environment("R2_ENDPOINT"),
    aws_access_key_id=require_environment("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=require_environment("AWS_SECRET_ACCESS_KEY"),
    region_name="auto",
    config=Config(signature_version="s3v4", retries={"max_attempts": 5, "mode": "standard"}),
)

if operation == "put":
    expected_size = os.path.getsize(local_file)
    with open(local_file, "rb") as source_file:
        client.put_object(
            Bucket=bucket,
            Key=object_key,
            Body=source_file,
            ContentType="application/octet-stream",
        )
    uploaded_size = client.head_object(Bucket=bucket, Key=object_key)["ContentLength"]
    if uploaded_size != expected_size:
        raise SystemExit(
            f"R2 object size mismatch for {object_key}: local={expected_size} remote={uploaded_size}"
        )
    print(f"R2_PUT_AND_SIZE_PASS {object_key} {uploaded_size}")
else:
    response = client.get_object(Bucket=bucket, Key=object_key)
    with open(local_file, "wb") as destination_file:
        for chunk in iter(lambda: response["Body"].read(1024 * 1024), b""):
            destination_file.write(chunk)
    expected_size = response["ContentLength"]
    downloaded_size = os.path.getsize(local_file)
    if downloaded_size != expected_size:
        raise SystemExit(
            f"R2 download size mismatch for {object_key}: remote={expected_size} local={downloaded_size}"
        )
    print(f"R2_GET_AND_SIZE_PASS {object_key} {downloaded_size}")
