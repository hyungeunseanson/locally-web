#!/usr/bin/env python3
"""Encrypted, resumable Supabase Storage byte backups to private R2.

The public CLI wrapper is storage-byte-backup.py.  This module intentionally
keeps providers behind small adapters so the safety contracts can be tested
without remote services.
"""

from __future__ import annotations

import argparse
import contextlib
import dataclasses
import datetime as dt
import hashlib
import json
import os
import pathlib
import shutil
import signal
import socket
import stat
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple


SCHEMA = "locally.supabase-storage-backup.v1"
MANIFEST_SCHEMA = "locally.supabase-storage-snapshot.v1"
MULTI_SCHEMA = "locally.authoritative-storage-backup.v2"
MULTI_MANIFEST_SCHEMA = "locally.authoritative-storage-snapshot.v2"
R2_SOURCE_BUCKET = "locally-public-experience-canary"
BUCKETS = (
    "experiences",
    "images",
    "avatars",
    "chat-images",
    "admin_files",
    "verification-docs",
)
PRIVATE_R2_BUCKET = "locally-production-db-backups"
R2_PREFIX = "daily/storage-v1/"
MAX_OBJECTS = 5000
MAX_SOURCE_BYTES = 2 * 1024 * 1024 * 1024
# Two creates per source (ciphertext/checksum), manifest pair, and bounded headroom.
MAX_R2_OBJECTS = 12000
MAX_R2_BYTES = 3 * 1024 * 1024 * 1024
LOCK_DAYS = 30
EXPIRY_DAYS = 35
CHUNK_SIZE = 1024 * 1024
MAX_SOURCE_RETRIES_PER_OBJECT = 1


class BackupError(RuntimeError):
    code = "backup_error"


class ValidationError(BackupError):
    code = "validation_failed"


class BudgetError(BackupError):
    code = "budget_exceeded"


class SourceDriftError(BackupError):
    code = "source_drift"


class SourceTransientError(BackupError):
    code = "source_transient"


class SourceTimeoutError(SourceTransientError):
    code = "source_timeout"


class ConflictError(BackupError):
    code = "conditional_conflict"


DESTINATION_CODES = {
    "destination_access_denied", "destination_precondition_failed", "destination_head_not_found_after_precondition",
    "destination_not_found", "destination_throttled", "destination_provider_5xx", "destination_connect_timeout",
    "destination_read_timeout", "destination_connection_closed", "destination_endpoint_connection",
    "destination_provider_validation_failed", "destination_local_io_failed", "destination_provider_failed",
    "destination_identity_mismatch", "destination_checksum_mismatch", "destination_conditional_conflict",
}
SDK_EXCEPTION_CLASSES = {
    "ClientError", "ConnectTimeoutError", "ReadTimeoutError", "ConnectionClosedError", "ResponseStreamingError",
    "IncompleteReadError", "EndpointConnectionError", "ParamValidationError", "NoCredentialsError",
    "PartialCredentialsError", "TimeoutError", "ConnectionResetError", "ConnectionAbortedError", "BrokenPipeError",
    "FileNotFoundError", "PermissionError", "OSError", "ValidationError", "ConflictError",
}
PROVIDER_ERROR_CODES = {
    "AccessDenied", "InvalidAccessKeyId", "SignatureDoesNotMatch", "ExpiredToken", "PreconditionFailed", "412",
    "NotFound", "NoSuchKey", "404", "SlowDown", "Throttling", "ThrottlingException", "TooManyRequests",
    "InternalError", "InternalServerError", "ServiceUnavailable", "RequestTimeout", "InvalidArgument",
    "InvalidRequest", "ConditionalRequestConflict", "BadDigest", "InvalidDigest",
}
DESTINATION_RETRY_CODES = {
    "destination_throttled", "destination_provider_5xx", "destination_connect_timeout", "destination_read_timeout",
    "destination_connection_closed", "destination_endpoint_connection",
}
MAX_DESTINATION_RETRIES = 1


class DestinationError(BackupError):
    """Only fixed fields can cross the provider exception boundary."""
    def __init__(self, code, operation, error=None, stage=None):
        super().__init__(code)
        self.code, self.operation, self.stage = code, operation, stage
        self.__suppress_context__ = True
        response = getattr(error, "response", {})
        response = response if isinstance(response, dict) else {}
        metadata, detail = response.get("ResponseMetadata"), response.get("Error")
        status = metadata.get("HTTPStatusCode") if isinstance(metadata, dict) else None
        provider_code = detail.get("Code") if isinstance(detail, dict) else None
        name = type(error).__name__
        self.evidence = {
            "sdkExceptionClass": name if name in SDK_EXCEPTION_CLASSES else "Other",
            "httpStatus": status if type(status) is int and 100 <= status <= 599 else None,
            "providerErrorCode": provider_code if isinstance(provider_code, str) and provider_code in PROVIDER_ERROR_CODES else "Other",
            "retryable": code in DESTINATION_RETRY_CODES,
        }


class DestinationConflictError(DestinationError, ConflictError):
    pass


class DestinationChecksumError(DestinationError, ValidationError):
    pass


def destination_error(error, operation, stage=None, *, conditional_create=False):
    safe = DestinationError("destination_provider_failed", operation, error, stage)
    status, code, name = safe.evidence["httpStatus"], safe.evidence["providerErrorCode"], safe.evidence["sdkExceptionClass"]
    if status == 409 and operation == "put_create_only" and conditional_create:
        diagnostic = "destination_conditional_conflict"
    elif status in (401, 403) or code in {"AccessDenied", "InvalidAccessKeyId", "SignatureDoesNotMatch", "ExpiredToken"} or name in {"NoCredentialsError", "PartialCredentialsError"}:
        diagnostic = "destination_access_denied"
    elif status == 412 or code in {"PreconditionFailed", "412"}:
        diagnostic = "destination_precondition_failed"
    elif status == 404 or code in {"NotFound", "NoSuchKey", "404"}:
        diagnostic = "destination_not_found"
    elif code in {"BadDigest", "InvalidDigest"}:
        diagnostic = "destination_checksum_mismatch"
    elif code == "ConditionalRequestConflict":
        diagnostic = "destination_identity_mismatch"
    elif code in {"InvalidArgument", "InvalidRequest"}:
        diagnostic = "destination_provider_validation_failed"
    elif status == 429 or code in {"SlowDown", "Throttling", "ThrottlingException", "TooManyRequests"}:
        diagnostic = "destination_throttled"
    elif status is not None and 500 <= status <= 599:
        diagnostic = "destination_provider_5xx"
    elif name == "ConnectTimeoutError":
        diagnostic = "destination_connect_timeout"
    elif name in {"ReadTimeoutError", "TimeoutError"}:
        diagnostic = "destination_read_timeout"
    elif name in {"ConnectionClosedError", "ResponseStreamingError", "IncompleteReadError", "ConnectionResetError", "ConnectionAbortedError", "BrokenPipeError"}:
        diagnostic = "destination_connection_closed"
    elif name == "EndpointConnectionError":
        diagnostic = "destination_endpoint_connection"
    elif name == "ParamValidationError" or status is not None and 400 <= status <= 499:
        diagnostic = "destination_provider_validation_failed"
    else:
        diagnostic = "destination_provider_failed"
    return DestinationError(diagnostic, operation, error, stage)


def provider_read_error(error: Exception, http_status=None) -> BackupError:
    """Classify fixed SDK types/statuses, never messages, URLs or response bodies."""
    if isinstance(error, BackupError):
        return error
    response = getattr(error, "response", {})
    status = response.get("ResponseMetadata", {}).get("HTTPStatusCode") if isinstance(response, dict) else None
    if http_status is not None:
        status = http_status
    code = response.get("Error", {}).get("Code") if isinstance(response, dict) else None
    name = type(error).__name__
    if status in (401, 403) or code in {"AccessDenied", "InvalidAccessKeyId", "SignatureDoesNotMatch", "ExpiredToken"} or name in {"NoCredentialsError", "PartialCredentialsError"}:
        result, diagnostic = BackupError(), "source_access_denied"
    elif status == 412 or code in {"PreconditionFailed", "412"}:
        result, diagnostic = SourceDriftError(), "source_precondition_failed"
    elif status == 429 or code in {"SlowDown", "Throttling", "ThrottlingException", "TooManyRequests"}:
        result, diagnostic = SourceTransientError(), "source_throttled"
    elif isinstance(status, int) and 500 <= status <= 599:
        result, diagnostic = SourceTransientError(), "source_provider_5xx"
    elif name == "ConnectTimeoutError":
        result, diagnostic = SourceTransientError(), "source_connect_timeout"
    elif name == "ReadTimeoutError" or isinstance(error, (TimeoutError, socket.timeout)):
        result, diagnostic = SourceTransientError(), "source_read_timeout"
    elif name in {"ConnectionClosedError", "ResponseStreamingError", "IncompleteReadError"} or isinstance(error, (ConnectionResetError, ConnectionAbortedError, BrokenPipeError)):
        result, diagnostic = SourceTransientError(), "source_connection_closed"
    elif name == "EndpointConnectionError":
        result, diagnostic = SourceTransientError(), "source_endpoint_connection"
    elif name == "ParamValidationError" or isinstance(status, int) and 400 <= status <= 499:
        result, diagnostic = ValidationError(), "source_provider_validation_failed"
    else:
        result, diagnostic = BackupError(), "source_provider_failed"
    result.code = diagnostic
    return result


