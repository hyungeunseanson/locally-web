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
import stat
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple


SCHEMA = "locally.supabase-storage-backup.v1"
MANIFEST_SCHEMA = "locally.supabase-storage-snapshot.v1"
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
MAX_OBJECTS = 1200
MAX_SOURCE_BYTES = 512 * 1024 * 1024
MAX_R2_OBJECTS = 2500
MAX_R2_BYTES = 640 * 1024 * 1024
LOCK_DAYS = 30
EXPIRY_DAYS = 35
CHUNK_SIZE = 1024 * 1024


class BackupError(RuntimeError):
    code = "backup_error"


class ValidationError(BackupError):
    code = "validation_failed"


class BudgetError(BackupError):
    code = "budget_exceeded"


class SourceDriftError(BackupError):
    code = "source_drift"


class SourceTimeoutError(BackupError):
    code = "source_timeout"


class ConflictError(BackupError):
    code = "conditional_conflict"


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


def source_identity(bucket: str, key: str) -> str:
    return sha256_bytes((bucket + "\0" + key).encode("utf-8"))


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
    }
    if set(entry) - allowed:
        raise ValidationError("unsupported object field")
    bucket = entry.get("bucket")
    key = entry.get("key")
    if bucket not in BUCKETS or not isinstance(key, str) or not key or "\x00" in key:
        raise ValidationError("invalid source object identity")
    key_path = pathlib.PurePosixPath(key)
    if key_path.is_absolute() or ".." in key_path.parts or "." in key_path.parts:
        raise ValidationError("unsafe source object key")
    if entry.get("identity") != source_identity(bucket, key):
        raise ValidationError("source identity mismatch")
    require_bounded_int(entry.get("size"), "source size", MAX_SOURCE_BYTES)
    for name in ("contentType", "sourceVersion", "sourceEtag", "sourceUpdatedAt"):
        if entry.get(name) is not None and not isinstance(entry.get(name), str):
            raise ValidationError(f"invalid {name}")
    if not isinstance(entry.get("metadata"), dict):
        raise ValidationError("invalid source metadata")
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
    if plan.get("schema") != SCHEMA or plan.get("version") != 1:
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
    return {
        "bucket": entry["bucket"],
        "key": entry["key"],
        "identity": entry["identity"],
        "size": entry["size"],
        "contentType": entry.get("contentType"),
        "sourceVersion": entry.get("sourceVersion"),
        "sourceEtag": entry.get("sourceEtag"),
        "sourceUpdatedAt": entry.get("sourceUpdatedAt"),
    }


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
        if marker.is_symlink() or not marker.is_file() or marker.read_text(encoding="ascii").strip() != plan["planDigest"]:
            raise ValidationError("resume cache is not bound to this plan")
        return
    if any(cache_dir.iterdir()):
        raise ValidationError("non-empty resume cache is missing its plan binding")
    marker.write_text(plan["planDigest"] + "\n", encoding="ascii")
    os.chmod(marker, 0o600)


def resume_or_download_source(
    source: Any, entry: Mapping[str, Any], cache_path: pathlib.Path, budget: "TransferBudget",
) -> Mapping[str, Optional[str]]:
    if cache_path.exists():
        if cache_path.is_symlink() or not cache_path.is_file():
            raise ValidationError("unsafe resume cache file")
        digest, size = sha256_file(cache_path)
        if size != entry["size"]:
            raise ValidationError("resume cache file size differs from plan")
        budget.begin_source()
        budget.receive_source(size)
        return {"sha256": digest, "etag": entry.get("sourceEtag"), "contentType": entry.get("contentType")}
    return source.download(entry, cache_path, budget)


@dataclasses.dataclass
class TransferBudget:
    max_source_objects: int = MAX_OBJECTS
    max_source_bytes: int = MAX_SOURCE_BYTES
    max_new_r2_objects: int = MAX_R2_OBJECTS
    max_new_r2_bytes: int = MAX_R2_BYTES
    source_attempts: int = 0
    source_bytes: int = 0
    r2_attempts: int = 0
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


