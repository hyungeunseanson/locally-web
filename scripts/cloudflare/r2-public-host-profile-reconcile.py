#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError


ACTIVE_BUCKET = "locally-public-host-profiles"
STALE_BUCKET = "locally-private-host-profile-stale"
PUBLIC_BASE_URL = "https://profiles-media.locally-travel.com"
ENDPOINT_PATTERN = re.compile(r"https://[a-f0-9]{32}\.r2\.cloudflarestorage\.com")
HOST_ID_PATTERN = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
ACTIVE_KEY_PATTERN = re.compile(
    r"hosts/(?P<host_id>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/"
    r"(?P<url_hash>[a-f0-9]{12})/avatar-w(?P<width>128|256)-q80\.webp"
)
PUBLIC_RETRY_DELAYS = (2, 4, 8, 16, 30, 30, 30, 30, 30, 30, 30, 30, 30)
PUBLIC_VERIFY_USER_AGENT = "Locally-R2-Reconciliation/1.0"
IMMUTABLE_CACHE_CONTROL = "public, max-age=86400, immutable"
TRANSFORM_SCHEMA = "public-host-profile-v1"
MAX_EXPECTED_OBJECTS = 512
MAX_NEW_BODY_BYTES = 256 * 1024 * 1024


def require_environment(name):
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def validate_host_id(host_id):
    if not HOST_ID_PATTERN.fullmatch(host_id or ""):
        raise RuntimeError("Host id must be a canonical lowercase UUID")
    return host_id


def make_client(access_key_name, secret_name):
    endpoint = require_environment("R2_ENDPOINT")
    if not ENDPOINT_PATTERN.fullmatch(endpoint):
        raise RuntimeError("Refusing unexpected R2 endpoint")
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=require_environment(access_key_name),
        aws_secret_access_key=require_environment(secret_name),
        region_name="auto",
        config=Config(signature_version="s3v4", retries={"max_attempts": 5, "mode": "standard"}),
    )


def load_clients():
    if os.environ.get("ACTIVE_R2_BUCKET", ACTIVE_BUCKET) != ACTIVE_BUCKET:
        raise RuntimeError("Refusing unexpected active R2 bucket")
    if os.environ.get("STALE_R2_BUCKET", STALE_BUCKET) != STALE_BUCKET:
        raise RuntimeError("Refusing unexpected stale R2 bucket")
    if os.environ.get("R2_PUBLIC_BASE_URL", PUBLIC_BASE_URL).rstrip("/") != PUBLIC_BASE_URL:
        raise RuntimeError("Refusing unexpected public profile domain")
    return (
        make_client("ACTIVE_R2_ACCESS_KEY_ID", "ACTIVE_R2_SECRET_ACCESS_KEY"),
        make_client("STALE_R2_ACCESS_KEY_ID", "STALE_R2_SECRET_ACCESS_KEY"),
    )


def list_keys(client, bucket, prefix=""):
    keys = set()
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        keys.update(item["Key"] for item in page.get("Contents", []))
    return keys


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def append_github_output(name, value):
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf-8") as destination:
            destination.write(f"{name}={value}\n")


def write_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def is_retryable_public_status(status):
    return status in (403, 404, 429) or 500 <= status <= 599


def verify_public_object(key, expected_size):
    attempts = len(PUBLIC_RETRY_DELAYS) + 1
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(
                f"{PUBLIC_BASE_URL}/{key}",
                headers={"User-Agent": PUBLIC_VERIFY_USER_AGENT},
                method="HEAD",
            )
            with urllib.request.urlopen(request, timeout=30) as response:
                if response.status != 200:
                    if is_retryable_public_status(response.status) and attempt < attempts - 1:
                        time.sleep(PUBLIC_RETRY_DELAYS[attempt])
                        continue
                    raise RuntimeError(f"HTTP {response.status}")
                content_type = response.headers.get("Content-Type", "").split(";", 1)[0]
                if content_type != "image/webp":
                    raise RuntimeError(f"unexpected content type {content_type}")
                content_length = response.headers.get("Content-Length")
                if content_length and int(content_length) != expected_size:
                    raise RuntimeError("content length mismatch")
                return
        except urllib.error.HTTPError as error:
            if is_retryable_public_status(error.code) and attempt < attempts - 1:
                time.sleep(PUBLIC_RETRY_DELAYS[attempt])
                continue
            raise RuntimeError(f"Public profile verification failed for {key}: HTTP {error.code}") from error
        except (urllib.error.URLError, OSError) as error:
            raise RuntimeError(f"Public profile verification failed for {key}: {error}") from error
    raise RuntimeError(f"Public profile verification failed for {key}: retry limit exceeded")


