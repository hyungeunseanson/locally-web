#!/usr/bin/env python3
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
import re
import sys
import threading
import urllib.parse
import urllib.request
from pathlib import Path


EXPECTED_ACCOUNT_ID = "d56f5f850c6f7dc5779a7c2054aca5a5"
EXPECTED_BUCKET = "locally-public-experience-canary"
EXPECTED_ENDPOINT = f"https://{EXPECTED_ACCOUNT_ID}.r2.cloudflarestorage.com"
EXPECTED_DERIVATIVE_CACHE_CONTROL = "public, max-age=31536000, immutable"
PROVENANCE_FIELDS = (
    "source_key_sha256",
    "source_byte_sha256",
    "output_byte_sha256",
    "transform_width",
    "transform_quality",
    "transform_format",
    "sharp_version",
    "libvips_version",
    "runtime_id",
    "generated_at",
)


def require_environment(name):
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def identity_hash(value):
    return hashlib.sha256(("locally-public-experience-media-v1\0" + value).encode()).hexdigest()


def identity_set_digest(values):
    digest = hashlib.sha256()
    for value in sorted(values):
        digest.update(bytes.fromhex(identity_hash(value)))
    return digest.hexdigest()


class S3ReadOnlyClient:
    def __init__(self, client):
        self.client = client
        self.operations = {"listRequests": 0, "headRequests": 0, "getRequests": 0, "mutationRequests": 0}
        self.lock = threading.Lock()

    def _record(self, name, count=1):
        with self.lock:
            self.operations[name] += count

    def list_metadata(self, bucket):
        result = []
        paginator = self.client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=bucket):
            self._record("listRequests")
            for item in page.get("Contents", []):
                self._record("headRequests")
                head = self.client.head_object(Bucket=bucket, Key=item["Key"])
                result.append({
                    "key": item["Key"],
                    "size": int(item.get("Size", head.get("ContentLength", 0))),
                    "etag": str(item.get("ETag", head.get("ETag", ""))).strip('"'),
                    "contentType": head.get("ContentType", ""),
                    "cacheControl": head.get("CacheControl", ""),
                    "customMetadata": head.get("Metadata", {}) or {},
                })
        return result

    def get_bytes(self, bucket, key):
        self._record("getRequests")
        body = self.client.get_object(Bucket=bucket, Key=key)["Body"]
        digest = hashlib.sha256()
        size = 0
        while True:
            chunk = body.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            digest.update(chunk)
        return size, digest.hexdigest()


class CloudflareApiReadOnlyClient:
    def __init__(self, token, account_id):
        self.token = token
        self.account_id = account_id
        self.operations = {"listRequests": 0, "headRequests": 0, "getRequests": 0, "mutationRequests": 0}
        self.lock = threading.Lock()

    def _record(self, name, count=1):
        with self.lock:
            self.operations[name] += count

    def _request(self, url):
        request = urllib.request.Request(url, headers={"Authorization": f"Bearer {self.token}"}, method="GET")
        return urllib.request.urlopen(request, timeout=60)

    def list_metadata(self, bucket):
        result = []
        cursor = None
        while True:
            query = {"per_page": "1000"}
            if cursor:
                query["cursor"] = cursor
            url = (
                f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/r2/buckets/"
                f"{urllib.parse.quote(bucket, safe='')}/objects?{urllib.parse.urlencode(query)}"
            )
            self._record("listRequests")
            with self._request(url) as response:
                payload = json.load(response)
            if not payload.get("success"):
                raise RuntimeError("Cloudflare R2 LIST failed")
            for item in payload.get("result", []):
                http = item.get("http_metadata") or {}
                result.append({
                    "key": item["key"],
                    "size": int(item.get("size", 0)),
                    "etag": str(item.get("etag", "")).strip('"'),
                    "contentType": http.get("contentType", ""),
                    "cacheControl": http.get("cacheControl", ""),
                    "customMetadata": item.get("custom_metadata") or {},
                })
            info = payload.get("result_info") or {}
            if not info.get("is_truncated"):
                break
            cursor = info.get("cursor")
            if not cursor:
                raise RuntimeError("Cloudflare R2 LIST omitted its pagination cursor")
        return result

    def get_bytes(self, bucket, key):
        encoded_key = urllib.parse.quote(key, safe="/")
        url = (
            f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/r2/buckets/"
            f"{urllib.parse.quote(bucket, safe='')}/objects/{encoded_key}"
        )
        self._record("getRequests")
        digest = hashlib.sha256()
        size = 0
        with self._request(url) as response:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                digest.update(chunk)
        return size, digest.hexdigest()