class BackupDiagnostics:
    """Durable, allowlisted progress; private provider data never enters output."""
    stages = {"configuration", "database_backup_association", "source_inventory_supabase", "source_inventory_r2",
              "source_revalidation", "prepare_r2_download", "prepare_supabase_download", "preapply_inventory",
              "encryption", "destination_create", "destination_byte_verify", "manifest_publish", "final_inventory"}
    operations = {"validate", "associate", "database_locator_get", "list", "head", "restore_metadata", "inventory",
                  "get", "encrypt", "put_create_only", "verify_bytes", "encrypt_manifest", "publish_manifest", "verify_manifest",
                  "head_after_precondition", "head_after_ambiguous_put", "head_after_conditional_conflict", "destination_head", "destination_local_read"}
    codes = {"backup_error", "validation_failed", "budget_exceeded", "source_drift", "source_timeout", "conditional_conflict",
             "source_access_denied", "source_precondition_failed", "source_throttled", "source_provider_5xx", "source_connect_timeout",
             "source_read_timeout", "source_connection_closed", "source_endpoint_connection", "source_provider_validation_failed",
             "source_provider_failed", "storage_backup_operator_failed", "capture_in_progress", "capture_complete"} | DESTINATION_CODES

    def __init__(self, path: Optional[pathlib.Path] = None):
        self.path, self.started = path, time.monotonic()
        self.stage, self.provider, self.operation = "configuration", "none", "validate"
        self.inventory_stage = None
        self.object_identity = None
        self.source_budget, self.destination_budget = TransferBudget(), TransferBudget()
        self.inventory_attempts, self.inventory_retries = 0, 0

    def at(self, stage: str, provider: str, operation: str, entry=None) -> None:
        if stage not in self.stages or provider not in {"none", "supabase", "r2"} or operation not in self.operations:
            raise ValidationError("invalid diagnostic context")
        self.stage, self.provider, self.operation = stage, provider, operation
        self.object_identity = source_identity(entry["bucket"], entry["key"], entry.get("provider", provider)) if entry else None
        self.write()

    def inventory_at(self, provider: str, operation: str, entry=None) -> None:
        self.at(self.inventory_stage or ("source_inventory_" + provider), provider, operation, entry)

    def summary(self, status="in_progress", code="capture_in_progress", error=None) -> Dict[str, Any]:
        if status not in {"in_progress", "failed", "complete", "dry-run-byte-prepared"} or code not in self.codes:
            status, code = "failed", "storage_backup_operator_failed"
        source, destination = self.source_budget, self.destination_budget
        result = {"status": status, "diagnosticCode": code, "stage": self.stage, "provider": self.provider,
                  "operation": self.operation, "elapsedSeconds": round(time.monotonic() - self.started, 3),
                  "completedObjectCount": source.source_completed_downloads, "completedSourceBytes": source.source_completed_bytes,
                  "sourceAttempts": source.source_attempts, "sourceRetryCount": source.source_retries,
                  "inventoryAttempts": self.inventory_attempts, "inventoryRetryCount": self.inventory_retries,
                  "destinationCreateAttempts": destination.r2_attempts, "destinationRetryCount": destination.r2_retries, "destinationObjectsCreated": destination.new_r2_objects,
                  "destinationBytesCreated": destination.new_r2_bytes, "sourceBudgetUsage": source.as_dict(),
                  "destinationBudgetUsage": destination.as_dict(), "sourceWrites": 0, "sourceDeletes": 0}
        if isinstance(error, DestinationError):
            result.update(error.evidence, stage=error.stage or self.stage, provider="r2", operation=error.operation)
        if self.object_identity:
            result["objectIdentityHash"] = self.object_identity
        return result

    def write(self) -> None:
        if self.path:
            temporary = self.path.with_suffix(self.path.suffix + ".progress.tmp")
            safe_write_json(temporary, self.summary())
            os.replace(temporary, self.path)


def scan_source(source: Any, diagnostics: Optional[BackupDiagnostics], stage: str):
    if diagnostics:
        diagnostics.inventory_stage = stage
        diagnostics.at(stage, "none", "inventory")
    entries = source.inventory()
    if diagnostics:
        diagnostics.at(stage, "none", "inventory")
    return entries


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_utc(value: str) -> dt.datetime:
    if not isinstance(value, str) or not value.endswith("Z"):
        raise ValidationError("invalid UTC timestamp")
    try:
        return dt.datetime.fromisoformat(value[:-1] + "+00:00")
    except ValueError as exc:
        raise ValidationError("invalid UTC timestamp") from exc


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: pathlib.Path) -> Tuple[str, int]:
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(CHUNK_SIZE), b""):
            size += len(chunk)
            digest.update(chunk)
    return digest.hexdigest(), size


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def without_digest(plan: Mapping[str, Any]) -> Dict[str, Any]:
    return {key: value for key, value in plan.items() if key != "planDigest"}


def plan_digest(plan: Mapping[str, Any]) -> str:
    return sha256_bytes(canonical_json(without_digest(plan)))


def source_identity(bucket: str, key: str, provider: str = "supabase") -> str:
    # Preserve proven v1 Supabase identities; R2 has a disjoint namespace.
    prefix = "" if provider == "supabase" else provider + "\0"
    return sha256_bytes((prefix + bucket + "\0" + key).encode("utf-8"))