class SupabaseStorageSource:
    def __init__(self, project_url: str, service_role_key: str, timeout: float = 30.0):
        parsed = urllib.parse.urlparse(project_url)
        if parsed.scheme != "https" or parsed.hostname != "uhinvcydgzqlpnvieyal.supabase.co" or parsed.path not in {"", "/"}:
            raise ValidationError("unexpected Supabase origin")
        if not service_role_key:
            raise ValidationError("missing Supabase service credential")
        self.base = project_url.rstrip("/")
        self.key = service_role_key
        self.timeout = timeout

    def _request(self, method: str, path: str, body: Optional[bytes] = None) -> urllib.response.addinfourl:
        request = urllib.request.Request(
            self.base + path,
            data=body,
            method=method,
            headers={
                "apikey": self.key,
                "authorization": "Bearer " + self.key,
                "content-type": "application/json",
            },
        )
        try:
            return urllib.request.urlopen(request, timeout=self.timeout)
        except urllib.error.HTTPError as exc:
            raise BackupError(f"Supabase Storage request failed with HTTP {exc.code}") from None
        except (urllib.error.URLError, TimeoutError) as exc:
            raise BackupError("Supabase Storage request transport failure") from exc

    def _list_directory(self, bucket: str, prefix: str) -> Iterable[Dict[str, Any]]:
        offset = 0
        limit = 100
        while True:
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

    def download(self, entry: Mapping[str, Any], destination: pathlib.Path, budget: TransferBudget) -> Mapping[str, Optional[str]]:
        budget.begin_source()
        encoded_bucket = urllib.parse.quote(entry["bucket"], safe="")
        encoded_key = urllib.parse.quote(entry["key"], safe="/")
        response = self._request("GET", f"/storage/v1/object/authenticated/{encoded_bucket}/{encoded_key}")
        destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
        fd = os.open(str(destination), flags, 0o600)
        digest = hashlib.sha256()
        size = 0
        try:
            with os.fdopen(fd, "wb") as output, payload_read_deadline(self.timeout):
                while True:
                    chunk = response.read(CHUNK_SIZE)
                    if not chunk:
                        break
                    budget.receive_source(len(chunk))
                    output.write(chunk)
                    digest.update(chunk)
                    size += len(chunk)
        except BaseException:
            destination.unlink(missing_ok=True)
            raise
        finally:
            response.close()
        if size != entry["size"]:
            destination.unlink(missing_ok=True)
            raise SourceDriftError("downloaded source size differs from plan")
        return {"sha256": digest.hexdigest(), "etag": response.headers.get("ETag"), "contentType": response.headers.get("Content-Type")}


