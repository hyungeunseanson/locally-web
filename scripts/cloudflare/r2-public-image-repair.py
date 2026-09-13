#!/usr/bin/env python3
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request


EXPECTED_ACCOUNT_ID = "d56f5f850c6f7dc5779a7c2054aca5a5"
EXPECTED_BUCKET = "locally-public-experience-canary"
EXPECTED_ENDPOINT = f"https://{EXPECTED_ACCOUNT_ID}.r2.cloudflarestorage.com"
EXPECTED_SUPABASE_PROJECT_REF = "uhinvcydgzqlpnvieyal"
IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable"
FREE_STORAGE_BYTES = 10 * 1024 * 1024 * 1024
FREE_CLASS_A = 1_000_000
FREE_CLASS_B = 10_000_000
SAFETY_RATIO = 0.90
HTTP_METADATA_FIELDS = (
    "ContentType",
    "CacheControl",
    "ContentDisposition",
    "ContentEncoding",
    "ContentLanguage",
    "Expires",
)


def stable_value(value):
    if isinstance(value, dict):
        return {key: stable_value(value[key]) for key in sorted(value)}
    if isinstance(value, list):
        return [stable_value(item) for item in value]
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    return value


def stable_json(value):
    return json.dumps(stable_value(value), ensure_ascii=False, indent=2, separators=(",", ": ")) + "\n"


def sha256_bytes(value):
    return hashlib.sha256(value).hexdigest()


def digest_value(value):
    return sha256_bytes(stable_json(value).encode())


def identity_hash(value):
    return hashlib.sha256(("locally-public-experience-media-v1\0" + value).encode()).hexdigest()


def require_environment(name):
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def require_fixed_configuration():
    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID", EXPECTED_ACCOUNT_ID).strip()
    endpoint = require_environment("R2_ENDPOINT").rstrip("/")
    bucket = require_environment("R2_BUCKET")
    if account_id != EXPECTED_ACCOUNT_ID:
        raise RuntimeError("Refusing unexpected Cloudflare account")
    if endpoint != EXPECTED_ENDPOINT:
        raise RuntimeError("Refusing unexpected R2 endpoint")
    if bucket != EXPECTED_BUCKET:
        raise RuntimeError("Refusing unexpected R2 bucket")
    return endpoint, bucket


def normalize_etag(value):
    return str(value or "").strip('"')


def normalize_content_type(value):
    return str(value or "").split(";", 1)[0].strip().lower()


def serialize_http_metadata(head):
    result = {}
    for field in HTTP_METADATA_FIELDS:
        value = head.get(field)
        if value is not None and value != "":
            result[field] = stable_value(value)
    return result


def normalize_object(head, key=None):
    return {
        "key": key or head.get("Key"),
        "etag": normalize_etag(head.get("ETag")),
        "size": int(head.get("ContentLength", head.get("Size", 0))),
        "storageClass": head.get("StorageClass") or "STANDARD",
        "httpMetadata": serialize_http_metadata(head),
        "customMetadata": dict(sorted((head.get("Metadata") or {}).items())),
    }


def object_state_digest(objects):
    return digest_value(sorted(objects, key=lambda item: item["key"]))