def safe_write_json(path: pathlib.Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
    fd = os.open(str(path), flags, 0o600)
    try:
        with os.fdopen(fd, "wb") as output:
            output.write(canonical_json(value))
            output.write(b"\n")
    except BaseException:
        try:
            os.close(fd)
        except OSError:
            pass
        raise


def read_private_json(path: pathlib.Path) -> Dict[str, Any]:
    if not path.is_file() or path.is_symlink():
        raise ValidationError("plan must be a regular file")
    mode = stat.S_IMODE(path.stat().st_mode)
    if mode & 0o077:
        raise ValidationError("plan permissions must not allow group/other access")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValidationError("invalid plan file") from exc
    if not isinstance(value, dict):
        raise ValidationError("invalid plan root")
    return value


def require_bounded_int(value: Any, name: str, maximum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0 or value > maximum:
        raise ValidationError(f"invalid {name}")
    return value


def validate_limits(limits: Mapping[str, Any]) -> None:
    expected = {
        "maxSourceObjects": MAX_OBJECTS,
        "maxSourceBytes": MAX_SOURCE_BYTES,
        "maxNewR2Objects": MAX_R2_OBJECTS,
        "maxNewR2Bytes": MAX_R2_BYTES,
    }
    if dict(limits) != expected:
        raise ValidationError("plan limits differ from hard ceilings")


def validate_object_entry(entry: Mapping[str, Any], prepared: bool) -> None:
    allowed = {
        "bucket", "key", "identity", "size", "contentType", "metadata", "sourceVersion",
        "sourceEtag", "sourceUpdatedAt", "sourceSha256", "cacheFile", "ciphertextKey",
        "ciphertextChecksumKey", "proof", "reuse", "ciphertextSha256", "ciphertextSize",
        "expiresAt", "disposition",
        "provider", "authority", "httpMetadata", "customMetadata", "dbReferences",
    }
    if set(entry) - allowed:
        raise ValidationError("unsupported object field")
    bucket = entry.get("bucket")
    key = entry.get("key")
    provider = entry.get("provider", "supabase")
    valid_bucket = (provider == "supabase" and bucket in BUCKETS) or (provider == "r2" and bucket == R2_SOURCE_BUCKET)
    if not valid_bucket or not isinstance(key, str) or not key or "\x00" in key:
        raise ValidationError("invalid source object identity")
    key_path = pathlib.PurePosixPath(key)
    if key_path.is_absolute() or ".." in key_path.parts or "." in key_path.parts:
        raise ValidationError("unsafe source object key")
    if provider == "r2" and not key.startswith(("originals/", "sources/")):
        raise ValidationError("R2 source is not an original")
    if entry.get("identity") != source_identity(bucket, key, provider):
        raise ValidationError("source identity mismatch")
    require_bounded_int(entry.get("size"), "source size", MAX_SOURCE_BYTES)
    for name in ("contentType", "sourceVersion", "sourceEtag", "sourceUpdatedAt"):
        if entry.get(name) is not None and not isinstance(entry.get(name), str):
            raise ValidationError(f"invalid {name}")
    if not isinstance(entry.get("metadata"), dict):
        raise ValidationError("invalid source metadata")
    if "provider" in entry:
        if not isinstance(entry.get("dbReferences"), list):
            raise ValidationError("missing locator association")
        for field in ("httpMetadata", "customMetadata"):
            if field in entry and not isinstance(entry[field], dict):
                raise ValidationError("invalid restore metadata")
        mime = (entry.get("contentType") or "").split(";", 1)[0].lower()
        restored_mime = (entry.get("httpMetadata", {}).get("ContentType") or mime).split(";", 1)[0].lower()
        if not mime or mime != restored_mime:
            raise ValidationError("restore MIME mismatch")
    if prepared:
        digest = entry.get("sourceSha256")
        if not isinstance(digest, str) or len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
            raise ValidationError("missing prepared source SHA")
        if entry.get("proof") not in {"downloaded-byte-sha256", "reused-prior-byte-sha256"}:
            raise ValidationError("invalid source proof")
        if entry.get("reuse"):
            if entry.get("cacheFile") is not None:
                raise ValidationError("reused object must not use cache")
        elif not isinstance(entry.get("cacheFile"), str):
            raise ValidationError("prepared object missing cache file")
        identity = entry["identity"]
        for name in ("ciphertextKey", "ciphertextChecksumKey"):
            value = entry.get(name)
            if not isinstance(value, str) or not value.startswith(R2_PREFIX) or identity not in value:
                raise ValidationError("invalid private R2 object key")


def validate_plan(plan: Mapping[str, Any], confirm_digest: Optional[str] = None, require_prepared: bool = False) -> None:
    if (plan.get("schema"), plan.get("version")) not in {(SCHEMA, 1), (MULTI_SCHEMA, 2)}:
        raise ValidationError("unsupported plan schema")
    if plan.get("mode") not in {"plan", "prepared"}:
        raise ValidationError("invalid plan mode")
    if require_prepared and plan.get("mode") != "prepared":
        raise ValidationError("apply requires a prepared plan")
    if plan.get("projectRef") != "uhinvcydgzqlpnvieyal":
        raise ValidationError("unexpected Supabase project")
    if plan.get("destinationBucket") != PRIVATE_R2_BUCKET:
        raise ValidationError("unexpected R2 destination")
    snapshot_id = plan.get("snapshotId")
    if not isinstance(snapshot_id, str) or not snapshot_id or any(c not in "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-" for c in snapshot_id):
        raise ValidationError("invalid snapshot id")
    prefix = plan.get("destinationPrefix")
    if prefix != f"{R2_PREFIX}{snapshot_id}/":
        raise ValidationError("unexpected destination prefix")
    parse_utc(plan.get("capturedAt"))
    parse_utc(plan.get("expiresAt"))
    if plan.get("retention") != {"lockDays": LOCK_DAYS, "expiryDays": EXPIRY_DAYS}:
        raise ValidationError("unexpected retention contract")
    database_backup = plan.get("databaseBackup")
    if not isinstance(database_backup, dict) or not isinstance(database_backup.get("id"), str) or not database_backup["id"]:
        raise ValidationError("missing database backup relation")
    parse_utc(database_backup.get("capturedAt"))
    if database_backup.get("atomicWithStorage") is not False:
        raise ValidationError("database/storage snapshot must not claim atomicity")
    if plan.get("mode") == "prepared":
        parse_utc(plan.get("preparedAt"))
        parse_utc(plan.get("manifestCreatedAt"))
    validate_limits(plan.get("limits") or {})
    entries = plan.get("objects")
    if not isinstance(entries, list) or len(entries) > MAX_OBJECTS:
        raise ValidationError("invalid object list")
    identities = set()
    source_total = 0
    for entry in entries:
        if not isinstance(entry, dict):
            raise ValidationError("invalid object entry")
        validate_object_entry(entry, plan.get("mode") == "prepared")
        if plan["version"] == 2 and entry.get("provider") not in {"supabase", "r2"}:
            raise ValidationError("multi-source entry lacks provider")
        if entry["identity"] in identities:
            raise ValidationError("duplicate object identity")
        identities.add(entry["identity"])
        source_total += entry["size"]
        if plan.get("mode") == "prepared":
            expected_base = f"{prefix}objects/{entry['identity'][:2]}/{entry['identity']}.age"
            if not entry.get("reuse") and (entry["ciphertextKey"] != expected_base or entry["ciphertextChecksumKey"] != expected_base + ".sha256"):
                raise ValidationError("object key is not canonical")
    if source_total > MAX_SOURCE_BYTES:
        raise ValidationError("planned source bytes exceed ceiling")
    summary = plan.get("summary")
    if not isinstance(summary, dict) or summary.get("objectCount") != len(entries) or summary.get("sourceBytes") != source_total:
        raise ValidationError("plan summary mismatch")
    digest = plan_digest(plan)
    if plan.get("planDigest") != digest:
        raise ValidationError("plan digest mismatch")
    if confirm_digest is not None and confirm_digest != digest:
        raise ValidationError("confirmation digest mismatch")


def metadata_fingerprint(entry: Mapping[str, Any]) -> Dict[str, Any]:
    result = {
        "bucket": entry["bucket"],
        "key": entry["key"],
        "identity": entry["identity"],
        "size": entry["size"],
        "contentType": entry.get("contentType"),
        "sourceVersion": entry.get("sourceVersion"),
        "sourceEtag": entry.get("sourceEtag"),
        "sourceUpdatedAt": entry.get("sourceUpdatedAt"),
    }
    if "provider" in entry:
        result.update({key: entry.get(key) for key in ("provider", "authority", "metadata", "httpMetadata", "customMetadata", "dbReferences")})
    return result


def inventory_digest(entries: Sequence[Mapping[str, Any]]) -> str:
    return sha256_bytes(canonical_json([metadata_fingerprint(entry) for entry in sorted(entries, key=lambda item: (item["bucket"], item["key"]))]))


@contextlib.contextmanager
def payload_read_deadline(seconds: float):
    """Bound a blocking response-body read in the main CLI process."""
    if seconds <= 0 or not hasattr(signal, "setitimer"):
        raise ValidationError("payload deadline is unavailable")

    previous_handler = signal.getsignal(signal.SIGALRM)

    def handle_timeout(_signum, _frame):
        raise SourceTimeoutError("Supabase Storage payload read timed out")

    signal.signal(signal.SIGALRM, handle_timeout)
    previous_timer = signal.setitimer(signal.ITIMER_REAL, seconds)
    try:
        yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous_handler)
        if previous_timer[0] > 0:
            signal.setitimer(signal.ITIMER_REAL, *previous_timer)


def bind_resume_cache(cache_dir: pathlib.Path, plan: Mapping[str, Any]) -> None:
    marker = cache_dir / ".plan-digest"
    if marker.exists():
        if marker.is_symlink() or not marker.is_file() or stat.S_IMODE(marker.stat().st_mode) != 0o600 or marker.read_text(encoding="ascii").strip() != plan["planDigest"]:
            raise ValidationError("resume cache is not bound to this plan")
        return
    if any(cache_dir.iterdir()):
        raise ValidationError("non-empty resume cache is missing its plan binding")
    marker.write_text(plan["planDigest"] + "\n", encoding="ascii")
    os.chmod(marker, 0o600)


def resume_or_download_source(
    source: Any, entry: Mapping[str, Any], cache_path: pathlib.Path, budget: "TransferBudget",
) -> Mapping[str, Optional[str]]:
    if cache_path.is_symlink():
        raise ValidationError("unsafe resume cache file")
    if cache_path.exists():
        if cache_path.is_symlink() or not cache_path.is_file() or stat.S_IMODE(cache_path.stat().st_mode) != 0o600:
            raise ValidationError("unsafe resume cache file")
        digest, size = sha256_file(cache_path)
        if size != entry["size"]:
            raise ValidationError("resume cache file size differs from plan")
        budget.cached_source_objects += 1
        budget.cached_source_bytes += size
        return {"sha256": digest, "etag": entry.get("sourceEtag"), "contentType": entry.get("contentType")}
    for retry in range(MAX_SOURCE_RETRIES_PER_OBJECT + 1):
        if cache_path.exists() or cache_path.is_symlink():
            raise ValidationError("partial source cache file remains before retry")
        if retry:
            budget.source_retries += 1
        try:
            result = source.download(entry, cache_path, budget)
        except SourceTransientError:
            if retry == MAX_SOURCE_RETRIES_PER_OBJECT:
                raise
            continue
        budget.source_completed_downloads += 1
        budget.source_completed_bytes += entry["size"]
        return result
    raise AssertionError("unreachable source retry state")


@dataclasses.dataclass
class TransferBudget:
    max_source_objects: int = MAX_OBJECTS
    max_source_bytes: int = MAX_SOURCE_BYTES
    max_new_r2_objects: int = MAX_R2_OBJECTS
    max_new_r2_bytes: int = MAX_R2_BYTES
    source_attempts: int = 0  # Remote GET attempts, including timed-out attempts.
    source_bytes: int = 0  # All received network bytes, including failed attempts.
    source_retries: int = 0
    source_completed_downloads: int = 0
    source_completed_bytes: int = 0
    cached_source_objects: int = 0
    cached_source_bytes: int = 0
    r2_attempts: int = 0
    r2_retries: int = 0
    new_r2_objects: int = 0
    new_r2_bytes: int = 0

    def begin_source(self) -> None:
        if self.source_attempts >= self.max_source_objects:
            raise BudgetError("source object attempt ceiling reached")
        self.source_attempts += 1

    def receive_source(self, amount: int) -> None:
        if amount < 0:
            raise BudgetError("invalid source byte count")
        self.source_bytes += amount
        if self.source_bytes > self.max_source_bytes:
            raise BudgetError("source byte ceiling reached")

    def begin_r2(self, size: int) -> None:
        if self.r2_attempts >= self.max_new_r2_objects:
            raise BudgetError("R2 object attempt ceiling reached")
        if size < 0 or self.new_r2_bytes + size > self.max_new_r2_bytes:
            raise BudgetError("R2 byte ceiling reached")
        self.r2_attempts += 1

    def created_r2(self, size: int) -> None:
        self.new_r2_objects += 1
        self.new_r2_bytes += size

    def as_dict(self) -> Dict[str, int]:
        return dataclasses.asdict(self)


def supabase_api_key_headers(api_key: str) -> Dict[str, str]:
    """Mirror the JS transport contract; API-key format is not authorization."""
    if not isinstance(api_key, str) or not api_key.strip() or any(char.isspace() for char in api_key.strip()):
        raise ValidationError("invalid Supabase API credential")
    key = api_key.strip()
    headers = {"apikey": key, "content-type": "application/json"}
    if not key.startswith(("sb_secret_", "sb_publishable_")):
        headers["authorization"] = "Bearer " + key
    return headers


class SupabaseStorageSource:
    def __init__(self, project_url: str, service_role_key: str, timeout: float = 30.0, diagnostics=None):
        parsed = urllib.parse.urlparse(project_url)
        if parsed.scheme != "https" or parsed.hostname != "uhinvcydgzqlpnvieyal.supabase.co" or parsed.path not in {"", "/"}:
            raise ValidationError("unexpected Supabase origin")
        self.base = project_url.rstrip("/")
        self.key = supabase_api_key_headers(service_role_key)["apikey"]
        self.timeout = timeout
        self.diagnostics = diagnostics

    def _request(self, method: str, path: str, body: Optional[bytes] = None) -> urllib.response.addinfourl:
        if self.diagnostics and not path.startswith("/storage/v1/object/authenticated/"):
            self.diagnostics.inventory_attempts += 1
            operation = "database_locator_get" if path.startswith("/rest/") else "restore_metadata" if "/object/info/" in path else "list"
            # The caller supplies the opaque identity for object-info requests.
            self.diagnostics.operation = operation
            self.diagnostics.provider = "supabase"
            self.diagnostics.write()
        request = urllib.request.Request(
            self.base + path,
            data=body,
            method=method,
            headers=supabase_api_key_headers(self.key),
        )
        try:
            return urllib.request.urlopen(request, timeout=self.timeout)
        except urllib.error.HTTPError as exc:
            raise provider_read_error(exc, http_status=exc.code) from None
        except urllib.error.URLError as exc:
            if isinstance(exc.reason, (TimeoutError, ConnectionResetError, ConnectionAbortedError)):
                raise provider_read_error(exc.reason) from None
            failure = SourceTransientError(); failure.code = "source_endpoint_connection"
            raise failure from None
        except TimeoutError as exc:
            raise provider_read_error(exc) from None

    def _list_directory(self, bucket: str, prefix: str) -> Iterable[Dict[str, Any]]:
        offset = 0
        limit = 100
        while True:
            if self.diagnostics:
                self.diagnostics.inventory_at("supabase", "list")
            payload = canonical_json({"prefix": prefix, "limit": limit, "offset": offset, "sortBy": {"column": "name", "order": "asc"}})
            response = self._request("POST", "/storage/v1/object/list/" + urllib.parse.quote(bucket, safe=""), payload)
            try:
                page = json.load(response)
            except (ValueError, TypeError) as exc:
                raise BackupError("Supabase Storage list returned invalid JSON") from exc
            if not isinstance(page, list):
                raise BackupError("Supabase Storage list returned invalid shape")
            for item in page:
                if not isinstance(item, dict) or not isinstance(item.get("name"), str):
                    raise BackupError("Supabase Storage list item invalid")
                yield item
            if len(page) < limit:
                break
            offset += len(page)

    def inventory(self) -> List[Dict[str, Any]]:
        entries: List[Dict[str, Any]] = []
        for bucket in BUCKETS:
            pending = [""]
            visited = set()
            while pending:
                prefix = pending.pop()
                if prefix in visited:
                    raise BackupError("Storage listing repeated a directory")
                visited.add(prefix)
                for item in self._list_directory(bucket, prefix):
                    name = item["name"]
                    full = f"{prefix}/{name}" if prefix else name
                    metadata = item.get("metadata")
                    if metadata is None:
                        pending.append(full)
                        continue
                    if not isinstance(metadata, dict):
                        raise BackupError("Storage object metadata invalid")
                    size = metadata.get("size")
                    if isinstance(size, str) and size.isdigit():
                        size = int(size)
                    require_bounded_int(size, "source size", MAX_SOURCE_BYTES)
                    entry = {
                        "bucket": bucket,
                        "key": full,
                        "identity": source_identity(bucket, full),
                        "size": size,
                        "contentType": metadata.get("mimetype") or metadata.get("contentType"),
                        "metadata": metadata,
                        "sourceVersion": item.get("version"),
                        "sourceEtag": item.get("etag") or metadata.get("eTag") or metadata.get("etag"),
                        "sourceUpdatedAt": item.get("updated_at") or item.get("updatedAt"),
                        "sourceSha256": None,
                        "cacheFile": None,
                        "ciphertextKey": None,
                        "ciphertextChecksumKey": None,
                        "proof": "metadata-only",
                        "reuse": None,
                    }
                    entries.append(entry)
        entries.sort(key=lambda item: (item["bucket"], item["key"]))
        return entries

    def restore_metadata(self, entry: Mapping[str, Any]) -> Dict[str, Any]:
        if self.diagnostics:
            self.diagnostics.inventory_at("supabase", "restore_metadata", entry)
        path = "/storage/v1/object/info/" + urllib.parse.quote(entry["bucket"], safe="") + "/" + urllib.parse.quote(entry["key"], safe="/")
        with self._request("GET", path) as response:
            info = json.load(response)
        if not isinstance(info, dict) or info.get("size") != entry["size"] or info.get("content_type") != entry["contentType"]:
            raise SourceDriftError("Storage info differs from listed identity")
        custom = info.get("metadata") or {}
        if not isinstance(custom, dict):
            raise ValidationError("Storage custom metadata invalid")
        return {"httpMetadata": {"ContentType": info["content_type"], "CacheControl": info.get("cache_control")},
                "customMetadata": custom, "sourceVersion": info.get("version"),
                "sourceEtag": info.get("etag"), "sourceUpdatedAt": info.get("last_modified")}

    def download(self, entry: Mapping[str, Any], destination: pathlib.Path, budget: TransferBudget) -> Mapping[str, Optional[str]]:
        budget.begin_source()
        if self.diagnostics:
            self.diagnostics.at("prepare_supabase_download", "supabase", "get", entry)
        encoded_bucket = urllib.parse.quote(entry["bucket"], safe="")
        encoded_key = urllib.parse.quote(entry["key"], safe="/")
        response = self._request("GET", f"/storage/v1/object/authenticated/{encoded_bucket}/{encoded_key}")
        destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
        fd = os.open(str(destination), flags, 0o600)
        digest = hashlib.sha256()
        size = 0
        try:
            planned_etag, received_etag = entry.get("sourceEtag"), response.headers.get("ETag")
            # Storage exposes ETag; version headers are compared when supplied.
            if planned_etag and (not received_etag or planned_etag.strip('"') != received_etag.strip('"')):
                raise SourceDriftError("downloaded source ETag differs from plan")
            received_version = response.headers.get("x-version-id") or response.headers.get("x-amz-version-id")
            if entry.get("sourceVersion") and received_version and received_version != entry["sourceVersion"]:
                raise SourceDriftError("downloaded source version differs from plan")
            with os.fdopen(fd, "wb") as output:
                while True:
                    try:
                        with payload_read_deadline(self.timeout):
                            chunk = response.read(CHUNK_SIZE)
                    except TimeoutError as exc:
                        raise SourceTimeoutError("Supabase Storage payload read timed out") from exc
                    if not chunk:
                        break
                    budget.receive_source(len(chunk))
                    output.write(chunk)
                    digest.update(chunk)
                    size += len(chunk)
        except BaseException:
            # If identity validation failed before fdopen, close the raw fd too.
            try:
                os.close(fd)
            except OSError:
                pass
            destination.unlink(missing_ok=True)
            raise
        finally:
            response.close()
        if size != entry["size"]:
            destination.unlink(missing_ok=True)
            raise SourceDriftError("downloaded source size differs from plan")
        return {"sha256": digest.hexdigest(), "etag": response.headers.get("ETag"), "contentType": response.headers.get("Content-Type")}


def walk_string_leaves(value: Any, path: str = "$"):
    if isinstance(value, str):
        yield path, value
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from walk_string_leaves(child, f"{path}[{index}]")
    elif isinstance(value, dict):
        for name, child in value.items():
            yield from walk_string_leaves(child, path + "." + name)


def source_locator(value: str, field: str = "") -> Optional[Tuple[str, str, str]]:
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme == "https" and parsed.hostname == "media-canary.locally-travel.com":
        path = urllib.parse.unquote(parsed.path)
        normalized = urllib.parse.urlsplit(urllib.parse.urljoin("https://media-canary.locally-travel.com/", path))
        if normalized.hostname != "media-canary.locally-travel.com":
            return None
        key = normalized.path.lstrip("/")
        if key.startswith(("originals/", "sources/")):
            return "r2", R2_SOURCE_BUCKET, key
    if parsed.scheme == "https" and parsed.hostname == "uhinvcydgzqlpnvieyal.supabase.co":
        parts = urllib.parse.unquote(parsed.path).split("/")
        if len(parts) >= 7 and parts[1:4] == ["storage", "v1", "object"] and parts[4] in {"public", "authenticated", "sign"}:
            return "supabase", parts[5], "/".join(parts[6:])
    if field == "id_card_file" and value.startswith("id_card/"):
        return "supabase", "verification-docs", value
    if value.startswith("/api/admin/files/"):
        return "supabase", "admin_files", urllib.parse.unquote(value[len("/api/admin/files/"):])
    return None


def database_references(source: SupabaseStorageSource, include_managed_assets: bool = False) -> Dict[Tuple[str, str, str], List[Dict[str, Any]]]:
    """Capture only locator associations, never entire business rows in a manifest."""
    tables = {
        "experiences": "id,host_id,photos,image_url,itinerary,itinerary_i18n",
        "profiles": "id,avatar_url",
        "host_applications": "id,user_id,profile_photo,id_card_file",
        "community_posts": "id,user_id,images",
        "inquiry_messages": "id,image_url",
        "admin_tasks": "*",
        "admin_task_comments": "*",
    }
    refs: Dict[Tuple[str, str, str], List[Dict[str, Any]]] = {}
    for table, fields in tables.items():
        offset, limit = 0, 500
        while True:
            query = urllib.parse.urlencode({"select": fields, "order": "id.asc", "offset": offset, "limit": limit})
            with source._request("GET", "/rest/v1/" + table + "?" + query) as response:
                rows = json.load(response)
            if not isinstance(rows, list):
                raise BackupError("database locator page invalid")
            for row in rows:
                if not isinstance(row, dict) or row.get("id") is None:
                    raise BackupError("database locator row invalid")
                for field, value in row.items():
                    for path, leaf in walk_string_leaves(value):
                        location = source_locator(leaf, field)
                        if location:
                            # Strip any query: signed capabilities never enter a manifest.
                            locator = leaf.split("?", 1)[0]
                            refs.setdefault(location, []).append({
                                "relation": table, "rowId": str(row["id"]), "field": field,
                                "jsonPath": path, "locator": locator,
                            })
            if len(rows) < limit:
                break
            offset += len(rows)
    if include_managed_assets:
        offset, limit = 0, 500
        while True:
            query = urllib.parse.urlencode({"select":"id,provider,bucket,object_key,public_url,state,expected_sha256,expected_size", "deleted_at":"is.null", "order":"id.asc", "limit":limit, "offset":offset})
            with source._request("GET", "/rest/v1/media_assets?" + query) as response:
                rows = json.load(response)
            if not isinstance(rows, list):
                raise ValidationError("managed asset association unavailable")
            for row in rows:
                location = (row["provider"],row["bucket"],row["object_key"])
                refs.setdefault(location, []).append({"relation":"media_assets", "rowId":str(row["id"]), "field":"object_key", "jsonPath":"$",
                    "locator":row.get("public_url"), "optionalPending":row["state"]=="pending", "expectedSha256":row["expected_sha256"], "expectedSize":row["expected_size"]})
            if len(rows) < limit:
                break
            offset += len(rows)
    for values in refs.values():
        values.sort(key=lambda value: canonical_json(value))
    return refs


class R2StorageSource:
    """Read-only original adapter. Deliberately has no PUT/COPY/DELETE method."""
    def __init__(self, client: Any, bucket: str = R2_SOURCE_BUCKET, timeout: float = 30.0, diagnostics=None):
        if bucket != R2_SOURCE_BUCKET:
            raise ValidationError("unexpected R2 source bucket")
        self.client, self.bucket, self.timeout = client, bucket, timeout
        self.diagnostics = diagnostics

    def _inventory_read(self, operation: str, entry=None, **params):
        for retry in range(MAX_SOURCE_RETRIES_PER_OBJECT + 1):
            if self.diagnostics:
                self.diagnostics.inventory_attempts += 1
                self.diagnostics.inventory_retries += bool(retry)
                self.diagnostics.inventory_at("r2", operation, entry)
            try:
                return getattr(self.client, "list_objects_v2" if operation == "list" else "head_object")(**params)
            except Exception as error:
                classified = provider_read_error(error)
                if isinstance(classified, SourceTransientError) and retry < MAX_SOURCE_RETRIES_PER_OBJECT:
                    continue
                raise classified from None

    def inventory(self, references: Mapping[Tuple[str, str, str], Any]) -> List[Dict[str, Any]]:
        listed = {}
        try:
            for prefix in ("originals/", "sources/"):
                token, seen = None, set()
                while True:
                    params = {"Bucket": self.bucket, "Prefix": prefix, "MaxKeys": 1000}
                    if token:
                        params["ContinuationToken"] = token
                    page = self._inventory_read("list", **params)
                    for item in page.get("Contents", []):
                        key = item["Key"]
                        if key in listed or not key.startswith(prefix):
                            raise ValidationError("R2 list duplicate or wrong prefix")
                        listed[key] = item
                    if not page.get("IsTruncated"):
                        break
                    token = page.get("NextContinuationToken")
                    if not token or token in seen:
                        raise ValidationError("R2 pagination incomplete")
                    seen.add(token)
            entries = []
            for (provider, bucket, key), associations in sorted(references.items()):
                if provider != "r2":
                    continue
                if bucket != self.bucket:
                    raise ValidationError("unexpected R2 source authority")
                if self.diagnostics:
                    self.diagnostics.inventory_at("r2", "head", {"bucket":bucket, "key":key, "provider":"r2"})
                if key not in listed:
                    if associations and all(ref.get("optionalPending") is True for ref in associations):
                        continue
                    raise SourceDriftError("referenced R2 original missing")
                head = self._inventory_read("head", {"bucket":bucket, "key":key, "provider":"r2"}, Bucket=bucket, Key=key)
                size = head["ContentLength"]
                if size != listed[key]["Size"]:
                    raise SourceDriftError("R2 list/head changed")
                modified = head.get("LastModified")
                modified = modified.isoformat() if hasattr(modified, "isoformat") else str(modified or "")
                entries.append({
                    "provider": "r2", "authority": "production-db-reference",
                    "bucket": bucket, "key": key, "identity": source_identity(bucket, key, "r2"),
                    "size": size, "contentType": head.get("ContentType"),
                    "metadata": {"size": size},
                    "httpMetadata": {name: head.get(name) for name in ("ContentType", "CacheControl", "ContentDisposition", "ContentEncoding", "ContentLanguage")},
                    "customMetadata": head.get("Metadata", {}),
                    "dbReferences": associations,
                    "sourceVersion": head.get("VersionId"), "sourceEtag": head.get("ETag"),
                    "sourceUpdatedAt": modified, "sourceSha256": None, "cacheFile": None,
                    "ciphertextKey": None, "ciphertextChecksumKey": None, "proof": "metadata-only", "reuse": None,
                })
            return entries
        except BackupError:
            raise
        except Exception as error:
            raise provider_read_error(error) from None

    def download(self, entry: Mapping[str, Any], destination: pathlib.Path, budget: TransferBudget) -> Mapping[str, Optional[str]]:
        budget.begin_source()
        if self.diagnostics:
            self.diagnostics.at("prepare_r2_download", "r2", "get", entry)
        destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        body = None
        try:
            response = self.client.get_object(Bucket=self.bucket, Key=entry["key"], IfMatch=entry["sourceEtag"])
            body = response["Body"]
            fd = os.open(str(destination), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            digest, size = hashlib.sha256(), 0
            with os.fdopen(fd, "wb") as output:
                while True:
                    with payload_read_deadline(self.timeout):
                        chunk = body.read(CHUNK_SIZE)
                    if not chunk:
                        break
                    budget.receive_source(len(chunk))
                    output.write(chunk)
                    digest.update(chunk)
                    size += len(chunk)
            if size != entry["size"] or response.get("ETag") != entry["sourceEtag"]:
                raise SourceDriftError("R2 downloaded version differs")
            return {"sha256": digest.hexdigest(), "etag": response.get("ETag"), "contentType": response.get("ContentType")}
        except BackupError:
            destination.unlink(missing_ok=True)
            raise
        except Exception as error:
            destination.unlink(missing_ok=True)
            raise provider_read_error(error) from None
        finally:
            if body is not None:
                body.close()


class MultiStorageSource:
    def __init__(self, supabase: SupabaseStorageSource, r2: R2StorageSource, reference_reader=database_references, diagnostics=None):
        self.supabase, self.r2, self.reference_reader = supabase, r2, reference_reader
        self.diagnostics = diagnostics

    def inventory(self) -> List[Dict[str, Any]]:
        if self.diagnostics:
            self.diagnostics.inventory_at("supabase", "database_locator_get")
        refs = self.reference_reader(self.supabase)
        entries = []
        for old in self.supabase.inventory():
            entry = dict(old, provider="supabase", authority="recoverable-source", **self.supabase.restore_metadata(old))
            entry["dbReferences"] = refs.get(("supabase", old["bucket"], old["key"]), [])
            entries.append(entry)
        if self.diagnostics:
            self.diagnostics.inventory_at("r2", "list")
        entries.extend(self.r2.inventory(refs))
        return sorted(entries, key=lambda item: (item["provider"], item["bucket"], item["key"]))

    def download(self, entry: Mapping[str, Any], destination: pathlib.Path, budget: TransferBudget):
        provider = entry.get("provider")
        if provider not in {"supabase", "r2"}:
            raise ValidationError("unknown source provider")
        return (self.supabase if provider == "supabase" else self.r2).download(entry, destination, budget)


def make_plan(entries: Sequence[Mapping[str, Any]], snapshot_id: str, db_backup_id: str, db_backup_time: str, captured_at: Optional[str] = None) -> Dict[str, Any]:
    captured = captured_at or utc_now()
    expires = (parse_utc(captured) + dt.timedelta(days=EXPIRY_DAYS)).isoformat().replace("+00:00", "Z")
    objects = [dict(entry) for entry in entries]
    plan: Dict[str, Any] = {
        "schema": MULTI_SCHEMA if any("provider" in entry for entry in entries) else SCHEMA,
        "version": 2 if any("provider" in entry for entry in entries) else 1,
        "mode": "plan",
        "projectRef": "uhinvcydgzqlpnvieyal",
        "destinationBucket": PRIVATE_R2_BUCKET,
        "snapshotId": snapshot_id,
        "destinationPrefix": f"{R2_PREFIX}{snapshot_id}/",
        "capturedAt": captured,
        "expiresAt": expires,
        "retention": {"lockDays": LOCK_DAYS, "expiryDays": EXPIRY_DAYS},
        "databaseBackup": {"id": db_backup_id, "capturedAt": db_backup_time, "atomicWithStorage": False},
        "inventoryDigest": inventory_digest(objects),
        "limits": {
            "maxSourceObjects": MAX_OBJECTS,
            "maxSourceBytes": MAX_SOURCE_BYTES,
            "maxNewR2Objects": MAX_R2_OBJECTS,
            "maxNewR2Bytes": MAX_R2_BYTES,
        },
        "summary": {"objectCount": len(objects), "sourceBytes": sum(item["size"] for item in objects)},
        "objects": objects,
    }
    plan["planDigest"] = plan_digest(plan)
    validate_plan(plan)
    return plan


def previous_by_identity(previous: Optional[Mapping[str, Any]], now: dt.datetime) -> Dict[str, Mapping[str, Any]]:
    if previous is None:
        return {}
    if previous.get("schema") not in {MANIFEST_SCHEMA, MULTI_MANIFEST_SCHEMA} or previous.get("status") != "complete":
        raise ValidationError("previous manifest is not complete")
    recoverable_until = parse_utc(previous.get("recoverableUntil"))
    if recoverable_until <= now:
        raise ValidationError("previous snapshot references have expired")
    result = {}
    for entry in previous.get("objects", []):
        if isinstance(entry, dict) and isinstance(entry.get("identity"), str):
            result[entry["identity"]] = entry
    return result


def prepare_plan(
    plan: Mapping[str, Any], source: Any, cache_dir: pathlib.Path,
    previous: Optional[Mapping[str, Any]] = None, now: Optional[dt.datetime] = None,
    diagnostics: Optional[BackupDiagnostics] = None,
) -> Tuple[Dict[str, Any], TransferBudget]:
    validate_plan(plan)
    if cache_dir.is_symlink():
        raise ValidationError("unsafe resume cache directory")
    cache_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(cache_dir, 0o700)
    bind_resume_cache(cache_dir, plan)
    current = scan_source(source, diagnostics, "source_revalidation")
    if inventory_digest(current) != plan["inventoryDigest"]:
        raise SourceDriftError("source inventory changed before prepare")
    prior = previous_by_identity(previous, now or dt.datetime.now(dt.timezone.utc))
    budget = diagnostics.source_budget if diagnostics else TransferBudget()
    prepared = dict(plan)
    prepared["mode"] = "prepared"
    prepared_objects = []
    prefix = plan["destinationPrefix"]
    for approved in plan["objects"]:
        entry = dict(approved)
        if diagnostics:
            diagnostics.at("prepare_r2_download" if entry.get("provider") == "r2" else "prepare_supabase_download",
                           entry.get("provider", "supabase"), "get", entry)
        identity = entry["identity"]
        old = prior.get(identity)
        if old and metadata_fingerprint(old) == metadata_fingerprint(entry):
            for required in ("sourceSha256", "ciphertextKey", "ciphertextChecksumKey", "ciphertextSha256", "ciphertextSize", "expiresAt"):
                if not old.get(required):
                    raise ValidationError("previous manifest is missing reusable proof")
            if parse_utc(old["expiresAt"]) <= (now or dt.datetime.now(dt.timezone.utc)):
                raise ValidationError("referenced ciphertext has expired")
            entry.update({
                "sourceSha256": old["sourceSha256"],
                "cacheFile": None,
                "ciphertextKey": old["ciphertextKey"],
                "ciphertextChecksumKey": old["ciphertextChecksumKey"],
                "proof": "reused-prior-byte-sha256",
                "reuse": {
                    "ciphertextSha256": old["ciphertextSha256"],
                    "ciphertextSize": old["ciphertextSize"],
                    "expiresAt": old["expiresAt"],
                },
            })
        else:
            cache_name = identity + ".source"
            cache_path = cache_dir / cache_name
            result = resume_or_download_source(source, entry, cache_path, budget)
            expected_mime = (entry.get("contentType") or "").split(";", 1)[0].strip().lower()
            received_mime = (result.get("contentType") or "").split(";", 1)[0].strip().lower()
            if expected_mime and expected_mime != received_mime and (plan["version"] == 2 or received_mime):
                cache_path.unlink(missing_ok=True)
                raise SourceDriftError("source MIME differs from inventory")
            entry.update({
                "sourceSha256": result["sha256"],
                "cacheFile": cache_name,
                "ciphertextKey": f"{prefix}objects/{identity[:2]}/{identity}.age",
                "ciphertextChecksumKey": f"{prefix}objects/{identity[:2]}/{identity}.age.sha256",
                "proof": "downloaded-byte-sha256",
                "reuse": None,
            })
        for ref in entry.get("dbReferences", []):
            if ref.get("relation") == "media_assets" and (ref.get("expectedSha256") != entry["sourceSha256"] or ref.get("expectedSize") != entry["size"]):
                if entry.get("cacheFile"):
                    (cache_dir / entry["cacheFile"]).unlink(missing_ok=True)
                raise SourceDriftError("managed original differs from registry byte identity")
        prepared_objects.append(entry)
        if diagnostics:
            diagnostics.write()
    if inventory_digest(scan_source(source, diagnostics, "source_revalidation")) != plan["inventoryDigest"]:
        raise SourceDriftError("source inventory changed during prepare")
    prepared["objects"] = prepared_objects
    prepared["preparedAt"] = utc_now()
    prepared["manifestCreatedAt"] = prepared["preparedAt"]
    downloaded = [entry for entry in prepared_objects if entry["proof"] == "downloaded-byte-sha256"]
    logical_source_bytes = sum(entry["size"] for entry in downloaded)
    prepared["summary"] = dict(
        plan["summary"],
        downloadedObjects=len(downloaded), downloadedBytes=logical_source_bytes,
        logicalSourceObjects=len(downloaded), logicalSourceBytes=logical_source_bytes,
        reusedObjects=len(prepared_objects) - len(downloaded),
        remoteSourceAttempts=budget.source_attempts,
        remoteCompletedDownloads=budget.source_completed_downloads,
        sourceRetryCount=budget.source_retries,
        cumulativeNetworkBytes=budget.source_bytes,
        samePlanCachedObjects=budget.cached_source_objects,
        samePlanCachedBytes=budget.cached_source_bytes,
    )
    prepared["planDigest"] = plan_digest(prepared)
    validate_plan(prepared, require_prepared=True)
    return prepared, budget


class AgeEncryptor:
    def __init__(self, recipient: Optional[str] = None, executable: str = "age"):
        if recipient is not None and not recipient.startswith("age1"):
            raise ValidationError("invalid age recipient")
        self.recipient = recipient
        self.executable = executable

    def encrypt(self, source: pathlib.Path, destination: pathlib.Path) -> None:
        if self.recipient is None:
            raise ValidationError("age recipient is required for encryption")
        destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        fd = os.open(str(destination), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "wb") as output:
            result = subprocess.run([self.executable, "--recipient", self.recipient, str(source)], stdout=output, stderr=subprocess.PIPE, check=False)
        if result.returncode:
            destination.unlink(missing_ok=True)
            raise BackupError("age encryption failed")

    def decrypt(self, source: pathlib.Path, identity: pathlib.Path, destination: pathlib.Path) -> None:
        if stat.S_IMODE(identity.stat().st_mode) != 0o600:
            raise ValidationError("age identity must be mode 0600")
        destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        fd = os.open(str(destination), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "wb") as output:
            result = subprocess.run([self.executable, "--decrypt", "--identity", str(identity), str(source)], stdout=output, stderr=subprocess.PIPE, check=False)
        if result.returncode:
            destination.unlink(missing_ok=True)
            raise BackupError("age decryption failed")


class R2Store:
    def __init__(self, client: Any, bucket: str):
        if bucket != PRIVATE_R2_BUCKET:
            raise ValidationError("unexpected R2 bucket")
        self.client = client
        self.bucket = bucket
        self.last_precondition_evidence = None

    def _head(self, key, operation, stage=None):
        try:
            result = self.client.head_object(Bucket=self.bucket, Key=key)
            if not isinstance(result, Mapping) or not isinstance(result.get("Metadata", {}), Mapping):
                raise DestinationError("destination_provider_validation_failed", operation, stage=stage)
            return result
        except DestinationError:
            raise
        except Exception as error:
            raise destination_error(error, operation, stage) from None

    @staticmethod
    def _existing_identity(head, metadata, size, proof, strict, operation=None):
        existing = {str(k).lower(): str(v) for k, v in (head.get("Metadata") or {}).items()}
        existing_sha, existing_size = existing.get("sha256", ""), head.get("ContentLength")
        valid = (len(existing_sha) == 64 and all(c in "0123456789abcdef" for c in existing_sha)
                 and type(existing_size) is int and existing_size >= 0
                 and all(existing.get(name) == metadata[name] for name in {"schema", "kind", *proof}))
        # Preserve approved-plaintext resume semantics for nondeterministic age
        # ciphertext on 412. An ambiguous current PUT requires byte-exact identity.
        if strict or not proof:
            valid = valid and existing_size == size and existing_sha == metadata["sha256"]
        if not valid:
            raise DestinationConflictError("destination_identity_mismatch", operation or ("head_after_ambiguous_put" if strict else "head_after_precondition"))
        return existing_sha, existing_size

    def put_create_only(
        self, key: str, path: pathlib.Path, sha256: str, budget: TransferBudget,
        kind: str, proof: Optional[Mapping[str, str]] = None,
    ) -> Tuple[str, str, int]:
        self.last_precondition_evidence = None
        if not key.startswith(R2_PREFIX):
            raise ValidationError("R2 key outside approved namespace")
        try:
            actual_sha, size = sha256_file(path)
        except OSError as error:
            raise DestinationError("destination_local_io_failed", "destination_local_read", error) from None
        if actual_sha != sha256:
            raise DestinationChecksumError("destination_checksum_mismatch", "destination_local_read")
        metadata = {"sha256": sha256, "kind": kind, "schema": "storage-backup-v1"}
        for proof_key, proof_value in (proof or {}).items():
            if proof_key not in {"plan-digest", "source-identity", "source-sha256", "cipher-sha256"}:
                raise ValidationError("unsupported R2 proof metadata")
            if not isinstance(proof_value, str) or not proof_value:
                raise ValidationError("invalid R2 proof metadata")
            metadata[proof_key] = proof_value
        for attempt in range(MAX_DESTINATION_RETRIES + 1):
            # Reopen only an unchanged local payload for the conditional retry.
            if attempt:
                try:
                    retry_sha, retry_size = sha256_file(path)
                except OSError as error:
                    raise DestinationError("destination_local_io_failed", "destination_local_read", error) from None
                if (retry_sha, retry_size) != (sha256, size):
                    raise DestinationChecksumError("destination_checksum_mismatch", "destination_local_read")
            try:
                body = path.open("rb")
            except OSError as error:
                raise DestinationError("destination_local_io_failed", "destination_local_read", error) from None
            with body:
                budget.begin_r2(size)
                if attempt:
                    budget.r2_retries += 1
                try:
                    self.client.put_object(Bucket=self.bucket, Key=key, Body=body, IfNoneMatch="*",
                                           ContentType="application/octet-stream", Metadata=metadata)
                except Exception as error:
                    failure = destination_error(error, "put_create_only", conditional_create=True)
                else:
                    budget.created_r2(size)
                    return "created", sha256, size
            if failure.code == "destination_precondition_failed":
                self.last_precondition_evidence = dict(failure.evidence)
                try:
                    head = self._head(key, "head_after_precondition")
                except DestinationError as error:
                    if error.code == "destination_not_found":
                        error.code = "destination_head_not_found_after_precondition"
                        error.args = (error.code,)
                    raise error from None
                existing_sha, existing_size = self._existing_identity(head, metadata, size, proof or {}, strict=False)
                return "concurrent-exact-skip", existing_sha, existing_size
            if failure.code == "destination_conditional_conflict":
                self.last_precondition_evidence = dict(failure.evidence)
                try:
                    head = self._head(key, "head_after_conditional_conflict")
                except DestinationError as error:
                    if error.code != "destination_not_found":
                        # Preserve the existing guarded-HEAD policy: provider,
                        # auth and transport failures fail; no blind PUT retry.
                        raise error from None
                else:
                    existing_sha, existing_size = self._existing_identity(
                        head, metadata, size, proof or {}, strict=True,
                        operation="head_after_conditional_conflict")
                    return "concurrent-exact-skip", existing_sha, existing_size
                if attempt == MAX_DESTINATION_RETRIES:
                    raise failure from None
                time.sleep(1)
                continue
            if not failure.evidence["retryable"]:
                raise failure from None
            # Reconcile even HTTP transient errors before retrying. Never overwrite
            # a possibly committed PUT or accept another object's identity.
            try:
                head = self._head(key, "head_after_ambiguous_put")
            except DestinationError as error:
                if error.code != "destination_not_found":
                    raise error from None
            else:
                self._existing_identity(head, metadata, size, proof or {}, strict=True)
                budget.created_r2(size)
                return "committed-exact-success", sha256, size
            if attempt == MAX_DESTINATION_RETRIES:
                raise failure from None
            time.sleep(1)
        raise AssertionError("unreachable destination retry state")

    def head(self, key: str) -> Mapping[str, Any]:
        return self._head(key, "destination_head")

    def download(self, key: str, destination: pathlib.Path) -> None:
        destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        response = None
        try:
            fd = os.open(str(destination), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "wb") as output:
                response = self.client.get_object(Bucket=self.bucket, Key=key)
                size = 0
                while True:
                    with payload_read_deadline(60):
                        chunk = response["Body"].read(CHUNK_SIZE)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > MAX_R2_BYTES:
                        raise BudgetError("restore object ceiling exceeded")
                    output.write(chunk)
        except Exception:
            destination.unlink(missing_ok=True)
            raise BackupError("backup download failed") from None
        finally:
            if response is not None:
                response["Body"].close()

    def verify_bytes(self, key: str, expected_sha: str, expected_size: int) -> int:
        """A destination HEAD/eTag is never accepted as byte verification."""
        try:
            response = self.client.get_object(Bucket=self.bucket, Key=key)
            digest, size = hashlib.sha256(), 0
            try:
                for chunk in iter(lambda: response["Body"].read(CHUNK_SIZE), b""):
                    size += len(chunk)
                    if size > expected_size:
                        raise DestinationChecksumError("destination_checksum_mismatch", "verify_bytes", stage="destination_byte_verify")
                    digest.update(chunk)
            finally:
                response["Body"].close()
            if size != expected_size or digest.hexdigest() != expected_sha:
                raise DestinationChecksumError("destination_checksum_mismatch", "verify_bytes", stage="destination_byte_verify")
            return size
        except BackupError:
            raise
        except Exception as error:
            raise destination_error(error, "verify_bytes", "destination_byte_verify") from None


def ensure_cache_file(cache_dir: pathlib.Path, entry: Mapping[str, Any]) -> pathlib.Path:
    candidate = (cache_dir / entry["cacheFile"]).resolve()
    root = cache_dir.resolve()
    if root not in candidate.parents or candidate.is_symlink() or not candidate.is_file():
        raise ValidationError("unsafe or missing cache file")
    digest, size = sha256_file(candidate)
    if digest != entry["sourceSha256"] or size != entry["size"]:
        raise ValidationError("cached source does not match approved plan")
    return candidate


def verify_reused(store: R2Store, entry: Mapping[str, Any]) -> None:
    reuse = entry["reuse"]
    for key, expected_kind in ((entry["ciphertextKey"], "source-ciphertext"), (entry["ciphertextChecksumKey"], "source-checksum")):
        head = store.head(key)
        metadata = {str(k).lower(): str(v) for k, v in (head.get("Metadata") or {}).items()}
        expected_sha = reuse["ciphertextSha256"] if expected_kind == "source-ciphertext" else sha256_bytes((reuse["ciphertextSha256"] + "\n").encode())
        expected_size = reuse["ciphertextSize"] if expected_kind == "source-ciphertext" else 65
        if head.get("ContentLength") != expected_size or metadata.get("sha256") != expected_sha or metadata.get("kind") != expected_kind:
            raise ConflictError("reused ciphertext reference is unavailable or inconsistent")


def apply_plan(
    plan: Mapping[str, Any],
    confirm_digest: str,
    source: Any,
    store: R2Store,
    encryptor: Any,
    cache_dir: pathlib.Path,
    work_dir: pathlib.Path,
    now: Optional[dt.datetime] = None,
    diagnostics: Optional[BackupDiagnostics] = None,
) -> Tuple[Dict[str, Any], TransferBudget]:
    validate_plan(plan, confirm_digest=confirm_digest, require_prepared=True)
    apply_time = now or dt.datetime.now(dt.timezone.utc)
    if parse_utc(plan["expiresAt"]) <= apply_time:
        raise ValidationError("prepared plan retention has expired")
    current = scan_source(source, diagnostics, "preapply_inventory")
    if inventory_digest(current) != plan["inventoryDigest"]:
        raise SourceDriftError("source inventory changed before apply")
    # Finish every local and structural validation before the first remote write.
    local_files: Dict[str, pathlib.Path] = {}
    for entry in plan["objects"]:
        if entry.get("reuse"):
            if parse_utc(entry["reuse"]["expiresAt"]) <= apply_time:
                raise ValidationError("reused ciphertext retention has expired")
        else:
            local_files[entry["identity"]] = ensure_cache_file(cache_dir, entry)

    work_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(work_dir, 0o700)
    budget = diagnostics.destination_budget if diagnostics else TransferBudget()
    results: List[Dict[str, Any]] = []
    for entry in plan["objects"]:
        if entry.get("reuse"):
            verify_reused(store, entry)
            if plan["version"] == 2:
                store.verify_bytes(entry["ciphertextKey"], entry["reuse"]["ciphertextSha256"], entry["reuse"]["ciphertextSize"])
                checksum_sha = sha256_bytes((entry["reuse"]["ciphertextSha256"] + "\n").encode("ascii"))
                store.verify_bytes(entry["ciphertextChecksumKey"], checksum_sha, 65)
            results.append(dict(entry, ciphertextSha256=entry["reuse"]["ciphertextSha256"], ciphertextSize=entry["reuse"]["ciphertextSize"], expiresAt=entry["reuse"]["expiresAt"]))
            continue
        ciphertext = work_dir / (entry["identity"] + ".age")
        checksum = work_dir / (entry["identity"] + ".age.sha256")
        ciphertext.unlink(missing_ok=True)
        if diagnostics:
            diagnostics.at("encryption", entry.get("provider", "supabase"), "encrypt", entry)
        encryptor.encrypt(local_files[entry["identity"]], ciphertext)
        cipher_sha, _ = sha256_file(ciphertext)
        checksum.write_text(cipher_sha + "\n", encoding="ascii")
        os.chmod(checksum, 0o600)
        source_proof = {"plan-digest": plan["planDigest"], "source-identity": entry["identity"], "source-sha256": entry["sourceSha256"]}
        if diagnostics:
            diagnostics.at("destination_create", "r2", "put_create_only", entry)
        _, stored_cipher_sha, stored_cipher_size = store.put_create_only(
            entry["ciphertextKey"], ciphertext, cipher_sha, budget, "source-ciphertext", source_proof
        )
        if stored_cipher_sha != cipher_sha:
            checksum.write_text(stored_cipher_sha + "\n", encoding="ascii")
            os.chmod(checksum, 0o600)
        checksum_sha, _ = sha256_file(checksum)
        checksum_proof = dict(source_proof, **{"cipher-sha256": stored_cipher_sha})
        if diagnostics:
            diagnostics.at("destination_create", "r2", "put_create_only", entry)
        store.put_create_only(
            entry["ciphertextChecksumKey"], checksum, checksum_sha, budget, "source-checksum", checksum_proof
        )
        results.append(dict(entry, ciphertextSha256=stored_cipher_sha, ciphertextSize=stored_cipher_size, expiresAt=plan["expiresAt"]))
        if plan["version"] == 2:
            if diagnostics:
                diagnostics.at("destination_byte_verify", "r2", "verify_bytes", entry)
            store.verify_bytes(entry["ciphertextKey"], stored_cipher_sha, stored_cipher_size)
            store.verify_bytes(entry["ciphertextChecksumKey"], checksum_sha, 65)

    end_inventory = scan_source(source, diagnostics, "final_inventory")
    if inventory_digest(end_inventory) != plan["inventoryDigest"]:
        raise SourceDriftError("source inventory changed during apply")
    recoverable_until = min(parse_utc(item["expiresAt"]) for item in results).isoformat().replace("+00:00", "Z") if results else plan["expiresAt"]
    manifest: Dict[str, Any] = {
        "schema": MULTI_MANIFEST_SCHEMA if plan["version"] == 2 else MANIFEST_SCHEMA,
        "version": plan["version"],
        "status": "complete",
        "projectRef": plan["projectRef"],
        "destinationBucket": plan["destinationBucket"],
        "snapshotId": plan["snapshotId"],
        "planDigest": plan["planDigest"],
        "capturedAt": plan["capturedAt"],
        "completedAt": plan["manifestCreatedAt"],
        "expiresAt": plan["expiresAt"],
        "recoverableUntil": recoverable_until,
        "databaseBackup": plan["databaseBackup"],
        "atomicWithDatabase": False,
        "inventoryDigestStart": plan["inventoryDigest"],
        "inventoryDigestEnd": inventory_digest(end_inventory),
        "captureBoundary": {
            "storageStartedAt": plan["capturedAt"],
            "storageCompletedAt": plan["manifestCreatedAt"],
            "databaseBackupTime": plan["databaseBackup"]["capturedAt"],
            "atomic": False,
            "deltaWindowSeconds": (parse_utc(plan["manifestCreatedAt"]) - parse_utc(plan["databaseBackup"]["capturedAt"])).total_seconds(),
        },
        "summary": {"objectCount": len(results), "sourceBytes": sum(item["size"] for item in results)},
        "objects": results,
    }
    if plan["version"] == 2:
        manifest["approvedPlan"] = dict(plan)
    manifest_plain = work_dir / "storage-manifest.json"
    safe_write_json(manifest_plain, manifest)
    manifest_age = work_dir / "storage-manifest.json.age"
    manifest_age.unlink(missing_ok=True)
    if diagnostics:
        diagnostics.at("manifest_publish", "r2", "encrypt_manifest")
    encryptor.encrypt(manifest_plain, manifest_age)
    manifest_sha, _ = sha256_file(manifest_age)
    manifest_checksum = work_dir / "storage-manifest.json.age.sha256"
    manifest_checksum.write_text(manifest_sha + "\n", encoding="ascii")
    os.chmod(manifest_checksum, 0o600)
    manifest_key = plan["destinationPrefix"] + "storage-manifest.json.age"
    manifest_checksum_key = manifest_key + ".sha256"
    manifest_proof = {"plan-digest": plan["planDigest"]}
    if diagnostics:
        diagnostics.at("manifest_publish", "r2", "publish_manifest")
    _, stored_manifest_sha, stored_manifest_size = store.put_create_only(
        manifest_key, manifest_age, manifest_sha, budget, "snapshot-manifest", manifest_proof
    )
    if stored_manifest_sha != manifest_sha:
        manifest_checksum.write_text(stored_manifest_sha + "\n", encoding="ascii")
        os.chmod(manifest_checksum, 0o600)
    checksum_sha, _ = sha256_file(manifest_checksum)
    if diagnostics:
        diagnostics.at("manifest_publish", "r2", "publish_manifest")
    store.put_create_only(
        manifest_checksum_key, manifest_checksum, checksum_sha, budget, "snapshot-manifest-checksum",
        {"plan-digest": plan["planDigest"], "cipher-sha256": stored_manifest_sha},
    )
    if plan["version"] == 2:
        if diagnostics:
            diagnostics.at("manifest_publish", "r2", "verify_manifest")
        store.verify_bytes(manifest_key, stored_manifest_sha, stored_manifest_size)
        store.verify_bytes(manifest_checksum_key, checksum_sha, 65)
    providers = {}
    for entry in results:
        aggregate = providers.setdefault(entry.get("provider", "supabase"), {"objects": 0, "sourceBytes": 0})
        aggregate["objects"] += 1
        aggregate["sourceBytes"] += entry["size"]
    public_summary = {
        "schema": plan["schema"],
        "status": "complete",
        "snapshotId": plan["snapshotId"],
        "planDigest": plan["planDigest"],
        "manifestKey": manifest_key,
        "manifestChecksumKey": manifest_checksum_key,
        "manifestCiphertextSha256": stored_manifest_sha,
        "manifestCiphertextSize": stored_manifest_size,
        "recoverableUntil": recoverable_until,
        "objectCount": len(results),
        "newSourceObjects": sum(not bool(item.get("reuse")) for item in results),
        "reusedSourceObjects": sum(bool(item.get("reuse")) for item in results),
        "encryptedObjectBytes": sum(item["ciphertextSize"] for item in results),
        "sourceBytes": sum(item["size"] for item in results),
        "budget": budget.as_dict(),
        "providers": providers,
        "destinationByteVerification": "PASS" if plan["version"] == 2 else "restore-rehearsal-required",
        "databaseBackup": plan["databaseBackup"],
        "captureBoundary": manifest["captureBoundary"],
    }
    return public_summary, budget


def restore_snapshot(store: R2Store, manifest_key: str, manifest_checksum_key: str, identity: pathlib.Path, destination: pathlib.Path, encryptor: AgeEncryptor,
                     provider: Optional[str] = None, bucket_filter: Optional[str] = None,
                     object_identity: Optional[str] = None, manifest_only: bool = False) -> Dict[str, Any]:
    if not manifest_key.startswith(R2_PREFIX) or manifest_checksum_key != manifest_key + ".sha256":
        raise ValidationError("invalid manifest key")
    if destination.exists():
        raise ValidationError("restore destination must not exist")
    destination.mkdir(parents=True, mode=0o700)
    temp = pathlib.Path(tempfile.mkdtemp(prefix="locally-storage-restore."))
    os.chmod(temp, 0o700)
    restored = 0
    restored_bytes = 0
    try:
        manifest_age = temp / "manifest.age"
        checksum = temp / "manifest.age.sha256"
        store.download(manifest_key, manifest_age)
        store.download(manifest_checksum_key, checksum)
        expected = checksum.read_text(encoding="ascii").strip()
        actual, _ = sha256_file(manifest_age)
        if expected != actual:
            raise ValidationError("manifest ciphertext checksum mismatch")
        manifest_plain = temp / "manifest.json"
        encryptor.decrypt(manifest_age, identity, manifest_plain)
        manifest = read_private_json(manifest_plain)
        if manifest.get("schema") not in {MANIFEST_SCHEMA, MULTI_MANIFEST_SCHEMA} or manifest.get("status") != "complete":
            raise ValidationError("invalid snapshot manifest")
        parse_utc(manifest.get("recoverableUntil"))
        all_objects = manifest.get("objects")
        if not isinstance(all_objects, list) or manifest.get("summary") != {"objectCount": len(all_objects), "sourceBytes": sum(item.get("size", 0) for item in all_objects)}:
            raise ValidationError("manifest summary mismatch")
        identities = set()
        for entry in all_objects:
            validate_object_entry(entry, prepared=True)
            if entry["identity"] in identities:
                raise ValidationError("duplicate manifest identity")
            identities.add(entry["identity"])
        if manifest["schema"] == MULTI_MANIFEST_SCHEMA:
            approved = manifest.get("approvedPlan")
            if not isinstance(approved, dict):
                raise ValidationError("manifest missing approved identity contract")
            validate_plan(approved, confirm_digest=manifest.get("planDigest"), require_prepared=True)
            approved_by_id = {entry["identity"]: entry for entry in approved["objects"]}
            if len(manifest.get("objects", [])) != len(approved_by_id):
                raise ValidationError("manifest key set mismatch")
            for entry in manifest["objects"]:
                expected_entry = approved_by_id.get(entry.get("identity"))
                if expected_entry is None or metadata_fingerprint(entry) != metadata_fingerprint(expected_entry) or entry.get("sourceSha256") != expected_entry["sourceSha256"]:
                    raise ValidationError("manifest source identity or metadata differs")
        selected = [entry for entry in manifest.get("objects", [])
                    if (provider is None or entry.get("provider", "supabase") == provider)
                    and (bucket_filter is None or entry["bucket"] == bucket_filter)
                    and (object_identity is None or entry["identity"] == object_identity)]
        if (provider or bucket_filter or object_identity) and not selected:
            raise ValidationError("restore selector matched no object")
        seen_paths = set()
        for entry in selected:
            validate_object_entry(entry, prepared=True)
            bucket = entry["bucket"]
            key = entry["key"]
            relative = pathlib.PurePosixPath(bucket) / pathlib.PurePosixPath(key)
            if manifest["schema"] == MULTI_MANIFEST_SCHEMA:
                relative = pathlib.PurePosixPath(entry["provider"]) / relative
            if relative.is_absolute() or ".." in relative.parts or str(relative) in seen_paths:
                raise ValidationError("unsafe or duplicate restore path")
            seen_paths.add(str(relative))
            if manifest_only:
                continue
            cipher = temp / (entry["identity"] + ".age")
            cipher_checksum = temp / (entry["identity"] + ".age.sha256")
            store.download(entry["ciphertextKey"], cipher)
            store.download(entry["ciphertextChecksumKey"], cipher_checksum)
            expected_cipher = cipher_checksum.read_text(encoding="ascii").strip()
            actual_cipher, actual_cipher_size = sha256_file(cipher)
            if expected_cipher != actual_cipher or actual_cipher != entry["ciphertextSha256"] or actual_cipher_size != entry["ciphertextSize"]:
                raise ValidationError("source ciphertext checksum mismatch")
            output = destination / pathlib.Path(*relative.parts)
            resolved = output.resolve()
            if destination.resolve() not in resolved.parents:
                raise ValidationError("restore path escapes destination")
            encryptor.decrypt(cipher, identity, output)
            digest, size = sha256_file(output)
            if digest != entry["sourceSha256"] or size != entry["size"]:
                raise ValidationError("restored source byte mismatch")
            restored += 1
            restored_bytes += size
        if not manifest_only and (restored != len(selected) or restored_bytes != sum(entry["size"] for entry in selected)):
            raise ValidationError("restored key set summary mismatch")
        safe_write_json(destination / ".locally-storage-restore-metadata.json", {
            "snapshotId": manifest["snapshotId"],
            "objectCount": restored,
            "sourceBytes": restored_bytes,
            "verifiedAt": utc_now(),
            "contentInspectionPerformed": False,
        })
        safe_write_json(destination / ".locally-storage-manifest.json", manifest)
        return {"status": "manifest-validated" if manifest_only else "complete", "objectCount": restored, "sourceBytes": restored_bytes,
                "snapshotId": manifest["snapshotId"], "selectedObjects": len(selected), "missing": 0, "shaMismatch": 0,
                "metadataMappingVerified": True, "databaseBackup": manifest["databaseBackup"]}
    except BaseException:
        shutil.rmtree(destination, ignore_errors=True)
        raise
    finally:
        shutil.rmtree(temp, ignore_errors=True)


def boto3_store() -> R2Store:
    try:
        import boto3
        from botocore.config import Config
    except ImportError as exc:
        raise BackupError("boto3 is required for R2 operations") from exc
    required = ("R2_ENDPOINT", "R2_BUCKET", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY")
    missing = [name for name in required if not os.environ.get(name)]
    if missing:
        raise BackupError("missing private R2 credentials")
    client = boto3.client(
        "s3", endpoint_url=os.environ["R2_ENDPOINT"], aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"], region_name="auto",
        config=Config(signature_version="s3v4", connect_timeout=10, read_timeout=60, retries={"total_max_attempts": 1, "mode": "standard"}),
    )
    return R2Store(client, os.environ["R2_BUCKET"])


def source_from_env(args: argparse.Namespace):
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    diagnostics = getattr(args, "diagnostics", None)
    source = SupabaseStorageSource(args.project_url, key, timeout=args.timeout, diagnostics=diagnostics)
    if not args.multi_source:
        return source
    access, secret = os.environ.get("R2_SOURCE_ACCESS_KEY_ID"), os.environ.get("R2_SOURCE_SECRET_ACCESS_KEY")
    if not access or not secret or access == os.environ.get("AWS_ACCESS_KEY_ID"):
        raise BackupError("missing separate read-only R2 source credential")
    import boto3
    from botocore.config import Config
    client = boto3.client("s3", endpoint_url=os.environ.get("R2_ENDPOINT"), aws_access_key_id=access,
                          aws_secret_access_key=secret, region_name="auto",
                          config=Config(signature_version="s3v4", connect_timeout=10, read_timeout=args.timeout,
                                        retries={"total_max_attempts": 1, "mode": "standard"}))
    include_managed = os.environ.get("STORAGE_BACKUP_INCLUDE_MANAGED_ASSETS") == "true"
    return MultiStorageSource(source, R2StorageSource(client, timeout=args.timeout, diagnostics=diagnostics),
                              reference_reader=lambda reader: database_references(reader, include_managed), diagnostics=diagnostics)


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Encrypted Supabase Storage byte backup")
    sub = parser.add_subparsers(dest="command", required=True)
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--project-url", default="https://uhinvcydgzqlpnvieyal.supabase.co")
    common.add_argument("--timeout", type=float, default=30.0)
    common.add_argument("--multi-source", action="store_true", help="Supabase recoverable objects plus DB-referenced R2 originals")
    plan_parser = sub.add_parser("plan", parents=[common])
    plan_parser.add_argument("--output", required=True, type=pathlib.Path)
    plan_parser.add_argument("--snapshot-id", required=True)
    plan_parser.add_argument("--db-backup-id", required=True)
    plan_parser.add_argument("--db-backup-time", required=True)
    prepare_parser = sub.add_parser("prepare", parents=[common])
    prepare_parser.add_argument("--plan", required=True, type=pathlib.Path)
    prepare_parser.add_argument("--output", required=True, type=pathlib.Path)
    prepare_parser.add_argument("--cache-dir", required=True, type=pathlib.Path)
    prepare_parser.add_argument("--previous-manifest", type=pathlib.Path)
    apply_parser = sub.add_parser("apply", parents=[common])
    apply_parser.add_argument("--plan", required=True, type=pathlib.Path)
    apply_parser.add_argument("--confirm-digest", required=True)
    apply_parser.add_argument("--cache-dir", required=True, type=pathlib.Path)
    apply_parser.add_argument("--work-dir", required=True, type=pathlib.Path)
    apply_parser.add_argument("--age-recipient", required=True)
    apply_parser.add_argument("--summary", required=True, type=pathlib.Path)
    restore_parser = sub.add_parser("restore")
    restore_parser.add_argument("--manifest-key", required=True)
    restore_parser.add_argument("--manifest-checksum-key", required=True)
    restore_parser.add_argument("--identity", required=True, type=pathlib.Path)
    restore_parser.add_argument("--destination", required=True, type=pathlib.Path)
    restore_parser.add_argument("--provider", choices=("supabase", "r2"))
    restore_parser.add_argument("--bucket")
    restore_parser.add_argument("--object-identity")
    restore_parser.add_argument("--manifest-only", action="store_true")
    args = parser.parse_args(argv)

    if args.command == "plan":
        source = source_from_env(args)
        entries = source.inventory()
        plan = make_plan(entries, args.snapshot_id, args.db_backup_id, args.db_backup_time)
        safe_write_json(args.output, plan)
        print(json.dumps({"status": "planned", "objectCount": len(entries), "sourceBytes": sum(item["size"] for item in entries), "planDigest": plan["planDigest"]}, sort_keys=True))
    elif args.command == "prepare":
        plan = read_private_json(args.plan)
        previous = read_private_json(args.previous_manifest) if args.previous_manifest else None
        prepared, budget = prepare_plan(plan, source_from_env(args), args.cache_dir, previous)
        safe_write_json(args.output, prepared)
        print(json.dumps({
            "status": "prepared", "objectCount": len(prepared["objects"]), "planDigest": prepared["planDigest"],
            "sourceAttempts": budget.source_attempts, "sourceBytes": budget.source_bytes,
            "remoteSourceAttempts": budget.source_attempts, "remoteCompletedDownloads": budget.source_completed_downloads,
            "sourceRetryCount": budget.source_retries, "cumulativeNetworkBytes": budget.source_bytes,
            "samePlanCachedObjects": budget.cached_source_objects,
        }, sort_keys=True))
    elif args.command == "apply":
        plan = read_private_json(args.plan)
        summary, _ = apply_plan(plan, args.confirm_digest, source_from_env(args), boto3_store(), AgeEncryptor(args.age_recipient), args.cache_dir, args.work_dir)
        safe_write_json(args.summary, summary)
        print(json.dumps(summary, sort_keys=True))
    else:
        result = restore_snapshot(boto3_store(), args.manifest_key, args.manifest_checksum_key, args.identity, args.destination, AgeEncryptor(),
                                  args.provider, args.bucket, args.object_identity, args.manifest_only)
        print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except BackupError as exc:
        print(json.dumps({"status": "failed", "diagnosticCode": exc.code}), file=os.sys.stderr)
        raise SystemExit(1)
    except Exception:
        print(json.dumps({"status": "failed", "diagnosticCode": "backup_unexpected_failure"}), file=os.sys.stderr)
        raise SystemExit(1)