def validate_expected_plan(plan):
    if not isinstance(plan, list) or not plan or len(plan) > MAX_EXPECTED_OBJECTS:
        raise RuntimeError("Expected profile object plan must be a non-empty array")
    keys = set()
    for item in plan:
        key = item.get("key")
        host_id = item.get("hostId")
        match = ACTIVE_KEY_PATTERN.fullmatch(key or "")
        if not match or match.group("host_id") != host_id:
            raise RuntimeError("Expected profile object plan contains an unsafe key")
        if item.get("width") not in (128, 256) or item.get("quality") != 80:
            raise RuntimeError("Expected profile object plan contains an unsupported transform")
        if item.get("sourceKind") not in ("application-profile", "public-profile-avatar"):
            raise RuntimeError("Expected profile object plan contains an unsupported source kind")
        if key in keys:
            raise RuntimeError("Expected profile object plan contains duplicate keys")
        keys.add(key)
    return keys


def head_object_integrity(client, bucket, key, require_cache=False):
    response = client.head_object(Bucket=bucket, Key=key)
    content_type = response.get("ContentType", "").split(";", 1)[0]
    if content_type != "image/webp":
        raise RuntimeError(f"Unexpected R2 content type for {key}")
    size = int(response.get("ContentLength", 0))
    if size <= 0:
        raise RuntimeError(f"Empty R2 object for {key}")
    cache_control = response.get("CacheControl", "")
    if require_cache and cache_control != IMMUTABLE_CACHE_CONTROL:
        raise RuntimeError(f"Unexpected R2 cache control for {key}")
    return size, response.get("Metadata", {}).get("sha256", "")


def get_object_bytes(client, bucket, key):
    response = client.get_object(Bucket=bucket, Key=key)
    body = response["Body"]
    return body.read() if hasattr(body, "read") else bytes(body)


def derivative_metadata(item):
    return {
        "sha256": item["sha256"],
        "host-id": item["hostId"],
        "source-identity": item["sourceIdentityHash"],
        "source-sha256": item["sourceSha256"],
        "source-bytes": str(item["sourceBytes"]),
        "source-kind": item["sourceKind"],
        "transform-schema": TRANSFORM_SCHEMA,
        "transform-engine": "sharp",
        "output-format": "webp",
        "width": str(item["width"]),
        "quality": str(item["quality"]),
    }


def validate_existing_derivative(client, item):
    key = item["key"]
    response = client.head_object(Bucket=ACTIVE_BUCKET, Key=key)
    if response.get("ContentType", "").split(";", 1)[0] != "image/webp":
        raise RuntimeError(f"Concurrent profile object content type conflict for {key}")
    if response.get("CacheControl", "") != IMMUTABLE_CACHE_CONTROL:
        raise RuntimeError(f"Concurrent profile object cache control conflict for {key}")
    body = get_object_bytes(client, ACTIVE_BUCKET, key)
    digest = hashlib.sha256(body).hexdigest()
    metadata = response.get("Metadata", {})
    if len(body) != item["bytes"] or digest != item["sha256"] or metadata.get("sha256") != digest:
        raise RuntimeError(f"Concurrent profile object byte conflict for {key}")
    expected = derivative_metadata(item)
    provenance_keys = set(expected) - {"sha256", "host-id"}
    present = provenance_keys & set(metadata)
    if present and any(metadata.get(name) != expected[name] for name in provenance_keys):
        raise RuntimeError(f"Concurrent profile object provenance conflict for {key}")
    if metadata.get("host-id") not in (None, "", item["hostId"]):
        raise RuntimeError(f"Concurrent profile object host conflict for {key}")
    return len(body)