class RepairClient:
    def __init__(self, client):
        self.client = client
        self.operations = {
            "listRequests": 0,
            "headRequests": 0,
            "getRequests": 0,
            "putRequests": 0,
            "copyRequests": 0,
        }
        self.lock = threading.Lock()

    def _record(self, operation, count=1):
        with self.lock:
            self.operations[operation] += count

    def list_metadata(self, bucket):
        result = []
        paginator = self.client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=bucket):
            self._record("listRequests")
            for item in page.get("Contents", []):
                self._record("headRequests")
                head = self.client.head_object(Bucket=bucket, Key=item["Key"])
                result.append(normalize_object(head, item["Key"]))
        return sorted(result, key=lambda value: value["key"])

    def head(self, bucket, key):
        self._record("headRequests")
        return normalize_object(self.client.head_object(Bucket=bucket, Key=key), key)

    def get_bytes(self, bucket, key):
        self._record("getRequests")
        response = self.client.get_object(Bucket=bucket, Key=key)
        body = response["Body"]
        digest = hashlib.sha256()
        size = 0
        while True:
            chunk = body.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            digest.update(chunk)
        return size, digest.hexdigest()

    def put_original(self, bucket, key, source_path, content_type, metadata):
        self._record("putRequests")
        with source_path.open("rb") as body:
            return self.client.put_object(
                Bucket=bucket,
                Key=key,
                Body=body,
                IfNoneMatch="*",
                ContentType=content_type,
                CacheControl=IMMUTABLE_CACHE_CONTROL,
                Metadata=metadata,
                StorageClass="STANDARD",
            )

    def copy_metadata(self, bucket, key, source_etag, http_metadata, custom_metadata, storage_class):
        self._record("copyRequests")
        kwargs = {
            "Bucket": bucket,
            "Key": key,
            "CopySource": {"Bucket": bucket, "Key": key},
            "CopySourceIfMatch": f'"{source_etag}"',
            "MetadataDirective": "REPLACE",
            "Metadata": custom_metadata,
        }
        for field in HTTP_METADATA_FIELDS:
            if field in http_metadata:
                kwargs[field] = http_metadata[field]
        if storage_class in ("STANDARD", "STANDARD_IA"):
            kwargs["StorageClass"] = storage_class
        return self.client.copy_object(**kwargs)


class CloudflareApiReadOnlyRepairClient:
    def __init__(self, token, account_id):
        self.token = token
        self.account_id = account_id
        self.operations = {
            "listRequests": 0,
            "headRequests": 0,
            "getRequests": 0,
            "putRequests": 0,
            "copyRequests": 0,
        }
        self.lock = threading.Lock()

    def _record(self, operation, count=1):
        with self.lock:
            self.operations[operation] += count

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
                self._record("headRequests")
                result.append({
                    "key": item["key"],
                    "etag": normalize_etag(item.get("etag")),
                    "size": int(item.get("size", 0)),
                    "storageClass": item.get("storage_class") or "STANDARD",
                    "httpMetadata": {
                        field: value
                        for field, value in {
                            "ContentType": http.get("contentType"),
                            "CacheControl": http.get("cacheControl"),
                            "ContentDisposition": http.get("contentDisposition"),
                            "ContentEncoding": http.get("contentEncoding"),
                            "ContentLanguage": http.get("contentLanguage"),
                            "Expires": http.get("cacheExpiry"),
                        }.items()
                        if value not in (None, "")
                    },
                    "customMetadata": dict(sorted((item.get("custom_metadata") or {}).items())),
                })
            info = payload.get("result_info") or {}
            if not info.get("is_truncated"):
                break
            cursor = info.get("cursor")
            if not cursor:
                raise RuntimeError("Cloudflare R2 LIST omitted its pagination cursor")
        return sorted(result, key=lambda value: value["key"])

    def get_bytes(self, bucket, key):
        encoded_key = urllib.parse.quote(key, safe="/")
        url = (
            f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/r2/buckets/"
            f"{urllib.parse.quote(bucket, safe='')}/objects/{encoded_key}"
        )
        last_error = None
        for attempt in range(4):
            self._record("getRequests")
            digest = hashlib.sha256()
            size = 0
            try:
                with self._request(url) as response:
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        size += len(chunk)
                        digest.update(chunk)
                return size, digest.hexdigest()
            except (urllib.error.URLError, TimeoutError, OSError) as error:
                last_error = error
                if attempt < 3:
                    time.sleep(2 ** attempt)
        raise RuntimeError(f"Cloudflare R2 GET failed after retries; identity={identity_hash(key)[:16]}") from last_error

    def head(self, _bucket, _key):
        raise RuntimeError("Cloudflare API read-only transport cannot be used for apply")

    def put_original(self, *_args, **_kwargs):
        raise RuntimeError("Cloudflare API read-only transport cannot be used for apply")

    def copy_metadata(self, *_args, **_kwargs):
        raise RuntimeError("Cloudflare API read-only transport cannot be used for apply")


def load_client(read_only=False):
    endpoint, bucket = require_fixed_configuration()
    api_token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    if read_only and api_token:
        return CloudflareApiReadOnlyRepairClient(api_token, EXPECTED_ACCOUNT_ID), bucket
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
    return RepairClient(client), bucket


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_private_json(path, value):
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    destination.write_text(stable_json(value), encoding="utf-8")
    destination.chmod(0o600)


