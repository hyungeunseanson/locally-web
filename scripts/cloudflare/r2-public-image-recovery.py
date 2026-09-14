#!/usr/bin/env python3
import argparse
import hashlib
import importlib.util
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import boto3
from botocore.config import Config


EXPECTED_ACCOUNT_ID = "d56f5f850c6f7dc5779a7c2054aca5a5"
EXPECTED_ENDPOINT = f"https://{EXPECTED_ACCOUNT_ID}.r2.cloudflarestorage.com"
EXPECTED_BUCKET = "locally-public-experience-canary"
EXPECTED_CACHE_CONTROL = "public, max-age=31536000, immutable"
PLAN_VERSION = 2
HARD_LIMITS = {
    "maxSourceDownloads": 50,
    "maxSourceBytes": 256 * 1024 * 1024,
    "maxOriginalCreates": 50,
    "maxDerivativeCreates": 200,
    "maxTransforms": 200,
}
EXPECTED_SCOPE = {
    "source": "supabase-public-active-experiences",
    "supabaseProjectRef": "uhinvcydgzqlpnvieyal",
    "bucket": EXPECTED_BUCKET,
    "writeMode": "conditional-create-only",
}


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


def desired_original_metadata(item, copied_at):
    return {
        "sha256": item["sha256"],
        "source_key_sha256": item["sourceKeySha256"],
        "source_byte_sha256": item["sourceByteSha256"],
        "output_byte_sha256": item["sha256"],
        "source_size": str(item["sourceSize"]),
        "provenance_status": "verified",
        "transform_schema_version": RECONCILE.TRANSFORM_SCHEMA_VERSION,
        "transform_engine": "source-copy",
        "copied_at": copied_at,
    }


def verify_original(client, bucket, item):
    head = client.head_object(Bucket=bucket, Key=item["key"])
    size, digest = stream_sha(client.get_object(Bucket=bucket, Key=item["key"]))
    metadata = head.get("Metadata") or {}
    required = desired_original_metadata(item, metadata.get("copied_at", ""))
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


def create_original(client, bucket, root, item, copied_at):
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
                Metadata=desired_original_metadata(item, copied_at),
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


def require_integer(value, name, maximum=None):
    if isinstance(value, bool) or not isinstance(value, int) or value < 0 or (maximum is not None and value > maximum):
        raise RuntimeError(f"Invalid recovery plan value: {name}")
    return value


def require_sha(value, name):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{64}", value):
        raise RuntimeError(f"Invalid recovery plan digest: {name}")


def validate_relative_path(value):
    if not isinstance(value, str) or not value.startswith("objects/") or Path(value).is_absolute() or ".." in Path(value).parts:
        raise RuntimeError("Invalid recovery artifact path")


