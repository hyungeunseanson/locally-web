import io
import json
import os
import pathlib
import subprocess
import tempfile
import unittest
from unittest import mock
import storage_byte_backup as backup
from storage_byte_backup_test import FakeSource, FakeS3
from storage_multi_source_test import provider_entry
KEY = 'host-profiles/v1/'+'a'*64+'/11111111-1111-4111-8111-111111111111/profile'
BODY = b'\x89PNG\r\n\x1a\nsynthetic host original'
URL = 'https://host-profile-media.locally-travel.com/'+KEY
class HostReader:
    def __init__(self): self.calls=[]
    def list_objects_v2(self, **kw):
        self.calls.append(('list',kw)); assert kw['Prefix']=='host-profiles/v1/'
        return {'Contents':[{'Key':KEY,'Size':len(BODY)}], 'IsTruncated':False}
    def head_object(self, **kw):
        self.calls.append(('head',kw));return {'ContentLength':len(BODY),'ContentType':'image/png','CacheControl':'immutable','Metadata':{},'ETag':'"v1"','LastModified':'2026-10-06T00:00:00Z'}
    def get_object(self, **kw):
        self.calls.append(('get',kw));assert kw['IfMatch']=='"v1"';return {'Body':io.BytesIO(BODY),'ContentType':'image/png','ETag':'"v1"'}
class HostBackupTests(unittest.TestCase):
    def test_HOST_BACKUP_SOURCE_CONTRACT_READY(self):
        self.assertEqual(backup.source_locator(URL),('r2',backup.R2_HOST_PROFILE_SOURCE_BUCKET,KEY))
        for bad in [URL+'?capability=x',URL+'#x',URL.replace('/host-profiles/v1/','/avatars/v1/'),URL.replace('host-profile-media.','profiles-media.')]:self.assertIsNone(backup.source_locator(bad))
        c=HostReader();s=backup.R2StorageSource(c,backup.R2_HOST_PROFILE_SOURCE_BUCKET);refs={('r2',backup.R2_HOST_PROFILE_SOURCE_BUCKET,KEY):[{'relation':'auth.users'}]}
        items=s.inventory(refs)
        with tempfile.TemporaryDirectory() as root:self.assertEqual(s.download(items[0],pathlib.Path(root)/'bytes',backup.TransferBudget())['sha256'],backup.sha256_bytes(BODY))
        self.assertTrue(all(op in {'list','head','get'} for op,_ in c.calls))
        self.assertFalse(any(hasattr(s,n) for n in ['put','delete','copy']))
        with self.assertRaises(backup.ValidationError):backup.MultiStorageSource(FakeSource([],{}),None,reference_reader=lambda _:refs).inventory()
    def test_narrow_auth_backup_association_excludes_metadata_and_fails_closed(self):
        source=backup.SupabaseStorageSource('https://uhinvcydgzqlpnvieyal.supabase.co','sb_secret_fixture')
        calls=[]
        def request(method,path,body=None):
            calls.append((method,path,body))
            if 'host_profile_auth_backup_references' in path:return io.BytesIO(json.dumps([{'kind':'auth_legacy_host','id':'opaque-owner','owner':'opaque-owner','locator':URL,'metadataDigest':'a'*64}]).encode())
            return io.BytesIO(b'[]')
        source._request=request;refs=backup.database_references(source,True,True)
        row=refs[('r2',backup.R2_HOST_PROFILE_SOURCE_BUCKET,KEY)][0];self.assertEqual(row['relation'],'auth.users');self.assertNotIn('metadataDigest',row);self.assertFalse(any('/auth/v1' in p for _,p,_ in calls))
        source._request=lambda *a:io.BytesIO(b'{}')
        with self.assertRaises(backup.BackupError):backup.database_references(source,True,True)
    def test_full_encrypted_source_restore_preserves_host_auth_mapping_and_avatar_format(self):
        age=os.environ.get('AGE_PATH');keygen=os.environ.get('AGE_KEYGEN_PATH');self.assertTrue(age and keygen,'real age required')
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d);identity=root/'identity';subprocess.run([keygen,'-o',str(identity)],check=True,capture_output=True)
            recipient=subprocess.check_output([keygen,'-y',str(identity)],text=True).strip();encryptor=backup.AgeEncryptor(recipient,age)
            host=provider_entry('r2',backup.R2_HOST_PROFILE_SOURCE_BUCKET,KEY,BODY);host['dbReferences']=[{'relation':'auth.users','rowId':'opaque-owner','field':'raw_user_meta_data.avatar_url','jsonPath':'$.avatar_url','locator':URL}]
            avatar_key='avatars/v1/'+'b'*64+'/22222222-2222-4222-8222-222222222222/avatar.png';avatar=provider_entry('r2',backup.R2_AVATAR_SOURCE_BUCKET,avatar_key,BODY)
            source=FakeSource([host,avatar],{(backup.R2_HOST_PROFILE_SOURCE_BUCKET,KEY):BODY,(backup.R2_AVATAR_SOURCE_BUCKET,avatar_key):BODY});plan=backup.make_plan(source.inventory(),'2026-10-06T00-00-00Z-host-fixture','fixture-db','2026-10-05T23:59:00Z')
            prepared,_=backup.prepare_plan(plan,source,root/'cache');s3=FakeS3();store=backup.R2Store(s3,backup.PRIVATE_R2_BUCKET);summary,_=backup.apply_plan(prepared,prepared['planDigest'],source,store,encryptor,root/'cache',root/'work');proof=backup.restore_snapshot(store,summary['manifestKey'],summary['manifestChecksumKey'],identity,root/'restored',encryptor)
            self.assertEqual(proof['objectCount'],2);self.assertEqual(proof['shaMismatch'],0);self.assertEqual((root/'restored'/'r2'/backup.R2_HOST_PROFILE_SOURCE_BUCKET/KEY).read_bytes(),BODY)
            self.assertEqual(s3.delete_calls,0);self.assertEqual(s3.copy_calls,0)
            manifest=json.loads((root/'restored'/'.locally-storage-manifest.json').read_text());self.assertTrue(any(r['relation']=='auth.users' for x in manifest['objects'] for r in x['dbReferences']))