def make_plan(entries: Sequence[Mapping[str, Any]], snapshot_id: str, db_backup_id: str, db_backup_time: str, captured_at: Optional[str] = None) -> Dict[str, Any]:
    captured = captured_at or utc_now()
    expires = (parse_utc(captured) + dt.timedelta(days=EXPIRY_DAYS)).isoformat().replace("+00:00", "Z")
    objects = [dict(entry) for entry in entries]
    plan: Dict[str, Any] = {
        "schema": SCHEMA,
        "version": 1,
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
    if previous.get("schema") != MANIFEST_SCHEMA or previous.get("status") != "complete":
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
) -> Tuple[Dict[str, Any], TransferBudget]:
    validate_plan(plan)
    cache_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(cache_dir, 0o700)
    bind_resume_cache(cache_dir, plan)
    current = source.inventory()
    if inventory_digest(current) != plan["inventoryDigest"]:
        raise SourceDriftError("source inventory changed before prepare")
    prior = previous_by_identity(previous, now or dt.datetime.now(dt.timezone.utc))
    budget = TransferBudget()
    prepared = dict(plan)
    prepared["mode"] = "prepared"
    prepared_objects = []
    prefix = plan["destinationPrefix"]
    for approved in plan["objects"]:
        entry = dict(approved)
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
            entry.update({
                "sourceSha256": result["sha256"],
                "cacheFile": cache_name,
                "ciphertextKey": f"{prefix}objects/{identity[:2]}/{identity}.age",
                "ciphertextChecksumKey": f"{prefix}objects/{identity[:2]}/{identity}.age.sha256",
                "proof": "downloaded-byte-sha256",
                "reuse": None,
            })
        prepared_objects.append(entry)
    if inventory_digest(source.inventory()) != plan["inventoryDigest"]:
        raise SourceDriftError("source inventory changed during prepare")
    prepared["objects"] = prepared_objects
    prepared["preparedAt"] = utc_now()
    prepared["manifestCreatedAt"] = prepared["preparedAt"]
    prepared["summary"] = dict(plan["summary"], downloadedObjects=budget.source_attempts, downloadedBytes=budget.source_bytes, reusedObjects=len(prepared_objects) - budget.source_attempts)
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

    def put_create_only(
        self, key: str, path: pathlib.Path, sha256: str, budget: TransferBudget,
        kind: str, proof: Optional[Mapping[str, str]] = None,
    ) -> Tuple[str, str, int]:
        if not key.startswith(R2_PREFIX):
            raise ValidationError("R2 key outside approved namespace")
        actual_sha, size = sha256_file(path)
        if actual_sha != sha256:
            raise ValidationError("local upload SHA mismatch")
        budget.begin_r2(size)
        metadata = {"sha256": sha256, "kind": kind, "schema": "storage-backup-v1"}
        for proof_key, proof_value in (proof or {}).items():
            if proof_key not in {"plan-digest", "source-identity", "source-sha256", "cipher-sha256"}:
                raise ValidationError("unsupported R2 proof metadata")
            if not isinstance(proof_value, str) or not proof_value:
                raise ValidationError("invalid R2 proof metadata")
            metadata[proof_key] = proof_value
        try:
            with path.open("rb") as body:
                self.client.put_object(
                    Bucket=self.bucket, Key=key, Body=body, IfNoneMatch="*",
                    ContentType="application/octet-stream",
                    Metadata=metadata,
                )
            budget.created_r2(size)
            return "created", sha256, size
        except Exception as exc:
            response = getattr(exc, "response", {})
            code = str(response.get("Error", {}).get("Code", ""))
            status = response.get("ResponseMetadata", {}).get("HTTPStatusCode")
            if code not in {"PreconditionFailed", "412"} and status != 412:
                raise BackupError("R2 conditional create failed") from exc
        head = self.client.head_object(Bucket=self.bucket, Key=key)
        existing = {str(k).lower(): str(v) for k, v in (head.get("Metadata") or {}).items()}
        semantic_exact = all(existing.get(name) == value for name, value in (proof or {}).items())
        existing_sha = existing.get("sha256", "")
        existing_size = head.get("ContentLength")
        valid_existing_sha = len(existing_sha) == 64 and all(c in "0123456789abcdef" for c in existing_sha)
        if (
            existing.get("schema") != "storage-backup-v1" or existing.get("kind") != kind
            or not semantic_exact or not valid_existing_sha
            or isinstance(existing_size, bool) or not isinstance(existing_size, int) or existing_size < 0
        ):
            raise ConflictError("existing R2 object conflicts with approved ciphertext")
        if not proof and (existing_size != size or existing_sha != sha256):
            raise ConflictError("existing R2 object conflicts with approved ciphertext")
        return "concurrent-exact-skip", existing_sha, existing_size

    def head(self, key: str) -> Mapping[str, Any]:
        return self.client.head_object(Bucket=self.bucket, Key=key)

    def download(self, key: str, destination: pathlib.Path) -> None:
        destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        fd = os.open(str(destination), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        response = self.client.get_object(Bucket=self.bucket, Key=key)
        try:
            with os.fdopen(fd, "wb") as output:
                while True:
                    chunk = response["Body"].read(CHUNK_SIZE)
                    if not chunk:
                        break
                    output.write(chunk)
        except BaseException:
            destination.unlink(missing_ok=True)
            raise


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
) -> Tuple[Dict[str, Any], TransferBudget]:
    validate_plan(plan, confirm_digest=confirm_digest, require_prepared=True)
    apply_time = now or dt.datetime.now(dt.timezone.utc)
    if parse_utc(plan["expiresAt"]) <= apply_time:
        raise ValidationError("prepared plan retention has expired")
    current = source.inventory()
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
    budget = TransferBudget()
    results: List[Dict[str, Any]] = []
    for entry in plan["objects"]:
        if entry.get("reuse"):
            verify_reused(store, entry)
            results.append(dict(entry, ciphertextSha256=entry["reuse"]["ciphertextSha256"], ciphertextSize=entry["reuse"]["ciphertextSize"], expiresAt=entry["reuse"]["expiresAt"]))
            continue
        ciphertext = work_dir / (entry["identity"] + ".age")
        checksum = work_dir / (entry["identity"] + ".age.sha256")
        encryptor.encrypt(local_files[entry["identity"]], ciphertext)
        cipher_sha, _ = sha256_file(ciphertext)
        checksum.write_text(cipher_sha + "\n", encoding="ascii")
        os.chmod(checksum, 0o600)
        source_proof = {"plan-digest": plan["planDigest"], "source-identity": entry["identity"], "source-sha256": entry["sourceSha256"]}
        _, stored_cipher_sha, stored_cipher_size = store.put_create_only(
            entry["ciphertextKey"], ciphertext, cipher_sha, budget, "source-ciphertext", source_proof
        )
        if stored_cipher_sha != cipher_sha:
            checksum.write_text(stored_cipher_sha + "\n", encoding="ascii")
            os.chmod(checksum, 0o600)
        checksum_sha, _ = sha256_file(checksum)
        checksum_proof = dict(source_proof, **{"cipher-sha256": stored_cipher_sha})
        store.put_create_only(
            entry["ciphertextChecksumKey"], checksum, checksum_sha, budget, "source-checksum", checksum_proof
        )
        results.append(dict(entry, ciphertextSha256=stored_cipher_sha, ciphertextSize=stored_cipher_size, expiresAt=plan["expiresAt"]))

    end_inventory = source.inventory()
    if inventory_digest(end_inventory) != plan["inventoryDigest"]:
        raise SourceDriftError("source inventory changed during apply")
    recoverable_until = min(parse_utc(item["expiresAt"]) for item in results).isoformat().replace("+00:00", "Z") if results else plan["expiresAt"]
    manifest: Dict[str, Any] = {
        "schema": MANIFEST_SCHEMA,
        "version": 1,
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
        "summary": {"objectCount": len(results), "sourceBytes": sum(item["size"] for item in results)},
        "objects": results,
    }
    manifest_plain = work_dir / "storage-manifest.json"
    safe_write_json(manifest_plain, manifest)
    manifest_age = work_dir / "storage-manifest.json.age"
    encryptor.encrypt(manifest_plain, manifest_age)
    manifest_sha, _ = sha256_file(manifest_age)
    manifest_checksum = work_dir / "storage-manifest.json.age.sha256"
    manifest_checksum.write_text(manifest_sha + "\n", encoding="ascii")
    os.chmod(manifest_checksum, 0o600)
    manifest_key = plan["destinationPrefix"] + "storage-manifest.json.age"
    manifest_checksum_key = manifest_key + ".sha256"
    manifest_proof = {"plan-digest": plan["planDigest"]}
    _, stored_manifest_sha, stored_manifest_size = store.put_create_only(
        manifest_key, manifest_age, manifest_sha, budget, "snapshot-manifest", manifest_proof
    )
    if stored_manifest_sha != manifest_sha:
        manifest_checksum.write_text(stored_manifest_sha + "\n", encoding="ascii")
        os.chmod(manifest_checksum, 0o600)
    checksum_sha, _ = sha256_file(manifest_checksum)
    store.put_create_only(
        manifest_checksum_key, manifest_checksum, checksum_sha, budget, "snapshot-manifest-checksum",
        {"plan-digest": plan["planDigest"], "cipher-sha256": stored_manifest_sha},
    )
    public_summary = {
        "schema": SCHEMA,
        "status": "complete",
        "snapshotId": plan["snapshotId"],
        "planDigest": plan["planDigest"],
        "manifestKey": manifest_key,
        "manifestChecksumKey": manifest_checksum_key,
        "manifestCiphertextSha256": stored_manifest_sha,
        "manifestCiphertextSize": stored_manifest_size,
        "recoverableUntil": recoverable_until,
        "objectCount": len(results),
        "sourceBytes": sum(item["size"] for item in results),
        "budget": budget.as_dict(),
    }
    return public_summary, budget