def is_precondition_failure(error):
    response = getattr(error, "response", {}) or {}
    code = str(response.get("Error", {}).get("Code", ""))
    status = response.get("ResponseMetadata", {}).get("HTTPStatusCode")
    return code in {"PreconditionFailed", "412", "ConditionalRequestConflict"} or status == 412


def conditional_create_derivative(client, source, item):
    with source.open("rb") as body:
        try:
            client.put_object(
                Bucket=ACTIVE_BUCKET,
                Key=item["key"],
                Body=body,
                IfNoneMatch="*",
                ContentType="image/webp",
                CacheControl=IMMUTABLE_CACHE_CONTROL,
                Metadata=derivative_metadata(item),
            )
            return "created"
        except ClientError as error:
            if not is_precondition_failure(error):
                raise
    validate_existing_derivative(client, item)
    return "concurrent-exact-skip"


def transfer_between_buckets(source_client, source_bucket, destination_client, destination_bucket, key):
    with tempfile.TemporaryDirectory() as directory:
        local = Path(directory) / hashlib.sha256(key.encode()).hexdigest()
        source_client.download_file(source_bucket, key, str(local))
        source_size, source_sha = head_object_integrity(source_client, source_bucket, key)
        downloaded_sha = sha256_file(local)
        if local.stat().st_size != source_size or (source_sha and downloaded_sha != source_sha):
            raise RuntimeError(f"Source R2 integrity mismatch for {key}")
        with local.open("rb") as body:
            try:
                arguments = {
                    "Bucket": destination_bucket,
                    "Key": key,
                    "Body": body,
                    "IfNoneMatch": "*",
                    "ContentType": "image/webp",
                    "Metadata": {"sha256": downloaded_sha},
                }
                if destination_bucket == ACTIVE_BUCKET:
                    arguments["CacheControl"] = IMMUTABLE_CACHE_CONTROL
                destination_client.put_object(**arguments)
            except ClientError as error:
                if not is_precondition_failure(error):
                    raise
        destination_size, destination_sha = head_object_integrity(destination_client, destination_bucket, key)
        destination_bytes = get_object_bytes(destination_client, destination_bucket, key)
        if destination_size != source_size or destination_sha != downloaded_sha or hashlib.sha256(destination_bytes).hexdigest() != downloaded_sha:
            raise RuntimeError(f"Destination R2 integrity mismatch for {key}")
        return source_size


def archive_for_privacy_purge(active_client, stale_client, key):
    """Keep an exact private copy until public cache purge succeeds.

    Legacy objects inside a validated host namespace are intentionally accepted:
    privacy deletion must not fail closed merely because an old filename does not
    match today's image variant format.
    """
    with tempfile.TemporaryDirectory() as directory:
        local = Path(directory) / hashlib.sha256(key.encode()).hexdigest()
        source = active_client.head_object(Bucket=ACTIVE_BUCKET, Key=key)
        active_client.download_file(ACTIVE_BUCKET, key, str(local))
        source_size = int(source.get("ContentLength", 0))
        if source_size <= 0 or local.stat().st_size != source_size:
            raise RuntimeError(f"Unable to archive active profile object before purge: {key}")
        digest = sha256_file(local)
        stale_client.upload_file(
            str(local),
            STALE_BUCKET,
            key,
            ExtraArgs={
                "ContentType": source.get("ContentType") or "application/octet-stream",
                "Metadata": {"sha256": digest, "privacy-purge-copy": "true"},
            },
        )
        archived = stale_client.head_object(Bucket=STALE_BUCKET, Key=key)
        if int(archived.get("ContentLength", 0)) != source_size:
            raise RuntimeError(f"Private purge archive integrity mismatch for {key}")