def validate_original_item(item):
    required = {"key", "path", "bytes", "sha256", "contentType", "sourceKeySha256", "sourceByteSha256", "sourceSize"}
    if not isinstance(item, dict) or set(item) != required:
        raise RuntimeError("Invalid original recovery item structure")
    for field in ("sha256", "sourceKeySha256", "sourceByteSha256"):
        require_sha(item.get(field), field)
    require_integer(item.get("bytes"), "original bytes")
    require_integer(item.get("sourceSize"), "original source size")
    if item["bytes"] <= 0 or item["sourceSize"] != item["bytes"] or item["sha256"] != item["sourceByteSha256"]:
        raise RuntimeError("Invalid original byte contract")
    extensions = {"image/avif": "avif", "image/gif": "gif", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
    extension = extensions.get(item.get("contentType"))
    expected = rf"originals/v1/{item['sourceKeySha256'][:2]}/{item['sourceKeySha256']}/{item['sourceByteSha256']}\.{extension or 'invalid'}"
    if not re.fullmatch(expected, item.get("key", "")):
        raise RuntimeError("Invalid original namespace or identity")
    validate_relative_path(item.get("path"))


def validate_derivative_item(item):
    required = {
        "key", "path", "bytes", "sha256", "contentType", "sourceKeySha256", "sourceByteSha256",
        "sourceSize", "derivativeRole", "width", "quality", "format", "transformSchemaVersion",
        "transformEngine", "provenanceStatus",
    }
    if not isinstance(item, dict) or set(item) != required:
        raise RuntimeError("Invalid derivative recovery item structure")
    enriched = {**item, "generatedAt": "executor-generated"}
    RECONCILE.validate_object_plan_item(enriched)
    prefix = "cards/" if item["derivativeRole"] == "card" else "details/"
    if not item["key"].startswith(prefix) or not item["key"].endswith(f"-w{item['width']}-q{item['quality']}.webp"):
        raise RuntimeError("Invalid derivative namespace or specification")
    validate_relative_path(item.get("path"))


def validate_source_proofs(execution):
    proofs = execution.get("sourceProofs")
    if not isinstance(proofs, list):
        raise RuntimeError("Invalid source proof list")
    by_hash = {}
    for proof in proofs:
        if not isinstance(proof, dict) or set(proof) != {"sourceKeySha256", "sourceByteSha256", "sourceSize", "contentType"}:
            raise RuntimeError("Invalid source proof structure")
        require_sha(proof.get("sourceKeySha256"), "source key")
        require_sha(proof.get("sourceByteSha256"), "source bytes")
        require_integer(proof.get("sourceSize"), "source size")
        if proof["sourceSize"] <= 0 or proof.get("contentType") not in {"image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"}:
            raise RuntimeError("Invalid source proof content")
        if proof["sourceKeySha256"] in by_hash:
            raise RuntimeError("Duplicate source proof")
        by_hash[proof["sourceKeySha256"]] = proof
    originals = execution.get("originals") or []
    for item in [*originals, *(execution.get("derivatives") or [])]:
        proof = by_hash.get(item.get("sourceKeySha256"))
        if not proof or proof["sourceByteSha256"] != item.get("sourceByteSha256") or proof["sourceSize"] != item.get("sourceSize"):
            raise RuntimeError("Object plan is not bound to an approved source proof")
        if item in originals and proof["contentType"] != item.get("contentType"):
            raise RuntimeError("Original content type is not bound to its source proof")
    return proofs


def validate_plan(plan, confirmation):
    execution = plan.get("execution") if isinstance(plan, dict) else None
    calculated = sha256_bytes(stable_json(execution).encode()) if isinstance(execution, dict) else ""
    if not confirmation or confirmation != plan.get("planDigest") or confirmation != calculated:
        raise RuntimeError("Exact fresh recovery plan digest confirmation is required")
    if set(plan) != {"version", "generatedAt", "execution", "planDigest", "progress"}:
        raise RuntimeError("Invalid recovery plan document structure")
    if plan.get("version") != PLAN_VERSION or execution.get("version") != PLAN_VERSION:
        raise RuntimeError("Unsupported recovery plan schema")
    if execution.get("scope") != EXPECTED_SCOPE:
        raise RuntimeError("Refusing an unexpected recovery scope")
    require_sha(execution.get("sourceSnapshotDigest"), "source snapshot")
    require_sha(execution.get("r2StateDigest"), "R2 state")
    require_integer(execution.get("cursor"), "cursor")
    require_integer(execution.get("nextCursor"), "next cursor")
    budget = execution.get("budget")
    if not isinstance(budget, dict) or set(budget) != set(HARD_LIMITS):
        raise RuntimeError("Invalid recovery budget structure")
    for name, maximum in HARD_LIMITS.items():
        require_integer(budget.get(name), name, maximum)
    plan_usage = execution.get("planUsage")
    if not isinstance(plan_usage, dict) or set(plan_usage) != {"sourceGets", "transforms"}:
        raise RuntimeError("Invalid recovery planning usage")
    source_usage = plan_usage["sourceGets"]
    transform_usage = plan_usage["transforms"]
    if not isinstance(source_usage, dict) or set(source_usage) != {"attempts", "successes", "failures", "bytes"}:
        raise RuntimeError("Invalid recovery source planning usage")
    if not isinstance(transform_usage, dict) or set(transform_usage) != {"attempts", "successes", "failures"}:
        raise RuntimeError("Invalid recovery transform planning usage")
    for name, value in {**{f"source {key}": value for key, value in source_usage.items()}, **{f"transform {key}": value for key, value in transform_usage.items()}}.items():
        require_integer(value, name)
    if source_usage["attempts"] > budget["maxSourceDownloads"] or source_usage["bytes"] > budget["maxSourceBytes"]:
        raise RuntimeError("Recovery planning source usage exceeds budget")
    if source_usage["successes"] + source_usage["failures"] != source_usage["attempts"]:
        raise RuntimeError("Recovery planning source usage is inconsistent")
    if transform_usage["attempts"] > budget["maxTransforms"] or transform_usage["successes"] + transform_usage["failures"] != transform_usage["attempts"]:
        raise RuntimeError("Recovery planning transform usage is inconsistent")
    proofs = validate_source_proofs(execution)
    expected_lifecycle = {
        "maxSourceGetAttempts": HARD_LIMITS["maxSourceDownloads"],
        "maxSourceBytes": HARD_LIMITS["maxSourceBytes"],
        "maxTransformAttempts": budget["maxTransforms"],
        "maxR2CreateAttempts": len(execution.get("originals") or []) + len(execution.get("derivatives") or []),
    }
    if execution.get("lifecycleBudget") != expected_lifecycle:
        raise RuntimeError("Invalid recovery lifecycle budget")
    required_source_attempts = source_usage["attempts"] + len(proofs) * 2
    required_source_bytes = source_usage["bytes"] + sum(proof["sourceSize"] for proof in proofs) * 2
    if required_source_attempts > expected_lifecycle["maxSourceGetAttempts"] or required_source_bytes > expected_lifecycle["maxSourceBytes"]:
        raise RuntimeError("Recovery source verification lifecycle exceeds the hard ceiling")
    originals = execution.get("originals")
    derivatives = execution.get("derivatives")
    conflicts = execution.get("conflicts")
    if not isinstance(originals, list) or not isinstance(derivatives, list) or not isinstance(conflicts, list):
        raise RuntimeError("Invalid recovery item lists")
    if conflicts:
        raise RuntimeError("Recovery plan contains conflicts; writes are forbidden")
    if source_usage["successes"] != len(proofs):
        raise RuntimeError("Recovery source proofs do not match successful planning reads")
    if len(originals) > budget["maxOriginalCreates"] or len(derivatives) > budget["maxDerivativeCreates"]:
        raise RuntimeError("Recovery create plan exceeds budget")
    if len(derivatives) > budget["maxTransforms"]:
        raise RuntimeError("Recovery transform plan exceeds budget")
    for item in originals:
        validate_original_item(item)
    for item in derivatives:
        validate_derivative_item(item)
    keys = [item["key"] for item in [*originals, *derivatives]]
    paths = [item["path"] for item in [*originals, *derivatives]]
    if len(keys) != len(set(keys)) or len(paths) != len(set(paths)):
        raise RuntimeError("Duplicate recovery key or artifact path")
    return execution


def validate_artifacts(root, execution):
    root = Path(root).resolve()
    for item in [*execution["originals"], *execution["derivatives"]]:
        source = (root / item["path"]).resolve()
        if root not in source.parents or not source.is_file() or source.stat().st_size != item["bytes"]:
            raise RuntimeError("Invalid recovery artifact file")
        if RECONCILE.sha256_file(source) != item["sha256"]:
            raise RuntimeError("Recovery artifact SHA mismatch")


def expected_verification_usage(execution):
    return {
        "attempts": len(execution["sourceProofs"]),
        "successes": len(execution["sourceProofs"]),
        "failures": 0,
        "bytes": sum(proof["sourceSize"] for proof in execution["sourceProofs"]),
    }


def empty_source_usage():
    return {"attempts": 0, "successes": 0, "failures": 0, "bytes": 0}


def validate_budget_state(state, plan, execution, require_apply_ready=True):
    if state.get("version") != 1 or state.get("planDigest") != plan["planDigest"] or state.get("limits") != execution["lifecycleBudget"]:
        raise RuntimeError("Recovery lifecycle budget state does not match approved plan")
    usage = state.get("usage")
    if not isinstance(usage, dict) or set(usage) != {"sourceGets", "transforms", "r2Creates"}:
        raise RuntimeError("Invalid recovery lifecycle usage state")
    source_gets = usage["sourceGets"]
    if not isinstance(source_gets, dict) or set(source_gets) != {"plan", "preApply", "apply", "postApply"}:
        raise RuntimeError("Invalid recovery source phase state")
    for phase, values in source_gets.items():
        if not isinstance(values, dict) or set(values) != {"attempts", "successes", "failures", "bytes"}:
            raise RuntimeError("Invalid recovery source usage counters")
        for name, value in values.items():
            require_integer(value, f"{phase} {name}")
        if values["successes"] + values["failures"] > values["attempts"]:
            raise RuntimeError("Inconsistent recovery source usage counters")
    if source_gets["plan"] != execution["planUsage"]["sourceGets"] or usage["transforms"] != execution["planUsage"]["transforms"]:
        raise RuntimeError("Recovery planning usage state is not approved")
    if not isinstance(usage["transforms"], dict) or not isinstance(usage["r2Creates"], dict):
        raise RuntimeError("Invalid recovery operation usage counters")
    if set(usage["transforms"]) != {"attempts", "successes", "failures"} or set(usage["r2Creates"]) != {"attempts", "successes", "exactSkips", "failures"}:
        raise RuntimeError("Invalid recovery operation usage counter structure")
    for group in (usage["transforms"], usage["r2Creates"]):
        if not isinstance(group, dict):
            raise RuntimeError("Invalid recovery operation usage counters")
        for name, value in group.items():
            require_integer(value, name)
    source_attempts = sum(values["attempts"] for values in source_gets.values())
    source_bytes = sum(values["bytes"] for values in source_gets.values())
    if source_attempts > state["limits"]["maxSourceGetAttempts"] or source_bytes > state["limits"]["maxSourceBytes"]:
        raise RuntimeError("Recovery source lifecycle budget already exceeded")
    if usage["r2Creates"].get("attempts", 0) > state["limits"]["maxR2CreateAttempts"]:
        raise RuntimeError("Recovery R2 create lifecycle budget already exceeded")
    creates = usage["r2Creates"]
    if creates["successes"] + creates["exactSkips"] + creates["failures"] > creates["attempts"]:
        raise RuntimeError("Inconsistent recovery create usage counters")
    if require_apply_ready:
        if source_gets["preApply"] != expected_verification_usage(execution):
            raise RuntimeError("Recovery pre-apply source verification is incomplete")
        if source_gets["apply"] != empty_source_usage() or source_gets["postApply"] != empty_source_usage():
            raise RuntimeError("Recovery source verification phases are out of order")
        if creates != {"attempts": 0, "successes": 0, "exactSkips": 0, "failures": 0}:
            raise RuntimeError("Recovery create phase already started")
    return state


def load_budget_state(path, plan, execution):
    state = json.loads(Path(path).read_text(encoding="utf-8"))
    return validate_budget_state(state, plan, execution)


def persist_budget(path, state):
    Path(path).write_text(stable_json(state), encoding="utf-8")
    os.chmod(path, 0o600)


def consume_create_attempt(state):
    usage = state["usage"]["r2Creates"]
    if usage["attempts"] >= state["limits"]["maxR2CreateAttempts"]:
        raise RuntimeError("Recovery lifecycle R2 create attempt budget exhausted")
    usage["attempts"] += 1


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
        "lifecycleUsage": result["lifecycleUsage"],
        "deletedObjectCount": 0,
        "copiedObjectCount": 0,
    }