def restore_snapshot(store: R2Store, manifest_key: str, manifest_checksum_key: str, identity: pathlib.Path, destination: pathlib.Path, encryptor: AgeEncryptor) -> Dict[str, Any]:
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
        if manifest.get("schema") != MANIFEST_SCHEMA or manifest.get("status") != "complete":
            raise ValidationError("invalid snapshot manifest")
        parse_utc(manifest.get("recoverableUntil"))
        seen_paths = set()
        for entry in manifest.get("objects", []):
            validate_object_entry(entry, prepared=True)
            bucket = entry["bucket"]
            key = entry["key"]
            relative = pathlib.PurePosixPath(bucket) / pathlib.PurePosixPath(key)
            if relative.is_absolute() or ".." in relative.parts or str(relative) in seen_paths:
                raise ValidationError("unsafe or duplicate restore path")
            seen_paths.add(str(relative))
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
        if restored != manifest["summary"]["objectCount"] or restored_bytes != manifest["summary"]["sourceBytes"]:
            raise ValidationError("restored key set summary mismatch")
        safe_write_json(destination / ".locally-storage-restore-metadata.json", {
            "snapshotId": manifest["snapshotId"],
            "objectCount": restored,
            "sourceBytes": restored_bytes,
            "verifiedAt": utc_now(),
            "contentInspectionPerformed": False,
        })
        safe_write_json(destination / ".locally-storage-manifest.json", manifest)
        return {"status": "complete", "objectCount": restored, "sourceBytes": restored_bytes, "snapshotId": manifest["snapshotId"]}
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


