import io
import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest
import storage_byte_backup as backup
from storage_byte_backup_test import FakeSource, FakeS3
from storage_multi_source_test import provider_entry

KEY = 'avatars/v1/' + 'a' * 64 + '/11111111-1111-4111-8111-111111111111/avatar.png'
BODY = b'\x89PNG\r\n\x1a\navatar source'


class AvatarReader:
    def __init__(self): self.calls = []
    def list_objects_v2(self, **kw):
        self.calls.append(('list', kw)); assert kw['Prefix'] == 'avatars/v1/'
        return {'Contents': [{'Key': KEY, 'Size': len(BODY)}], 'IsTruncated': False}
    def head_object(self, **kw):
        self.calls.append(('head', kw))
        return {'ContentLength': len(BODY), 'ContentType': 'image/png', 'CacheControl': 'immutable', 'Metadata': {}, 'ETag': '"v1"', 'LastModified': '2026-10-05T00:00:00Z'}
    def get_object(self, **kw):
        self.calls.append(('get', kw)); assert kw['IfMatch'] == '"v1"'
        return {'Body': io.BytesIO(BODY), 'ContentType': 'image/png', 'ETag': '"v1"'}


class AvatarBackupTests(unittest.TestCase):
    def test_avatar_locator_exact_bucket_mapping_and_no_arbitrary_authority(self):
        url = 'https://avatars-media.locally-travel.com/' + KEY
        self.assertEqual(backup.source_locator(url), ('r2', backup.R2_AVATAR_SOURCE_BUCKET, KEY))
        for bad in [url + '?x=1', url.replace('/avatars/v1/', '/private/'), url.replace('avatars-media.', 'evil.')]:
            self.assertIsNone(backup.source_locator(bad))

    def test_avatar_reader_namespace_db_references_pending_and_actual_bytes(self):
        client = AvatarReader(); source = backup.R2StorageSource(client, backup.R2_AVATAR_SOURCE_BUCKET)
        refs = {('r2', backup.R2_AVATAR_SOURCE_BUCKET, KEY): [{'relation': 'media_assets', 'optionalPending': True}]}
        items = source.inventory(refs); self.assertEqual(len(items), 1)
        with tempfile.TemporaryDirectory() as root:
            proof = source.download(items[0], pathlib.Path(root) / 'source', backup.TransferBudget())
        self.assertEqual(proof['sha256'], backup.sha256_bytes(BODY))
        self.assertTrue(all(op in {'list', 'head', 'get'} for op, _ in client.calls))
        refs[('r2', backup.R2_AVATAR_SOURCE_BUCKET, KEY + '-not-uploaded')] = [{'optionalPending': True}]
        self.assertEqual(len(source.inventory(refs)), 1)

    def test_unconfigured_avatar_reader_fails_closed_and_existing_experience_reader_cannot_read_it(self):
        refs = {('r2', backup.R2_AVATAR_SOURCE_BUCKET, KEY): []}
        supabase = FakeSource([], {})
        source = backup.MultiStorageSource(supabase, None, reference_reader=lambda _: refs)
        with self.assertRaises(backup.ValidationError): source.inventory()
        self.assertEqual(supabase.downloads, 0)

    def test_multisource_routes_avatar_to_separate_reader_and_rejects_unknown_bucket(self):
        refs = {('r2', backup.R2_AVATAR_SOURCE_BUCKET, KEY): []}
        class Empty:
            def inventory(self, references):
                assert not any(bucket == backup.R2_AVATAR_SOURCE_BUCKET for _, bucket, _ in references)
                return []
        class Supabase(FakeSource):
            @staticmethod
            def restore_metadata(_): return {}
        client = AvatarReader()
        source = backup.MultiStorageSource(Supabase([], {}), Empty(), reference_reader=lambda _: refs,
            avatar=backup.R2StorageSource(client, backup.R2_AVATAR_SOURCE_BUCKET))
        items = source.inventory(); self.assertEqual(len(items), 1)
        with tempfile.TemporaryDirectory() as root:
            self.assertEqual(source.download(items[0], pathlib.Path(root) / 'bytes', backup.TransferBudget())['sha256'], backup.sha256_bytes(BODY))
        refs[('r2', 'unapproved-bucket', KEY)] = []
        with self.assertRaises(backup.ValidationError): source.inventory()

    def test_hard_ceilings_and_no_delete_source_contract_unchanged(self):
        self.assertEqual((backup.MAX_OBJECTS, backup.MAX_SOURCE_BYTES, backup.MAX_R2_OBJECTS, backup.MAX_R2_BYTES), (5000, 2*1024**3, 12000, 3*1024**3))
        for method in ['put', 'copy', 'delete']:
            self.assertFalse(hasattr(backup.R2StorageSource, method))

    def test_avatar_real_encrypted_snapshot_full_restore_same_format_and_mapping(self):
        age = os.environ.get('AGE_PATH') or shutil.which('age'); keygen = os.environ.get('AGE_KEYGEN_PATH') or shutil.which('age-keygen')
        if not age or not keygen: raise RuntimeError('real age fixture required')
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory); identity = root/'identity'
            subprocess.run([keygen, '-o', str(identity)], check=True, capture_output=True)
            recipient = subprocess.check_output([keygen, '-y', str(identity)], text=True).strip()
            encryptor = backup.AgeEncryptor(recipient, age)
            item = provider_entry('r2', backup.R2_AVATAR_SOURCE_BUCKET, KEY, BODY)
            source = FakeSource([item], {(item['bucket'], KEY): BODY})
            plan = backup.make_plan([item], '2026-10-05T00-00-00Z-avatar-fixture', 'fixture-db', '2026-10-04T23:59:00Z')
            prepared, _ = backup.prepare_plan(plan, source, root/'cache')
            s3 = FakeS3(); store = backup.R2Store(s3, backup.PRIVATE_R2_BUCKET)
            summary, _ = backup.apply_plan(prepared, prepared['planDigest'], source, store, encryptor, root/'cache', root/'work')
            proof = backup.restore_snapshot(store, summary['manifestKey'], summary['manifestChecksumKey'], identity, root/'restore', encryptor)
            self.assertEqual(proof['objectCount'], 1); self.assertEqual(proof['sourceBytes'], len(BODY))
            self.assertEqual(proof['missing'], 0); self.assertEqual(proof['shaMismatch'], 0)
            self.assertEqual((root/'restore'/'r2'/backup.R2_AVATAR_SOURCE_BUCKET/KEY).read_bytes(), BODY)
            self.assertEqual(s3.delete_calls, 0); self.assertEqual(s3.copy_calls, 0)