def load_client():
    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID", EXPECTED_ACCOUNT_ID).strip()
    bucket = require_environment("R2_BUCKET")
    if account_id != EXPECTED_ACCOUNT_ID:
        raise RuntimeError("Refusing unexpected Cloudflare account")
    if bucket != EXPECTED_BUCKET:
        raise RuntimeError("Refusing unexpected R2 bucket")
    api_token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    if api_token:
        return CloudflareApiReadOnlyClient(api_token, account_id), bucket, "cloudflare-api"
    endpoint = require_environment("R2_ENDPOINT").rstrip("/")
    if endpoint != EXPECTED_ENDPOINT:
        raise RuntimeError("Refusing unexpected R2 endpoint")
    import boto3
    from botocore.config import Config
    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=require_environment("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=require_environment("R2_SECRET_ACCESS_KEY"),
        region_name="auto",
        config=Config(signature_version="s3v4", retries={"max_attempts": 5, "mode": "standard"}),
    )
    return S3ReadOnlyClient(client), bucket, "s3"


def classify_key(key, expected, known_manifest_keys):
    if key in expected:
        return "expectedCard" if expected[key]["kind"] == "card" else "expectedDetail"
    if key in known_manifest_keys:
        return "staleKnownDerivative"
    if key.startswith("originals/"):
        return "original"
    return "unclassifiedExtra"