def source_from_env(args: argparse.Namespace) -> SupabaseStorageSource:
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    return SupabaseStorageSource(args.project_url, key, timeout=args.timeout)


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Encrypted Supabase Storage byte backup")
    sub = parser.add_subparsers(dest="command", required=True)
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--project-url", default="https://uhinvcydgzqlpnvieyal.supabase.co")
    common.add_argument("--timeout", type=float, default=30.0)
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
        print(json.dumps({"status": "prepared", "objectCount": len(prepared["objects"]), "planDigest": prepared["planDigest"], "sourceAttempts": budget.source_attempts, "sourceBytes": budget.source_bytes}, sort_keys=True))
    elif args.command == "apply":
        plan = read_private_json(args.plan)
        summary, _ = apply_plan(plan, args.confirm_digest, source_from_env(args), boto3_store(), AgeEncryptor(args.age_recipient), args.cache_dir, args.work_dir)
        safe_write_json(args.summary, summary)
        print(json.dumps(summary, sort_keys=True))
    else:
        result = restore_snapshot(boto3_store(), args.manifest_key, args.manifest_checksum_key, args.identity, args.destination, AgeEncryptor())
        print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except BackupError as exc:
        print(json.dumps({"status": "failed", "diagnosticCode": exc.code}), file=os.sys.stderr)
        raise SystemExit(1)
