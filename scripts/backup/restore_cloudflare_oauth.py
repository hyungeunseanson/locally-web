#!/usr/bin/env python3
"""Local isolated restore over Cloudflare R2 REST GET and Wrangler OAuth.

No source inventory or remote write methods. The existing restore_snapshot
owns all manifest, ciphertext, decryption and plaintext integrity checks.
"""
from __future__ import annotations

import argparse
import contextlib
import json
import os
import pathlib
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

from storage_byte_backup import (
    AgeEncryptor, BackupError, BudgetError, CHUNK_SIZE, MAX_R2_BYTES,
    PRIVATE_R2_BUCKET, R2_PREFIX, RestoreDiagnostics, RestoreReadError,
    SourceTimeoutError, ValidationError, payload_read_deadline,
    restore_read_error, restore_snapshot,
)

MAX_OAUTH_REFRESHES = 3
DOWNLOAD_OPERATIONS = {
    "restore_manifest_download", "restore_manifest_checksum_download",
    "restore_ciphertext_download", "restore_ciphertext_checksum_download",
}


class RestoreOAuthError(RestoreReadError):
    def __init__(self, code, operation="restore_manifest_download"):
        super().__init__(code, operation, stage="isolated_full_restore")
        self.evidence.update(sdkExceptionClass=None, httpStatus=None,
                             providerErrorCode=None, retryable=False)


class WranglerOAuthTokenProvider:
    def __init__(self, repository, executable=None, runner=subprocess.run):
        self.repository = pathlib.Path(repository)
        self.executable = executable or self.repository / "node_modules/.bin/wrangler"
        self.runner = runner

    def get_token(self):
        # stdout/stderr stay private; never include subprocess errors or output
        # in an exception, checkpoint, report or console message.
        try:
            result = self.runner(
                [str(self.executable), "auth", "token", "--json"],
                cwd=self.repository, capture_output=True, text=True, timeout=35,
                stdin=subprocess.DEVNULL,
                # Wrangler's auth-token command uses its logger: explicitly
                # disable disk logs so the privately captured JSON is RAM-only.
                env=dict(os.environ, CI="true", WRANGLER_SEND_METRICS="false",
                         WRANGLER_WRITE_LOGS="false", WRANGLER_LOG="log",
                         WRANGLER_LOG_SANITIZE="true"),
            )
        except Exception:
            raise RestoreOAuthError("restore_oauth_provider_failed") from None
        if result.returncode != 0:
            raise RestoreOAuthError("restore_oauth_provider_failed")
        try:
            value = json.loads(result.stdout)
        except (ValueError, TypeError):
            raise RestoreOAuthError("restore_oauth_provider_invalid_json") from None
        if not isinstance(value, dict) or value.get("type") != "oauth":
            raise RestoreOAuthError("restore_oauth_type_required")
        token = value.get("token")
        if not isinstance(token, str) or not token or any(c.isspace() for c in token):
            raise RestoreOAuthError("restore_oauth_token_invalid")
        return token


class OAuthRestoreDiagnostics(RestoreDiagnostics):
    def __init__(self, path=None):
        super().__init__(path)
        self.state.update(authType="oauth", oauthRefreshCount=0,
                          oauthRefreshAttempted=False, oauthRefreshSucceeded=False)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Keep the in-memory Bearer on the exact REST origin.