def persist(path, result):
    Path(path).write_text(stable_json(public_result(result)), encoding="utf-8")


def apply_plan(client, bucket, plan, plan_path, output_path, confirmation, budget_state, budget_state_path):
    root = Path(plan_path).resolve().parent
    execution = validate_plan(plan, confirmation)
    validate_artifacts(root, execution)
    validate_budget_state(budget_state, plan, execution)
    _before, state_digest, _operations = normalize_metadata(client, bucket)
    if state_digest != execution["r2StateDigest"]:
        raise RuntimeError("R2 state changed after planning; write count is zero")
    total = len(execution["originals"]) + len(execution["derivatives"])
    generated_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    result = {
        "planDigest": plan["planDigest"], "status": "running",
        "originalCreatedCount": 0, "originalConcurrentExactSkipCount": 0,
        "derivativeCreatedCount": 0, "derivativeConcurrentExactSkipCount": 0,
        "verifiedObjectCount": 0, "pendingObjectCount": total, "conflictCount": 0,
        "lifecycleUsage": budget_state["usage"],
    }
    persist(output_path, result)
    try:
        for item in execution["originals"]:
            consume_create_attempt(budget_state)
            persist_budget(budget_state_path, budget_state)
            outcome = create_original(client, bucket, root, item, generated_at)
            budget_state["usage"]["r2Creates"]["successes" if outcome == "created" else "exactSkips"] += 1
            persist_budget(budget_state_path, budget_state)
            result["originalCreatedCount" if outcome == "created" else "originalConcurrentExactSkipCount"] += 1
            result["verifiedObjectCount"] += 1
            result["pendingObjectCount"] -= 1
            persist(output_path, result)
        for item in execution["derivatives"]:
            consume_create_attempt(budget_state)
            persist_budget(budget_state_path, budget_state)
            enriched = {**item, "generatedAt": generated_at}
            outcome = RECONCILE.create_or_verify_object(client, bucket, RECONCILE.EXPECTED_BASE_URL, root, enriched, False)
            budget_state["usage"]["r2Creates"]["successes" if outcome == "created" else "exactSkips"] += 1
            persist_budget(budget_state_path, budget_state)
            result["derivativeCreatedCount" if outcome == "created" else "derivativeConcurrentExactSkipCount"] += 1
            result["verifiedObjectCount"] += 1
            result["pendingObjectCount"] -= 1
            persist(output_path, result)
    except Exception:
        budget_state["usage"]["r2Creates"]["failures"] += 1
        persist_budget(budget_state_path, budget_state)
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
    parser.add_argument("--budget-state", required=True)
    args = parser.parse_args()
    plan = json.loads(Path(args.plan).read_text(encoding="utf-8"))
    execution = validate_plan(plan, args.confirm_digest)
    validate_artifacts(Path(args.plan).resolve().parent, execution)
    budget_state = load_budget_state(args.budget_state, plan, execution)
    client, bucket = load_client()
    result = apply_plan(client, bucket, plan, args.plan, args.output, args.confirm_digest, budget_state, args.budget_state)
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
