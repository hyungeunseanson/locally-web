"""Real age crypto and the actual restore pipeline, using only synthetic bytes.

No Production identity, network client or remote backup is accepted. This proves
fixture recovery, not availability of the operator's Production private key.
"""
import datetime as dt
import json
import os
import pathlib
import subprocess
import tempfile
import time

import storage_byte_backup as backup
from storage_byte_backup_test import FakeS3, FakeSource, entry


def rehearse():
    started = time.monotonic()
    with tempfile.TemporaryDirectory(prefix="locally-age-rehearsal-") as temporary:
        root = pathlib.Path(temporary)
        identity = root / "fixture.agekey"
        subprocess.run(["age-keygen", "--output", str(identity)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        os.chmod(identity, 0o600)
        recipient = subprocess.check_output(["age-keygen", "-y", str(identity)], text=True).strip()
        crypt = backup.AgeEncryptor(recipient)
        bodies = {("experiences", "folder/한글.jpg"): b"synthetic-image", ("verification-docs", "same-name"): b"synthetic-private-document", ("images", "empty"): b""}
        items = [entry(bucket, key, body, "application/octet-stream") for (bucket, key), body in bodies.items()]
        source = FakeSource(items, bodies)
        now = dt.datetime.now(dt.timezone.utc)
        timestamp = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        plan = backup.make_plan(items, now.strftime("%Y-%m-%dT%H-%M-%SZ-fixture"), "34916900214", timestamp, timestamp)
        prepared, _ = backup.prepare_plan(plan, source, root / "cache")
        fake = FakeS3()
        store = backup.R2Store(fake, backup.PRIVATE_R2_BUCKET)
        summary, _ = backup.apply_plan(prepared, prepared["planDigest"], source, store, crypt, root / "cache", root / "work")
        result = backup.restore_snapshot(store, summary["manifestKey"], summary["manifestChecksumKey"], identity, root / "restored", crypt)
        assert result["objectCount"] == len(bodies)
        for (bucket, key), body in bodies.items():
            assert (root / "restored" / bucket / key).read_bytes() == body
        assert fake.copy_calls == fake.delete_calls == 0
        # Exercise ciphertext authentication independently of manifest checksums.
        plain = root / "plain"
        plain.write_bytes(b"synthetic authentication proof")
        cipher = root / "cipher.age"
        crypt.encrypt(plain, cipher)
        corrupt = bytearray(cipher.read_bytes())
        corrupt[-1] ^= 1
        cipher.write_bytes(corrupt)
        try:
            crypt.decrypt(cipher, identity, root / "must-not-exist")
        except backup.BackupError:
            assert not (root / "must-not-exist").exists()
        else:
            raise AssertionError("tampered ciphertext accepted")
        return {"status": "SYNTHETIC_ENCRYPTED_RESTORE_PASS", "objects": len(bodies), "bytes": sum(map(len, bodies.values())), "ciphertextTamperRejected": True, "elapsedSeconds": round(time.monotonic() - started, 3), "productionPrivateIdentityVerified": False, "productionMutations": 0}


if __name__ == "__main__":
    print(json.dumps(rehearse()))