def validate_source_plan(source_plan, source_plan_path):
    target = source_plan.get("target") or {}
    if target.get("supabaseProjectRef") != EXPECTED_SUPABASE_PROJECT_REF:
        raise RuntimeError("Refusing unexpected Supabase project")
    if target.get("bucket") != "experiences":
        raise RuntimeError("Refusing unexpected Supabase Storage bucket")
    sources = source_plan.get("sourceObjects")
    derivatives = source_plan.get("expectedDerivatives")
    if not isinstance(sources, list) or not sources or not isinstance(derivatives, list) or not derivatives:
        raise RuntimeError("Source plan is empty or invalid")
    if len({item["sourceKeySha256"] for item in sources}) != len(sources):
        raise RuntimeError("Source plan contains duplicate source identities")
    if len({item["key"] for item in derivatives}) != len(derivatives):
        raise RuntimeError("Source plan contains duplicate derivative keys")
    source_by_hash = {item["sourceKeySha256"]: item for item in sources}
    root = Path(source_plan_path).resolve().parent
    for item in sources:
        if hashlib.sha256(item["sourceKey"].encode()).hexdigest() != item["sourceKeySha256"]:
            raise RuntimeError("Source identity hash mismatch")
        source_path = (root / item["localFile"]).resolve()
        if root not in source_path.parents or not source_path.is_file():
            raise RuntimeError("Unsafe or missing source cache path")
        body = source_path.read_bytes()
        if len(body) != item["sourceSize"] or sha256_bytes(body) != item["sourceByteSha256"]:
            raise RuntimeError("Source cache integrity mismatch")
        if not item["originalKey"].startswith(f"originals/v1/{item['sourceKeySha256'][:2]}/{item['sourceKeySha256']}/"):
            raise RuntimeError("Unsafe original object namespace")
    if any(item.get("sourceKeySha256") not in source_by_hash for item in derivatives):
        raise RuntimeError("Derivative has no source")
    return source_by_hash


def desired_derivative_metadata(actual, derivative, output_sha):
    custom = dict(actual["customMetadata"])
    custom.update({
        "sha256": output_sha,
        "output_byte_sha256": output_sha,
        "source_key_sha256": derivative["sourceKeySha256"],
        "source_byte_sha256": derivative["sourceByteSha256"],
        "transform_width": str(derivative["width"]),
        "transform_quality": str(derivative["quality"]),
        "transform_format": derivative["format"],
        "provenance_status": "legacy-observed",
    })
    http = dict(actual["httpMetadata"])
    http["ContentType"] = derivative["expectedContentType"]
    http["CacheControl"] = IMMUTABLE_CACHE_CONTROL
    return http, dict(sorted(custom.items()))


def original_metadata(source, copied_at):
    return {
        "source_key_sha256": source["sourceKeySha256"],
        "source_byte_sha256": source["sourceByteSha256"],
        "output_byte_sha256": source["sourceByteSha256"],
        "source_size": str(source["sourceSize"]),
        "copied_at": copied_at,
    }


def validate_usage(usage, expected_class_a, expected_class_b, storage_increase):
    observed_at = datetime.fromisoformat(usage["observedAt"].replace("Z", "+00:00"))
    if observed_at.tzinfo is None:
        raise RuntimeError("Usage observation must include a timezone")
    age_seconds = (datetime.now(timezone.utc) - observed_at.astimezone(timezone.utc)).total_seconds()
    if age_seconds < -300 or age_seconds > 7200:
        raise RuntimeError("Quota observation is stale or in the future")
    projected = {
        "classA": usage["currentMonthClassA"] + expected_class_a,
        "classB": usage["currentMonthClassB"] + expected_class_b,
        "storageBytes": usage["accountStorageBytes"] + storage_increase,
    }
    limits = {
        "classA": int(FREE_CLASS_A * SAFETY_RATIO),
        "classB": int(FREE_CLASS_B * SAFETY_RATIO),
        "storageBytes": int(FREE_STORAGE_BYTES * SAFETY_RATIO),
    }
    if any(projected[name] > limits[name] for name in projected):
        raise RuntimeError("Projected repair usage exceeds the conservative R2 free-tier safety ceiling")
    return {"observed": usage, "projected": projected, "safetyCeilings": limits, "withinSafetyCeilings": True}