def audit(client, bucket, plan, mode):
    expected_entries = plan.get("expected")
    known_manifest_keys = plan.get("knownManifestKeys")
    expected_original_hashes = plan.get("publicActiveOriginalSourceKeyHashes")
    if not isinstance(expected_entries, list) or not isinstance(known_manifest_keys, list) or not isinstance(expected_original_hashes, list):
        raise RuntimeError("Invalid audit plan")
    expected = {item["key"]: item for item in expected_entries}
    if len(expected) != len(expected_entries) or len(set(known_manifest_keys)) != len(known_manifest_keys):
        raise RuntimeError("Audit plan contains duplicate keys")
    if len(set(expected_original_hashes)) != len(expected_original_hashes) or any(not re.fullmatch(r"[0-9a-f]{64}", value or "") for value in expected_original_hashes):
        raise RuntimeError("Audit plan contains invalid original source identities")
    objects = client.list_metadata(bucket)
    actual = {item["key"]: item for item in objects}
    if len(actual) != len(objects):
        raise RuntimeError("R2 LIST returned duplicate keys")

    taxonomy = {name: 0 for name in ("expectedCard", "expectedDetail", "staleKnownDerivative", "unclassifiedExtra", "original")}
    for key in actual:
        taxonomy[classify_key(key, expected, set(known_manifest_keys))] += 1
    missing_card = sum(1 for key, item in expected.items() if item["kind"] == "card" and key not in actual)
    missing_detail = sum(1 for key, item in expected.items() if item["kind"] == "detail" and key not in actual)
    expected_objects = [actual[key] for key in expected if key in actual]
    cache_mismatch = sum(1 for item in expected_objects if item.get("cacheControl") != EXPECTED_DERIVATIVE_CACHE_CONTROL)
    type_mismatch = sum(1 for item in expected_objects if str(item.get("contentType", "")).split(";", 1)[0].lower() != "image/webp")
    etag_coverage = sum(1 for item in objects if item.get("etag"))
    size_coverage = sum(1 for item in objects if isinstance(item.get("size"), int) and item["size"] >= 0)
    sha_coverage = sum(1 for item in objects if (item.get("customMetadata") or {}).get("sha256"))
    expected_sha_coverage = sum(1 for item in expected_objects if re.fullmatch(r"[0-9a-f]{64}", (item.get("customMetadata") or {}).get("sha256", "")))
    original_objects = [item for item in objects if classify_key(item["key"], expected, set(known_manifest_keys)) == "original"]
    original_hashes = [
        (item.get("customMetadata") or {}).get("source_key_sha256", "")
        for item in original_objects
    ]
    valid_original_hashes = [value for value in original_hashes if re.fullmatch(r"[0-9a-f]{64}", value)]
    expected_original_set = set(expected_original_hashes)
    actual_original_set = set(valid_original_hashes)
    provenance_coverage = {
        field: sum(1 for item in objects if (item.get("customMetadata") or {}).get(field))
        for field in PROVENANCE_FIELDS
    }

    downloaded = {"downloadedCount": 0, "downloadedBytes": 0, "verifiedCount": 0, "unverifiableMetadataCount": 0, "mismatchCount": 0, "sizeMismatchCount": 0}
    if mode == "full":
        def download(key):
            try:
                size, digest = client.get_bytes(bucket, key)
            except Exception as error:
                raise RuntimeError(f"R2 GET failed; identity={identity_hash(key)[:16]}") from error
            item = actual[key]
            stored_sha = (item.get("customMetadata") or {}).get("sha256")
            return size, digest, item["size"], stored_sha

        with ThreadPoolExecutor(max_workers=8) as executor:
            results = executor.map(download, sorted(actual))
            for size, digest, metadata_size, stored_sha in results:
                downloaded["downloadedCount"] += 1
                downloaded["downloadedBytes"] += size
                if size != metadata_size:
                    downloaded["sizeMismatchCount"] += 1
                if not stored_sha:
                    downloaded["unverifiableMetadataCount"] += 1
                elif stored_sha == digest:
                    downloaded["verifiedCount"] += 1
                else:
                    downloaded["mismatchCount"] += 1

    report = {
        "transport": "read-only",
        "actual": {"objectCount": len(objects), "bytes": sum(item["size"] for item in objects)},
        "expected": {
            "total": len(expected),
            "card": sum(1 for item in expected.values() if item["kind"] == "card"),
            "detail": sum(1 for item in expected.values() if item["kind"] == "detail"),
        },
        "expectedMissing": {"total": missing_card + missing_detail, "card": missing_card, "detail": missing_detail},
        "taxonomy": taxonomy,
        "metadata": {
            "sizeCoverage": size_coverage,
            "etagCoverage": etag_coverage,
            "customShaCoverage": sha_coverage,
            "expectedCustomShaCoverage": expected_sha_coverage,
            "cacheControlMismatchCount": cache_mismatch,
            "contentTypeMismatchCount": type_mismatch,
            "provenanceCoverage": provenance_coverage,
        },
        "originalIdentityCoverage": {
            "expectedCount": len(expected_original_set),
            "actualObjectCount": len(original_objects),
            "sourceKeyMetadataCoverage": len(valid_original_hashes),
            "matchingExpectedCount": len(expected_original_set & actual_original_set),
            "missingCount": len(expected_original_set - actual_original_set),
            "unexpectedCount": len(actual_original_set - expected_original_set),
            "duplicateSourceKeyCount": len(valid_original_hashes) - len(actual_original_set),
            "invalidSourceKeyMetadataCount": len(original_hashes) - len(valid_original_hashes),
        },
        "downloadedShaVerification": downloaded,
        "identitySetDigests": {
            "actual": identity_set_digest(actual),
            "expected": identity_set_digest(expected),
            "missing": identity_set_digest(set(expected) - set(actual)),
        },
        "readOperations": dict(client.operations),
    }
    serialized = json.dumps(report)
    if "http" in serialized.lower() or any(key in serialized for key in actual):
        raise RuntimeError("R2 report leaked an object key or URL")
    return report


def main():
    parser = argparse.ArgumentParser(description="Read-only R2 public experience media audit")
    parser.add_argument("--mode", choices=("metadata", "full"), required=True)
    parser.add_argument("--plan", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    plan = json.loads(Path(args.plan).read_text(encoding="utf-8"))
    client, bucket, _transport = load_client()
    report = audit(client, bucket, plan, args.mode)
    Path(args.output).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "mode": args.mode,
        "objectCount": report["actual"]["objectCount"],
        "expectedMissing": report["expectedMissing"]["total"],
        "mutationRequests": report["readOperations"]["mutationRequests"],
    }))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
