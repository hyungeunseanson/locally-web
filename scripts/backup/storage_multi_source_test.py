import copy
import datetime as dt
import io
import json
import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest
from unittest import mock
import storage_byte_backup as backup
from storage_byte_backup_test import entry, FakeSource, FakeS3
from media_lifecycle_plan import plan as lifecycle_plan
from run_storage_backup import nearest_database_backup


def provider_entry(provider, bucket, key, body):
    item = entry(bucket, key, body, 'image/png')
    item.update(provider=provider, authority='recoverable-source' if provider == 'supabase' else 'production-db-reference',
                identity=backup.source_identity(bucket, key, provider), httpMetadata={'ContentType':'image/png','CacheControl':'immutable'},
                customMetadata={'restore':'required'}, dbReferences=[{'relation':'fixture','rowId':'opaque','field':'photos','jsonPath':'$[0]','locator':'fixture'}])
    return item


class ReadOnlyR2:
    def __init__(self, body=b'actual bytes'):
        self.body=body; self.calls=[]; self.bad_page=False
    def list_objects_v2(self, **kw):
        self.calls.append(('list',kw))
        if kw['Prefix']=='sources/':
            return {'Contents':[], 'IsTruncated':False}
        if not kw.get('ContinuationToken'):
            return {'Contents':[{'Key':'originals/a.png','Size':len(self.body)}], 'IsTruncated':True,'NextContinuationToken':'next'}
        return {'Contents':[{'Key':'originals/unused.png','Size':1}], 'IsTruncated':self.bad_page,'NextContinuationToken':'next'}
    def head_object(self, **kw):
        self.calls.append(('head',kw))
        return {'ContentLength':len(self.body),'ContentType':'image/png','CacheControl':'immutable','Metadata':{'sha256':'metadata-is-not-byte-proof'},'ETag':'"v1"','LastModified':'2026-10-04T00:00:00Z'}
    def get_object(self, **kw):
        self.calls.append(('get',kw))
        assert kw['IfMatch']=='"v1"'
        return {'Body':io.BytesIO(self.body),'ContentType':'image/png','ETag':'"v1"'}