def build_repair_plan(client, bucket, source_plan, source_plan_path, usage):
    source_by_hash = validate_source_plan(source_plan, source_plan_path)
    before = client.list_metadata(bucket)
    actual = {item["key"]: item for item in before}
    if len(actual) != len(before):
        raise RuntimeError("R2 contains duplicate object keys")
    def inspect_derivative(derivative):
        current = actual.get(derivative["key"])
        if current is None:
            raise RuntimeError("An expected derivative is missing; run reconciliation before repair")
        size, output_sha = client.get_bytes(bucket, derivative["key"])
        if size != current["size"]:
            raise RuntimeError("Derivative size metadata mismatch")
        stored_sha = current["customMetadata"].get("sha256")
        if stored_sha and stored_sha != output_sha:
            raise RuntimeError("Derivative stored SHA mismatch")
        if normalize_content_type(current["httpMetadata"].get("ContentType")) != "image/webp":
            raise RuntimeError("Derivative content type mismatch requires a separate repair")
        desired_http, desired_custom = desired_derivative_metadata(current, derivative, output_sha)
        needs_copy = current["httpMetadata"] != desired_http or current["customMetadata"] != desired_custom
        return {
            "key": derivative["key"],
            "safeIdentity": identity_hash(derivative["key"]),
            "sourceKeySha256": derivative["sourceKeySha256"],
            "sourceByteSha256": derivative["sourceByteSha256"],
            "outputByteSha256": output_sha,
            "size": size,
            "action": "copy-metadata" if needs_copy else "skip",
            "before": current,
            "desiredHttpMetadata": desired_http,
            "desiredCustomMetadata": desired_custom,
        }

    expected_derivatives = sorted(source_plan["expectedDerivatives"], key=lambda item: item["key"])
    with ThreadPoolExecutor(max_workers=4) as executor:
        derivatives = list(executor.map(inspect_derivative, expected_derivatives))
    cache_mismatches = sum(
        item["before"]["httpMetadata"].get("CacheControl") != IMMUTABLE_CACHE_CONTROL
        for item in derivatives
    )
    originals = []
    copied_at = source_plan["generatedAt"]
    root = Path(source_plan_path).resolve().parent
    for source in sorted(source_plan["sourceObjects"], key=lambda item: item["sourceKeySha256"]):
        desired_custom = original_metadata(source, copied_at)
        desired_http = {"ContentType": source["contentType"], "CacheControl": IMMUTABLE_CACHE_CONTROL}
        current = actual.get(source["originalKey"])
        action = "put-original"
        before_state = None
        if current is not None:
            size, output_sha = client.get_bytes(bucket, source["originalKey"])
            if size != source["sourceSize"] or output_sha != source["sourceByteSha256"]:
                raise RuntimeError("Existing immutable original key contains different bytes")
            expected_existing = dict(desired_custom)
            expected_existing["copied_at"] = current["customMetadata"].get("copied_at", "")
            if not expected_existing["copied_at"]:
                raise RuntimeError("Existing original is missing copied_at metadata")
            if current["httpMetadata"] != desired_http or current["customMetadata"] != expected_existing:
                raise RuntimeError("Existing immutable original metadata differs; refusing overwrite")
            action = "skip"
            before_state = current
        source_path = (root / source["localFile"]).resolve()
        originals.append({
            "key": source["originalKey"],
            "safeIdentity": identity_hash(source["originalKey"]),
            "sourceKeySha256": source["sourceKeySha256"],
            "sourceByteSha256": source["sourceByteSha256"],
            "sourceSize": source["sourceSize"],
            "contentType": source["contentType"],
            "localFile": str(source_path.relative_to(root)),
            "action": action,
            "before": before_state,
            "desiredHttpMetadata": desired_http,
            "desiredCustomMetadata": desired_custom,
        })
    copy_count = sum(item["action"] == "copy-metadata" for item in derivatives)
    put_count = sum(item["action"] == "put-original" for item in originals)
    list_pages_before = max(1, (len(before) + 999) // 1000)
    after_count = len(before) + put_count
    list_pages_after = max(1, (after_count + 999) // 1000)
    existing_original_gets = sum(item["before"] is not None for item in originals)
    plan_class_a = list_pages_before
    plan_class_b = len(before) + len(derivatives) + existing_original_gets
    apply_class_a = copy_count + put_count + list_pages_before + list_pages_after
    apply_class_b = (
        len(before)
        + (copy_count * 3)  # immediate HEAD, post-copy HEAD, and verification GET
        + (put_count * 2)  # post-put HEAD and verification GET
        + after_count
    )
    expected_class_a = plan_class_a + apply_class_a
    expected_class_b = plan_class_b + apply_class_b
    storage_increase = sum(item["sourceSize"] for item in originals if item["action"] == "put-original")
    quota = validate_usage(usage, expected_class_a, expected_class_b, storage_increase)
    plan = {
        "version": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "targets": {
            "cloudflareAccountId": EXPECTED_ACCOUNT_ID,
            "r2Bucket": EXPECTED_BUCKET,
            "supabaseProjectRef": EXPECTED_SUPABASE_PROJECT_REF,
        },
        "sourceSnapshotDigest": source_plan["sourceSnapshotDigest"],
        "sourcePlanDigest": digest_value(source_plan),
        "r2StateDigest": object_state_digest(before),
        "r2ObjectCountBefore": len(before),
        "derivatives": derivatives,
        "originals": originals,
        "counts": {
            "expectedDerivatives": len(derivatives),
            "copyObject": copy_count,
            "cacheControlMismatch": cache_mismatches,
            "publicActiveOriginals": len(originals),
            "putOriginal": put_count,
            "skipDerivative": len(derivatives) - copy_count,
            "skipOriginal": len(originals) - put_count,
        },
        "cost": {
            "expectedClassA": expected_class_a,
            "expectedClassB": expected_class_b,
            "planClassA": plan_class_a,
            "planClassB": plan_class_b,
            "applyClassA": apply_class_a,
            "applyClassB": apply_class_b,
            "expectedR2StorageIncreaseBytes": storage_increase,
            "expectedSupabaseSourceEgressBytes": sum(item["sourceSize"] for item in source_plan["sourceObjects"]) * 3,
            "quota": quota,
        },
        "safety": {
            "metadataDirective": "REPLACE",
            "copySourceIfMatchRequired": True,
            "putIfNoneMatchRequired": True,
            "destinationConditionalHeaderRequired": False,
            "deletionSupported": False,
        },
    }
    digest_payload = dict(plan)
    plan["planDigest"] = digest_value(digest_payload)
    return plan


def public_plan_summary(plan, operation_counts):
    return {
        "version": plan["version"],
        "generatedAt": plan["generatedAt"],
        "planDigest": plan["planDigest"],
        "sourceSnapshotDigest": plan["sourceSnapshotDigest"],
        "r2StateDigest": plan["r2StateDigest"],
        "counts": plan["counts"],
        "cost": plan["cost"],
        "canary": {
            "copyObjectCount": min(1, plan["counts"]["copyObject"]),
            "putOriginalCount": min(1, plan["counts"]["putOriginal"]),
        },
        "planReadOperations": operation_counts,
        "mutationRequests": 0,
    }


def validate_plan_digest(plan, confirmation):
    stored = plan.get("planDigest")
    payload = dict(plan)
    payload.pop("planDigest", None)
    actual = digest_value(payload)
    if stored != actual or confirmation != actual:
        raise RuntimeError("Exact plan digest confirmation is required")


def validate_plan_targets(plan):
    expected = {
        "cloudflareAccountId": EXPECTED_ACCOUNT_ID,
        "r2Bucket": EXPECTED_BUCKET,
        "supabaseProjectRef": EXPECTED_SUPABASE_PROJECT_REF,
    }
    if plan.get("targets") != expected:
        raise RuntimeError("Repair plan targets do not match the fixed Production mirror boundary")
    if not plan.get("cost", {}).get("quota", {}).get("withinSafetyCeilings"):
        raise RuntimeError("Repair plan did not pass quota preflight")


def assert_current_r2_state(client, bucket, plan):
    current = client.list_metadata(bucket)
    if object_state_digest(current) != plan["r2StateDigest"]:
        raise RuntimeError("R2 state changed after planning; write count is zero")
    return current


def sanitize_journal(journal):
    serialized = stable_json(journal)
    forbidden = (
        re.compile(r"https?://", re.I),
        re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}", re.I),
        re.compile(r"(?:credential|secret|access[_-]?key|sourceKey\")", re.I),
    )
    if any(pattern.search(serialized) for pattern in forbidden):
        raise RuntimeError("Rollback journal contains forbidden sensitive source identity or credential material")
    return journal


def persist_journal(path, journal):
    journal["journalDigest"] = digest_value({key: value for key, value in journal.items() if key != "journalDigest"})
    sanitize_journal(journal)
    write_private_json(path, journal)


def selected_actions(plan, scope):
    copies = [item for item in plan["derivatives"] if item["action"] == "copy-metadata"]
    puts = [item for item in plan["originals"] if item["action"] == "put-original"]
    if scope == "canary":
        if not copies or not puts:
            raise RuntimeError("Canary requires exactly one planned derivative copy and one planned original put")
        return [copies[0]], [puts[0]]
    return copies, puts


def verify_canary_receipt(receipt, plan):
    if receipt.get("verified") is not True or receipt.get("copyObjectCount") != 1 or receipt.get("putOriginalCount") != 1:
        raise RuntimeError("A verified exact two-operation canary receipt is required")
    if receipt.get("sourceSnapshotDigest") != plan["sourceSnapshotDigest"]:
        raise RuntimeError("Canary receipt source snapshot does not match the full repair plan")


def apply_plan(client, bucket, plan, source_plan_path, scope, journal_path, current_usage, canary_receipt=None):
    validate_plan_targets(plan)
    validate_usage(
        current_usage,
        plan["cost"]["expectedClassA"],
        plan["cost"]["expectedClassB"],
        plan["cost"]["expectedR2StorageIncreaseBytes"],
    )
    before_objects = assert_current_r2_state(client, bucket, plan)
    if scope == "full":
        if not canary_receipt:
            raise RuntimeError("Full repair requires a canary receipt")
        verify_canary_receipt(canary_receipt, plan)
    copies, puts = selected_actions(plan, scope)
    source_root = Path(source_plan_path).resolve().parent
    journal = {
        "version": 1,
        "scope": scope,
        "planDigest": plan["planDigest"],
        "sourceSnapshotDigest": plan["sourceSnapshotDigest"],
        "startedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "entries": [],
        "completed": False,
    }
    persist_journal(journal_path, journal)
    for item in copies:
        immediate_before = client.head(bucket, item["key"])
        if immediate_before != item["before"]:
            raise RuntimeError("Derivative metadata changed immediately before conditional copy")
        entry = {
            "operation": "copy-metadata",
            "key": item["key"],
            "safeIdentity": item["safeIdentity"],
            "preCopyEtag": item["before"]["etag"],
            "preCopyHttpMetadata": item["before"]["httpMetadata"],
            "preCopyCustomMetadata": item["before"]["customMetadata"],
            "preCopyStorageClass": item["before"]["storageClass"],
            "preCopySha256": item["outputByteSha256"],
            "postCopyEtag": None,
            "postCopyHttpMetadata": item["desiredHttpMetadata"],
            "postCopyCustomMetadata": item["desiredCustomMetadata"],
            "postCopyStorageClass": item["before"]["storageClass"],
        }
        journal["entries"].append(entry)
        persist_journal(journal_path, journal)
        client.copy_metadata(
            bucket,
            item["key"],
            item["before"]["etag"],
            item["desiredHttpMetadata"],
            item["desiredCustomMetadata"],
            item["before"]["storageClass"],
        )
        after = client.head(bucket, item["key"])
        size, digest = client.get_bytes(bucket, item["key"])
        if size != item["size"] or digest != item["outputByteSha256"]:
            raise RuntimeError("Copied derivative bytes changed")
        if after["httpMetadata"] != item["desiredHttpMetadata"] or after["customMetadata"] != item["desiredCustomMetadata"]:
            raise RuntimeError("Copied derivative metadata did not round-trip exactly")
        entry["postCopyEtag"] = after["etag"]
        entry["postCopyHttpMetadata"] = after["httpMetadata"]
        entry["postCopyCustomMetadata"] = after["customMetadata"]
        entry["postCopyStorageClass"] = after["storageClass"]
        persist_journal(journal_path, journal)
    for item in puts:
        source_path = (source_root / item["localFile"]).resolve()
        if source_root not in source_path.parents or not source_path.is_file():
            raise RuntimeError("Unsafe or missing source cache path")
        body = source_path.read_bytes()
        if len(body) != item["sourceSize"] or sha256_bytes(body) != item["sourceByteSha256"]:
            raise RuntimeError("Original source cache changed")
        entry = {
            "operation": "put-original",
            "key": item["key"],
            "safeIdentity": item["safeIdentity"],
            "sourceByteSha256": item["sourceByteSha256"],
            "postPutEtag": None,
            "rollback": "retained-no-delete",
        }
        journal["entries"].append(entry)
        persist_journal(journal_path, journal)
        client.put_original(bucket, item["key"], source_path, item["contentType"], item["desiredCustomMetadata"])
        after = client.head(bucket, item["key"])
        size, digest = client.get_bytes(bucket, item["key"])
        if size != item["sourceSize"] or digest != item["sourceByteSha256"]:
            raise RuntimeError("Immutable original verification failed")
        if after["httpMetadata"] != item["desiredHttpMetadata"] or after["customMetadata"] != item["desiredCustomMetadata"]:
            raise RuntimeError("Immutable original metadata did not round-trip exactly")
        entry["postPutEtag"] = after["etag"]
        persist_journal(journal_path, journal)
    after_objects = client.list_metadata(bucket)
    before_by_key = {item["key"]: item for item in before_objects}
    after_by_key = {item["key"]: item for item in after_objects}
    allowed = {item["key"] for item in copies + puts}
    changed = {key for key in set(before_by_key) | set(after_by_key) if before_by_key.get(key) != after_by_key.get(key)}
    if not changed.issubset(allowed) or any(key not in after_by_key for key in before_by_key):
        raise RuntimeError("Unrelated R2 object state changed during repair")
    journal["completed"] = True
    journal["completedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    persist_journal(journal_path, journal)
    receipt = {
        "verified": True,
        "scope": scope,
        "planDigest": plan["planDigest"],
        "sourceSnapshotDigest": plan["sourceSnapshotDigest"],
        "copyObjectCount": len(copies),
        "putOriginalCount": len(puts),
        "journalDigest": journal["journalDigest"],
        "noUnrelatedObjectChange": True,
    }
    return receipt


def rollback_metadata(client, bucket, journal, confirmation):
    payload = {key: value for key, value in journal.items() if key != "journalDigest"}
    digest = digest_value(payload)
    if journal.get("journalDigest") != digest or confirmation != digest:
        raise RuntimeError("Exact journal digest confirmation is required")
    restored = 0
    for entry in reversed(journal["entries"]):
        if entry["operation"] != "copy-metadata":
            continue
        current = client.head(bucket, entry["key"])
        size, current_sha = client.get_bytes(bucket, entry["key"])
        if current_sha != entry["preCopySha256"] or size <= 0:
            raise RuntimeError("Current object no longer matches the journal; rollback refused")
        if current["httpMetadata"] == entry["preCopyHttpMetadata"] and current["customMetadata"] == entry["preCopyCustomMetadata"]:
            continue
        if (
            (entry["postCopyEtag"] and current["etag"] != entry["postCopyEtag"])
            or current["httpMetadata"] != entry["postCopyHttpMetadata"]
            or current["customMetadata"] != entry["postCopyCustomMetadata"]
            or current["storageClass"] != entry["postCopyStorageClass"]
        ):
            raise RuntimeError("Current metadata no longer matches the journal; rollback refused")
        client.copy_metadata(
            bucket,
            entry["key"],
            current["etag"],
            entry["preCopyHttpMetadata"],
            entry["preCopyCustomMetadata"],
            entry["preCopyStorageClass"],
        )
        after = client.head(bucket, entry["key"])
        _, after_sha = client.get_bytes(bucket, entry["key"])
        if after["httpMetadata"] != entry["preCopyHttpMetadata"] or after["customMetadata"] != entry["preCopyCustomMetadata"] or after_sha != entry["preCopySha256"]:
            raise RuntimeError("Metadata rollback verification failed")
        restored += 1
    return {"restoredMetadataObjectCount": restored, "retainedOriginalCount": sum(item["operation"] == "put-original" for item in journal["entries"])}


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Controlled public experience media mirror repair")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--plan", action="store_true")
    mode.add_argument("--apply", action="store_true")
    mode.add_argument("--rollback", action="store_true")
    parser.add_argument("--source-plan")
    parser.add_argument("--repair-plan")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--confirm-digest")
    parser.add_argument("--scope", choices=("canary", "full"), default="canary")
    parser.add_argument("--canary-receipt")
    parser.add_argument("--journal")
    parser.add_argument("--current-month-class-a", type=int)
    parser.add_argument("--current-month-class-b", type=int)
    parser.add_argument("--account-storage-bytes", type=int)
    parser.add_argument("--usage-observed-at")
    args = parser.parse_args(argv)
    if not args.plan and not args.apply and not args.rollback:
        args.plan = True
    return args


def main():
    args = parse_args()
    output = Path(args.output_dir).resolve()
    output.mkdir(parents=True, exist_ok=True, mode=0o700)
    client, bucket = load_client(read_only=args.plan)
    if args.plan:
        if not args.source_plan:
            raise RuntimeError("--source-plan is required")
        values = (args.current_month_class_a, args.current_month_class_b, args.account_storage_bytes)
        if any(value is None or value < 0 for value in values) or not args.usage_observed_at:
            raise RuntimeError("Fresh non-negative R2 usage inputs are required for quota preflight")
        source_plan = load_json(args.source_plan)
        usage = {
            "currentMonthClassA": args.current_month_class_a,
            "currentMonthClassB": args.current_month_class_b,
            "accountStorageBytes": args.account_storage_bytes,
            "observedAt": args.usage_observed_at,
        }
        plan = build_repair_plan(client, bucket, source_plan, args.source_plan, usage)
        private_path = output / ".repair-plan.json"
        write_private_json(private_path, plan)
        summary = public_plan_summary(plan, client.operations)
        (output / "repair-plan-summary.json").write_text(stable_json(summary), encoding="utf-8")
        print(stable_json(summary))
        return
    if args.rollback:
        if not args.journal or not args.confirm_digest:
            raise RuntimeError("--journal and --confirm-digest are required for rollback")
        result = rollback_metadata(client, bucket, load_json(args.journal), args.confirm_digest)
        print(stable_json(result))
        return
    if not args.source_plan or not args.repair_plan or not args.journal or not args.confirm_digest:
        raise RuntimeError("Apply requires --source-plan, --repair-plan, --journal, and --confirm-digest")
    values = (args.current_month_class_a, args.current_month_class_b, args.account_storage_bytes)
    if any(value is None or value < 0 for value in values) or not args.usage_observed_at:
        raise RuntimeError("Apply requires a fresh R2 quota observation")
    source_plan = load_json(args.source_plan)
    validate_source_plan(source_plan, args.source_plan)
    plan = load_json(args.repair_plan)
    validate_plan_digest(plan, args.confirm_digest)
    if digest_value(source_plan) != plan["sourcePlanDigest"] or source_plan["sourceSnapshotDigest"] != plan["sourceSnapshotDigest"]:
        raise RuntimeError("Source plan does not match the confirmed repair plan")
    receipt = load_json(args.canary_receipt) if args.canary_receipt else None
    current_usage = {
        "currentMonthClassA": args.current_month_class_a,
        "currentMonthClassB": args.current_month_class_b,
        "accountStorageBytes": args.account_storage_bytes,
        "observedAt": args.usage_observed_at,
    }
    result = apply_plan(client, bucket, plan, args.source_plan, args.scope, args.journal, current_usage, receipt)
    receipt_path = output / f"{args.scope}-receipt.json"
    receipt_path.write_text(stable_json(result), encoding="utf-8")
    print(stable_json(result))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