def plan_mode(args, active_client, stale_client, plan):
    expected_keys = validate_expected_plan(plan)
    active_keys = list_keys(active_client, ACTIVE_BUCKET)
    stale_keys = list_keys(stale_client, STALE_BUCKET)
    unexpected_active = sorted(key for key in active_keys if not ACTIVE_KEY_PATTERN.fullmatch(key))
    if unexpected_active:
        raise RuntimeError(f"Active profile bucket contains {len(unexpected_active)} unexpected keys")
    missing_active = expected_keys - active_keys
    restore_keys = [] if args.create_only_plan else sorted(missing_active & stale_keys)
    transform_keys = sorted(missing_active if args.create_only_plan else missing_active - set(restore_keys))
    stale_candidates = sorted((active_keys - expected_keys))
    metadata_conflicts = []
    metadata_consistent = 0
    for item in plan:
        if item["key"] not in active_keys:
            continue
        try:
            response = active_client.head_object(Bucket=ACTIVE_BUCKET, Key=item["key"])
            metadata = response.get("Metadata", {})
            if response.get("ContentType", "").split(";", 1)[0] != "image/webp":
                raise RuntimeError("content-type")
            if response.get("CacheControl", "") != IMMUTABLE_CACHE_CONTROL:
                raise RuntimeError("cache-control")
            if not re.fullmatch(r"[a-f0-9]{64}", metadata.get("sha256", "")):
                raise RuntimeError("sha256")
            if metadata.get("host-id") not in (None, "", item["hostId"]):
                raise RuntimeError("host-id")
            metadata_consistent += 1
        except (RuntimeError, ClientError, KeyError):
            metadata_conflicts.append(item["key"])
    execution_payload = {
        "version": 2,
        "expected": plan,
        "missingKeys": transform_keys,
        "existingKeys": sorted(expected_keys & active_keys),
        "metadataConflictKeys": metadata_conflicts,
        "staleCandidateKeys": stale_candidates,
        "snapshotHash": args.snapshot_hash,
        "budgets": {
            "maxSourceObjects": 256,
            "maxSourceBytes": 256 * 1024 * 1024,
            "maxTransforms": 512,
            "maxNewObjects": 512,
            "maxNewBodyBytes": MAX_NEW_BODY_BYTES,
        },
        "r2StateDigest": hashlib.sha256("\n".join(sorted(active_keys)).encode()).hexdigest(),
    }
    plan_digest = hashlib.sha256(json.dumps(execution_payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    result = {
        "expectedObjectCount": len(expected_keys),
        "existingActiveObjectCount": len(expected_keys & active_keys),
        "restoreObjectCount": len(restore_keys),
        "missingObjectCount": len(transform_keys),
        "missingKeys": transform_keys,
        "restoreKeys": restore_keys,
        "staleCandidateCount": len(stale_candidates),
        "staleCandidateKeys": stale_candidates,
        "metadataConsistentObjectCount": metadata_consistent,
        "metadataConflictCount": len(metadata_conflicts),
        "metadataConflictKeys": metadata_conflicts,
        "executionPayload": execution_payload,
        "planDigest": plan_digest,
    }
    write_json(args.output, result)
    for name, value in {
        "expected_count": result["expectedObjectCount"],
        "existing_count": result["existingActiveObjectCount"],
        "restore_count": result["restoreObjectCount"],
        "missing_count": result["missingObjectCount"],
        "stale_candidate_count": result["staleCandidateCount"],
        "metadata_conflict_count": result["metadataConflictCount"],
        "plan_digest": result["planDigest"],
    }.items():
        append_github_output(name, value)
    print(json.dumps({
        "expectedObjectCount": result["expectedObjectCount"],
        "existingActiveObjectCount": result["existingActiveObjectCount"],
        "metadataConsistentObjectCount": result["metadataConsistentObjectCount"],
        "metadataConflictCount": result["metadataConflictCount"],
        "missingObjectCount": result["missingObjectCount"],
        "restoreObjectCount": result["restoreObjectCount"],
        "staleCandidateCount": result["staleCandidateCount"],
        "planDigest": result["planDigest"],
    }, indent=2))


def apply_mode(args, active_client, stale_client, transformed_plan, expected_plan, object_plan, create_only=False):
    expected_keys = validate_expected_plan(expected_plan)
    missing_keys = object_plan.get("missingKeys")
    restore_keys = object_plan.get("restoreKeys")
    stale_candidates = object_plan.get("staleCandidateKeys")
    if not all(isinstance(value, list) for value in (missing_keys, restore_keys, stale_candidates)):
        raise RuntimeError("R2 profile plan is malformed")
    transformed_keys = {item.get("key") for item in transformed_plan}
    if transformed_keys != set(missing_keys):
        raise RuntimeError("Transformed profile objects do not match the missing plan")
    if (set(restore_keys) | set(missing_keys)) - expected_keys:
        raise RuntimeError("Restore or missing plan contains unexpected keys")
    if any(not ACTIVE_KEY_PATTERN.fullmatch(key) for key in stale_candidates):
        raise RuntimeError("Stale plan contains an unsafe active key")
    expected_by_key = {item["key"]: item for item in expected_plan}
    for item in transformed_plan:
        specification = expected_by_key.get(item.get("key"))
        if not specification:
            raise RuntimeError("Transformed profile object is outside the expected plan")
        expected_identity = hashlib.sha256(specification["originUrl"].encode()).hexdigest()
        if (
            item.get("hostId") != specification["hostId"]
            or item.get("sourceKind") != specification["sourceKind"]
            or item.get("width") != specification["width"]
            or item.get("quality") != specification["quality"]
            or item.get("sourceIdentityHash") != expected_identity
            or not re.fullmatch(r"[a-f0-9]{64}", item.get("sourceSha256", ""))
            or not isinstance(item.get("sourceBytes"), int)
            or item["sourceBytes"] <= 0
        ):
            raise RuntimeError("Transformed profile provenance does not match the approved source/spec")
    if object_plan.get("planDigest") != args.confirm_digest:
        raise RuntimeError("Confirmed profile plan digest does not match")
    payload = object_plan.get("executionPayload")
    if not isinstance(payload, dict):
        raise RuntimeError("Profile execution payload is missing")
    calculated_digest = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    if (
        calculated_digest != object_plan.get("planDigest")
        or payload.get("expected") != expected_plan
        or payload.get("missingKeys") != missing_keys
        or payload.get("metadataConflictKeys") != object_plan.get("metadataConflictKeys")
        or payload.get("staleCandidateKeys") != stale_candidates
    ):
        raise RuntimeError("Profile execution payload was modified after approval")
    if object_plan.get("metadataConflictCount") != 0:
        raise RuntimeError("Existing profile metadata conflicts prevent apply")
    if len(missing_keys) > 512 or sum(int(item.get("bytes", 0)) for item in transformed_plan) > MAX_NEW_BODY_BYTES:
        raise RuntimeError("Profile apply exceeds the approved write budget")
    active_now = list_keys(active_client, ACTIVE_BUCKET)
    current_state_digest = hashlib.sha256("\n".join(sorted(active_now)).encode()).hexdigest()
    if current_state_digest != payload.get("r2StateDigest"):
        raise RuntimeError("Active profile R2 inventory changed after approval")

    if create_only and restore_keys:
        raise RuntimeError("Create-only profile apply refuses private restore candidates")

    restored = []
    for key in restore_keys:
        transfer_between_buckets(stale_client, STALE_BUCKET, active_client, ACTIVE_BUCKET, key)
        size, _ = head_object_integrity(active_client, ACTIVE_BUCKET, key)
        verify_public_object(key, size)
        stale_client.delete_object(Bucket=STALE_BUCKET, Key=key)
        restored.append(key)

    root = Path(args.plan).resolve().parent
    uploaded = []
    concurrent_exact_skips = []
    for item in transformed_plan:
        key = item["key"]
        source = (root / item["path"]).resolve()
        if root not in source.parents or not source.is_file():
            raise RuntimeError(f"Unsafe or missing transformed object path for {key}")
        if source.stat().st_size != item["bytes"] or sha256_file(source) != item["sha256"]:
            raise RuntimeError(f"Local transformed profile integrity mismatch for {key}")
        outcome = conditional_create_derivative(active_client, source, item)
        size, digest = head_object_integrity(active_client, ACTIVE_BUCKET, key, require_cache=True)
        if size != item["bytes"] or digest != item["sha256"]:
            raise RuntimeError(f"Uploaded active profile integrity mismatch for {key}")
        validate_existing_derivative(active_client, item)
        verify_public_object(key, item["bytes"])
        if outcome == "created":
            uploaded.append(key)
        else:
            concurrent_exact_skips.append(key)

    active_after_upload = list_keys(active_client, ACTIVE_BUCKET)
    missing_after_upload = expected_keys - active_after_upload
    if missing_after_upload:
        raise RuntimeError(f"Active profile R2 parity failed; {len(missing_after_upload)} objects missing")

    quarantined = []
    quarantined_bytes = 0
    for key in ([] if create_only else stale_candidates):
        if key in expected_keys:
            raise RuntimeError("Refusing to quarantine a current expected profile object")
        if key not in active_after_upload:
            continue
        quarantined_bytes += transfer_between_buckets(active_client, ACTIVE_BUCKET, stale_client, STALE_BUCKET, key)
        active_client.delete_object(Bucket=ACTIVE_BUCKET, Key=key)
        if key in list_keys(active_client, ACTIVE_BUCKET, prefix=key):
            raise RuntimeError(f"Failed to remove quarantined active profile object {key}")
        quarantined.append(key)

    final_active = list_keys(active_client, ACTIVE_BUCKET)
    if expected_keys - final_active:
        raise RuntimeError("Final active profile R2 parity failed")
    result = {
        "expectedObjectCount": len(expected_keys),
        "restoredObjectCount": len(restored),
        "uploadedObjectCount": len(uploaded),
        "concurrentExactSkipCount": len(concurrent_exact_skips),
        "quarantinedObjectCount": len(quarantined),
        "quarantinedBytes": quarantined_bytes,
        "activeParity": True,
        "deletedObjectCount": 0 if create_only else len(quarantined),
    }
    write_json(args.output, result)
    for name, value in {
        "restored_count": result["restoredObjectCount"],
        "uploaded_count": result["uploadedObjectCount"],
        "concurrent_exact_skip_count": result["concurrentExactSkipCount"],
        "quarantined_count": result["quarantinedObjectCount"],
        "quarantined_bytes": result["quarantinedBytes"],
        "parity": "true",
    }.items():
        append_github_output(name, value)
    print(json.dumps(result, indent=2))


def delete_batch(client, bucket, keys):
    for index in range(0, len(keys), 1000):
        batch = keys[index:index + 1000]
        if batch:
            client.delete_objects(Bucket=bucket, Delete={"Objects": [{"Key": key} for key in batch], "Quiet": True})


def purge_cache_exact_urls(urls):
    if not urls:
        return
    zone_id = require_environment("CLOUDFLARE_ZONE_ID")
    token = require_environment("CLOUDFLARE_CACHE_PURGE_TOKEN")
    if not re.fullmatch(r"[a-f0-9]{32}", zone_id):
        raise RuntimeError("Refusing unexpected Cloudflare zone id")
    endpoint = f"https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache"
    for index in range(0, len(urls), 100):
        body = json.dumps({"files": urls[index:index + 100]}).encode()
        request = urllib.request.Request(
            endpoint,
            data=body,
            method="POST",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        last_error = None
        for delay in (0, 2, 4, 8, 16, 30, 30, 30):
            if delay:
                time.sleep(delay)
            try:
                with urllib.request.urlopen(request, timeout=30) as response:
                    payload = json.loads(response.read())
                    if response.status == 200 and payload.get("success") is True:
                        last_error = None
                        break
                    last_error = RuntimeError("Exact profile cache purge returned an unsuccessful response")
            except (urllib.error.HTTPError, urllib.error.URLError, OSError) as error:
                last_error = error
        if last_error is not None:
            raise RuntimeError("Exact profile cache purge failed after bounded retries") from last_error


def purge_mode(args, active_client, stale_client):
    host_id = validate_host_id(args.host_id)
    if args.confirm != "DELETE ALL R2 PROFILE COPIES":
        raise RuntimeError("Purge confirmation phrase does not match")
    prefix = f"hosts/{host_id}/"
    active_keys = sorted(list_keys(active_client, ACTIVE_BUCKET, prefix=prefix))
    stale_keys = sorted(list_keys(stale_client, STALE_BUCKET, prefix=prefix))
    for key in active_keys + stale_keys:
        if not key.startswith(prefix):
            raise RuntimeError("R2 returned an object outside the exact host namespace")
    # Preserve every active key privately until the exact public-cache purge has
    # succeeded. If cache purge exhausts its retries, a rerun can reconstruct all
    # affected URLs from the private namespace without keeping public objects live.
    for key in active_keys:
        if key not in stale_keys:
            archive_for_privacy_purge(active_client, stale_client, key)
    stale_after_archive = sorted(list_keys(stale_client, STALE_BUCKET, prefix=prefix))
    for key in stale_after_archive:
        if not key.startswith(prefix):
            raise RuntimeError("Private R2 returned an object outside the exact host namespace")
    all_keys = sorted(set(active_keys) | set(stale_after_archive))
    active_urls = [f"{PUBLIC_BASE_URL}/{key}" for key in all_keys]
    delete_batch(active_client, ACTIVE_BUCKET, active_keys)
    if list_keys(active_client, ACTIVE_BUCKET, prefix=prefix):
        raise RuntimeError("Active host namespace is not empty before cache purge")
    purge_cache_exact_urls(active_urls)
    delete_batch(stale_client, STALE_BUCKET, stale_after_archive)
    if list_keys(stale_client, STALE_BUCKET, prefix=prefix):
        raise RuntimeError("Private stale host namespace is not empty after purge")
    result = {
        "hostId": host_id,
        "activeDeletedCount": len(active_keys),
        "staleDeletedCount": len(stale_after_archive),
        "exactCachePurgedCount": len(active_urls),
        "namespaceEmpty": True,
    }
    write_json(args.output, result)
    print(json.dumps(result, indent=2))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("plan", "apply", "create-only", "purge"), required=True)
    parser.add_argument("--plan", required=False)
    parser.add_argument("--expected")
    parser.add_argument("--objects")
    parser.add_argument("--r2-plan")
    parser.add_argument("--output", required=True)
    parser.add_argument("--host-id")
    parser.add_argument("--confirm")
    parser.add_argument("--confirm-digest")
    parser.add_argument("--snapshot-hash", default="")
    parser.add_argument("--create-only-plan", action="store_true")
    args = parser.parse_args()
    active_client, stale_client = load_clients()
    if args.mode == "purge":
        purge_mode(args, active_client, stale_client)
        return
    if not args.plan:
        raise RuntimeError("--plan is required")
    plan = json.loads(Path(args.plan).resolve().read_text(encoding="utf-8"))
    if args.mode == "plan":
        plan_mode(args, active_client, stale_client, plan)
        return
    if not args.expected or not args.objects or not args.r2_plan:
        raise RuntimeError("--expected, --objects, and --r2-plan are required in apply mode")
    expected = json.loads(Path(args.expected).resolve().read_text(encoding="utf-8"))
    objects = json.loads(Path(args.objects).resolve().read_text(encoding="utf-8"))
    r2_plan = json.loads(Path(args.r2_plan).resolve().read_text(encoding="utf-8"))
    apply_mode(args, active_client, stale_client, objects, expected, r2_plan, create_only=args.mode == "create-only")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ClientError, OSError, urllib.error.URLError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