class CloudflareOAuthRestoreTransport:
    def __init__(self, account_id, provider, *, diagnostics=None, opener=None):
        if not re.fullmatch(r"[0-9a-f]{32}", account_id):
            raise ValidationError("invalid restore account")
        self.provider = provider
        self.diagnostics = diagnostics or OAuthRestoreDiagnostics()
        self.opener = opener or urllib.request.build_opener(NoRedirect()).open
        self.base = ("https://api.cloudflare.com/client/v4/accounts/" + account_id
                     + "/r2/buckets/" + PRIVATE_R2_BUCKET + "/objects/")
        self.operations = 0
        self.refresh_count = 0
        self._bearer = None
        try:
            self._bearer = self.provider.get_token()
        except RestoreOAuthError as error:
            self.diagnostics.failed(error)
            raise

    def download(self, key, destination, *, operation="restore_ciphertext_download", diagnostics=None):
        if operation not in DOWNLOAD_OPERATIONS or not key.startswith(R2_PREFIX):
            raise ValidationError("invalid restore download")
        diag = diagnostics or self.diagnostics
        transient_retries, auth_retried = 0, False
        while True:
            body, http_failure, request, created, action = None, None, None, False, None
            try:
                destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                fd = os.open(str(destination), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                created = True
                with os.fdopen(fd, "wb") as output:
                    request = urllib.request.Request(
                        self.base + urllib.parse.quote(key, safe="/"), method="GET",
                        headers={"Authorization": "Bearer " + self._bearer, "Accept-Encoding": "identity"},
                    )
                    self.operations += 1
                    body = self.opener(request, timeout=60)
                    if auth_retried:
                        diag.state["oauthRefreshSucceeded"] = True
                        diag.write()
                    size = 0
                    while True:
                        with payload_read_deadline(60):
                            chunk = body.read(CHUNK_SIZE)
                        if not chunk:
                            break
                        size += len(chunk)
                        if size > MAX_R2_BYTES:
                            raise BudgetError("restore object ceiling exceeded")
                        output.write(chunk)
                return
            except Exception as error:
                is_401 = isinstance(error, urllib.error.HTTPError) and error.code == 401
                if is_401:
                    self._bearer = None
                    if request is not None:
                        request.remove_header("Authorization")
                    diag.state["oauthRefreshSucceeded"] = False
                if created:
                    destination.unlink(missing_ok=True)
                if isinstance(error, urllib.error.HTTPError):
                    http_failure = error
                if isinstance(error, BackupError) and not isinstance(error, SourceTimeoutError):
                    raise
                failure = restore_read_error(error, operation)
                if is_401:
                    if auth_retried:
                        raise failure from None
                    if self.refresh_count >= MAX_OAUTH_REFRESHES:
                        raise RestoreOAuthError("restore_oauth_refresh_limit", operation) from None
                    action = "oauth"
                elif failure.evidence["retryable"] and transient_retries == 0:
                    transient_retries += 1
                    diag.state["restoreRetryCount"] += 1
                    diag.state.update(failure.evidence)
                    diag.write()
                    action = "transport"
                else:
                    raise failure from None
            finally:
                # Both a streaming body and urllib's failed HTTP response must
                # be closed before asking Wrangler for a replacement Bearer.
                for response in (body, http_failure):
                    if response is not None:
                        with contextlib.suppress(Exception):
                            response.close()
            if action == "oauth":
                auth_retried = True
                self.refresh_count += 1
                diag.state.update(oauthRefreshCount=self.refresh_count,
                                  oauthRefreshAttempted=True, oauthRefreshSucceeded=False)
                diag.write()
                try:
                    self._bearer = self.provider.get_token()
                except RestoreOAuthError as error:
                    error.operation = operation
                    raise error from None
            else:
                time.sleep(1)  # Existing one-retry transport policy; separate auth budget.


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--account-id", required=True)
    parser.add_argument("--manifest-key", required=True)
    parser.add_argument("--manifest-checksum-key", required=True)
    parser.add_argument("--identity", required=True, type=pathlib.Path)
    parser.add_argument("--destination", required=True, type=pathlib.Path)
    parser.add_argument("--summary", required=True, type=pathlib.Path)
    args = parser.parse_args()
    diag = OAuthRestoreDiagnostics(args.summary)
    try:
        repository = pathlib.Path(__file__).resolve().parents[2]
        store = CloudflareOAuthRestoreTransport(args.account_id, WranglerOAuthTokenProvider(repository), diagnostics=diag)
        restore_snapshot(store, args.manifest_key, args.manifest_checksum_key,
                         args.identity, args.destination, AgeEncryptor(), diagnostics=diag)
    except Exception as error:
        if not hasattr(error, "restore_evidence"):
            diag.failed(error)
        print(json.dumps(diag.summary()))
        return 1
    print(json.dumps(diag.summary()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