class AdapterTests(unittest.TestCase):
    def test_r2_complete_pagination_only_referenced_original_and_actual_sha(self):
        client=ReadOnlyR2();source=backup.R2StorageSource(client)
        refs={('r2',backup.R2_SOURCE_BUCKET,'originals/a.png'):[{'fixture':'association'}]}
        items=source.inventory(refs)
        self.assertEqual(len(items),1)
        self.assertIsNone(items[0]['sourceSha256'])
        with tempfile.TemporaryDirectory() as root:
            proof=source.download(items[0],pathlib.Path(root)/'bytes',backup.TransferBudget())
        self.assertEqual(proof['sha256'],backup.sha256_bytes(client.body))
        self.assertEqual([x[0] for x in client.calls].count('list'),3)
        self.assertFalse(any(hasattr(source,name) for name in ['put','delete','copy']))
        self.assertTrue(all(name in {'list','head','get'} for name,_ in client.calls))
        client.bad_page=True
        with self.assertRaises(backup.ValidationError): source.inventory(refs)
        client.bad_page=False
        with self.assertRaises(backup.SourceDriftError): source.inventory({('r2',backup.R2_SOURCE_BUCKET,'originals/missing.png'):[]})

    def test_supabase_nested_pagination_and_info_custom_metadata(self):
        source=backup.SupabaseStorageSource('https://uhinvcydgzqlpnvieyal.supabase.co','sb_secret_fixture')
        pages=[]
        def request(method,path,body=None):
            if '/info/' in path:
                return io.BytesIO(json.dumps({'size':1,'content_type':'image/png','cache_control':'immutable','metadata':{'original_bucket':'verification-docs'},'etag':'"v1"','version':'v1','last_modified':'2026-10-04T00:00:00Z'}).encode())
            query=json.loads(body);pages.append((query['prefix'],query['offset']))
            if path.endswith('/avatars') and query['prefix']=='':
                data=[{'name':str(i),'metadata':{'size':1,'mimetype':'image/png'}} for i in range(100)] if query['offset']==0 else [{'name':'nested','metadata':None}]
            elif path.endswith('/avatars') and query['prefix']=='nested':
                data=[{'name':'one.png','metadata':{'size':1,'mimetype':'image/png'}}]
            else: data=[]
            return io.BytesIO(json.dumps(data).encode())
        with mock.patch.object(source,'_request',side_effect=request):
            items=source.inventory();info=source.restore_metadata(items[0])
        self.assertEqual(len(items),101);self.assertIn(('',100),pages);self.assertIn(('nested',0),pages)
        self.assertEqual(info['customMetadata'],{'original_bucket':'verification-docs'})
        self.assertEqual(info['httpMetadata']['ContentType'],'image/png')

    def test_provider_identity_and_signed_locator_sanitization(self):
        self.assertNotEqual(backup.source_identity('same','same','supabase'),backup.source_identity('same','same','r2'))
        self.assertEqual(backup.source_locator('https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/sign/avatars/a.png?token=SECRET'),('supabase','avatars','a.png'))
        self.assertIsNone(backup.source_locator('https://evil.test/originals/a.png'))
        self.assertIsNone(backup.source_locator('https://media-canary.locally-travel.com/derivatives/a.png'))

    def test_destination_isolation(self):
        with self.assertRaises(backup.ValidationError): backup.R2Store(FakeS3(),backup.R2_SOURCE_BUCKET)
        args=type('Args',(),{'project_url':'https://uhinvcydgzqlpnvieyal.supabase.co','timeout':1,'multi_source':True})()
        with mock.patch.dict(os.environ,{'SUPABASE_SERVICE_ROLE_KEY':'sb_secret_fixture','R2_SOURCE_ACCESS_KEY_ID':'same','R2_SOURCE_SECRET_ACCESS_KEY':'secret','AWS_ACCESS_KEY_ID':'same'}):
            with self.assertRaises(backup.BackupError): backup.source_from_env(args)

    def test_nearest_database_association_requires_success_and_actual_ciphertext_sha(self):
        client=FakeS3();store=backup.R2Store(client,backup.PRIVATE_R2_BUCKET)
        old='daily/2026-10-03T00-00-00Z-123-1/locally-supabase-production-fixture.tar.gz.age'
        failed='daily/2026-10-04T00-00-00Z-124-1/locally-supabase-production-fixture.tar.gz.age'
        for key in [old,failed]:
            client.objects[key]={'body':b'encrypted fixture','metadata':{},'contentType':'application/octet-stream'}
            client.objects[key+'.sha256']={'body':(backup.sha256_bytes(b'encrypted fixture')+'  file\n').encode(),'metadata':{},'contentType':'application/octet-stream'}
        client.list_objects_v2=lambda **kw:{'Contents':[{'Key':key} for key in client.objects],'IsTruncated':False}
        boundary=dt.datetime(2026,10,4,1,tzinfo=dt.timezone.utc)
        association=nearest_database_backup(store,boundary,lambda run,attempt:run=='123')
        self.assertEqual(association['workflowRunId'],'123')
        client.objects[old]['body']=b'corrupt encrypted bytes'
        with self.assertRaises(backup.ValidationError): nearest_database_backup(store,boundary,lambda run,attempt:run=='123')
        with self.assertRaises(backup.ValidationError): nearest_database_backup(store,boundary,lambda run,attempt:False)

    def test_operator_plan_pins_references_age_and_default_disabled(self):
        base={'id':'a','provider':'r2','business_scope':'experience','state':'pending','created_at':'2026-10-01T00:00:00Z','backup_pinned':False,'migration_pinned':False}
        assets=[base,dict(base,id='b',backup_pinned=True),dict(base,id='c',migration_pinned=True),dict(base,id='d'),dict(base,id='e',state='committed')]
        self.assertEqual(lifecycle_plan(assets,[{'asset_id':'d'}],[])['ageEligibleAssetIds'],[])
        result=lifecycle_plan(assets,[{'asset_id':'d'}],[],60,dt.datetime(2026,10,4,tzinfo=dt.timezone.utc))
        self.assertEqual(result['ageEligibleAssetIds'],['a']);self.assertFalse(result['physicalDeletionEnabled']);self.assertEqual(result['historicalObjectsConsidered'],0)


class RealEncryptedMultiSourceTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.temp.name)
        age=os.environ.get('AGE_PATH') or shutil.which('age');keygen=os.environ.get('AGE_KEYGEN_PATH') or shutil.which('age-keygen')
        if not age or not keygen: raise RuntimeError('real age and age-keygen required for multi-source restore tests')
        self.identity=self.root/'fixture.agekey'
        subprocess.run([keygen,'-o',str(self.identity)],check=True,capture_output=True)
        recipient=subprocess.check_output([keygen,'-y',str(self.identity)],text=True).strip()
        self.age=backup.AgeEncryptor(recipient,age)
        a=b'\x89PNG\r\n\x1a\nsupabase fixture';b=b'\x89PNG\r\n\x1a\nr2 fixture'
        items=[provider_entry('supabase','avatars','fixture.png',a),provider_entry('r2',backup.R2_SOURCE_BUCKET,'originals/fixture.png',b)]
        self.source=FakeSource(items,{('avatars','fixture.png'):a,(backup.R2_SOURCE_BUCKET,'originals/fixture.png'):b})
        self.plan=backup.make_plan(items,'2026-10-04T00-00-00Z-fixture','fixture-db','2026-10-03T23:59:00Z')
        self.cache=self.root/'cache';self.prepared,_=backup.prepare_plan(self.plan,self.source,self.cache)
        self.s3=FakeS3();self.store=backup.R2Store(self.s3,backup.PRIVATE_R2_BUCKET)
    def tearDown(self): self.temp.cleanup()
    def apply(self,work='work'):
        return backup.apply_plan(self.prepared,self.prepared['planDigest'],self.source,self.store,self.age,self.cache,self.root/work)[0]
    def restore(self,summary,name='restored',**kw):
        return backup.restore_snapshot(self.store,summary['manifestKey'],summary['manifestChecksumKey'],self.identity,self.root/name,self.age,**kw)
    def test_full_restore_subset_one_manifest_and_duplicate_run(self):
        summary=self.apply();self.assertEqual(summary['destinationByteVerification'],'PASS');self.assertEqual(summary['providers']['r2']['objects'],1)
        proof=self.restore(summary);self.assertEqual(proof['objectCount'],2);self.assertEqual(proof['shaMismatch'],0)
        self.assertEqual((self.root/'restored'/'r2'/backup.R2_SOURCE_BUCKET/'originals/fixture.png').read_bytes(),self.source.bodies[(backup.R2_SOURCE_BUCKET,'originals/fixture.png')])
        manifest=json.loads((self.root/'restored'/'.locally-storage-manifest.json').read_text())
        self.assertEqual(manifest['objects'][0]['customMetadata'],{'restore':'required'})
        self.assertEqual(self.restore(summary,'subset',provider='r2')['objectCount'],1)
        self.assertEqual(self.restore(summary,'one',object_identity=self.prepared['objects'][0]['identity'])['objectCount'],1)
        self.assertEqual(self.restore(summary,'manifest',manifest_only=True)['selectedObjects'],2)
        second=self.apply();self.assertEqual(summary['manifestCiphertextSha256'],second['manifestCiphertextSha256'])
        self.assertEqual(self.s3.delete_calls,0);self.assertEqual(self.s3.copy_calls,0)
        reused_plan=backup.make_plan(self.source.inventory(),'2026-10-04T00-01-00Z-reuse','fixture-db','2026-10-03T23:59:00Z')
        reused,budget=backup.prepare_plan(reused_plan,self.source,self.root/'reuse-cache',manifest)
        self.assertEqual(budget.source_attempts,0)
        summary,_=backup.apply_plan(reused,reused['planDigest'],self.source,self.store,self.age,self.root/'reuse-cache',self.root/'reuse-work')
        self.assertEqual(self.restore(summary,'reuse')['objectCount'],2)
    def test_corrupt_missing_altered_bytes_wrong_identity_manifest_and_mime(self):
        summary=self.apply();original=copy.deepcopy(self.s3.objects)
        key=self.prepared['objects'][0]['ciphertextKey'];self.s3.objects[key]['body']=b'CORRUPTED'
        with self.assertRaises(backup.ValidationError): self.restore(summary,'corrupt')
        self.assertFalse((self.root/'corrupt').exists())
        self.s3.objects=copy.deepcopy(original);del self.s3.objects[key]
        with self.assertRaises(backup.BackupError): self.restore(summary,'missing')
        self.s3.objects=copy.deepcopy(original)
        bad=copy.deepcopy(self.prepared);bad['objects'][0]['identity']='0'*64;bad['planDigest']=backup.plan_digest(bad)
        with self.assertRaises(backup.ValidationError): backup.validate_plan(bad,require_prepared=True)
        bad=copy.deepcopy(self.plan);bad['objects'][0]['httpMetadata']['ContentType']='image/jpeg';bad['planDigest']=backup.plan_digest(bad)
        with self.assertRaises(backup.ValidationError): backup.validate_plan(bad)
        (self.cache/self.prepared['objects'][0]['cacheFile']).write_bytes(b'altered')
        with self.assertRaises(backup.ValidationError): self.apply('altered-work')
        # Valid encryption cannot hide an invalid mapping or summary.
        raw=self.root/'manifest.age';self.store.download(summary['manifestKey'],raw)
        plain=self.root/'manifest.json';self.age.decrypt(raw,self.identity,plain)
        manifest=json.loads(plain.read_text());manifest['objects'][1]=copy.deepcopy(manifest['objects'][0]);backup.safe_write_json(plain,manifest)
        raw.unlink();self.age.encrypt(plain,raw);body=raw.read_bytes();self.s3.objects[summary['manifestKey']]['body']=body
        self.s3.objects[summary['manifestChecksumKey']]['body']=(backup.sha256_bytes(body)+'\n').encode()
        with self.assertRaises(backup.ValidationError): self.restore(summary,'badmanifest',provider='supabase')
    def test_wrong_private_identity_and_valid_ciphertext_wrong_plaintext(self):
        summary=self.apply()
        keygen=os.environ.get('AGE_KEYGEN_PATH') or shutil.which('age-keygen')
        wrong=self.root/'wrong.agekey';subprocess.run([keygen,'-o',str(wrong)],check=True,capture_output=True)
        with self.assertRaises(backup.BackupError):
            backup.restore_snapshot(self.store,summary['manifestKey'],summary['manifestChecksumKey'],wrong,self.root/'wrong-identity',self.age)
        plain=self.root/'altered-source';plain.write_bytes(b'valid encryption but wrong original')
        cipher=self.root/'altered.age';self.age.encrypt(plain,cipher);body=cipher.read_bytes()
        manifest_age=self.root/'manifest-cipher';self.store.download(summary['manifestKey'],manifest_age)
        manifest_plain=self.root/'manifest-plain';self.age.decrypt(manifest_age,self.identity,manifest_plain)
        manifest=json.loads(manifest_plain.read_text());item=manifest['objects'][0]
        self.s3.objects[item['ciphertextKey']]['body']=body
        digest=backup.sha256_bytes(body);self.s3.objects[item['ciphertextChecksumKey']]['body']=(digest+'\n').encode()
        item['ciphertextSha256']=digest;item['ciphertextSize']=len(body)
        backup.safe_write_json(manifest_plain,manifest);manifest_age.unlink();self.age.encrypt(manifest_plain,manifest_age)
        body=manifest_age.read_bytes();self.s3.objects[summary['manifestKey']]['body']=body
        self.s3.objects[summary['manifestChecksumKey']]['body']=(backup.sha256_bytes(body)+'\n').encode()
        with self.assertRaises(backup.ValidationError): self.restore(summary,'altered-original')

    def test_partial_failure_resume_and_destination_actual_verification(self):
        self.s3.fail_after=1
        with self.assertRaises(backup.BackupError): self.apply()
        self.assertFalse(any(key.endswith('storage-manifest.json.age') for key in self.s3.objects))
        self.s3.fail_after=None;summary=self.apply();self.assertEqual(self.restore(summary)['objectCount'],2)
        cipher=self.prepared['objects'][0]['ciphertextKey'];self.s3.objects[cipher]['body']=b'bad'
        with self.assertRaises(backup.BackupError): self.apply()


if __name__=='__main__': unittest.main()
