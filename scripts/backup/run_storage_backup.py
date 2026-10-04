#!/usr/bin/env python3
"""Bounded multi-source capture. No source write and no production restore path."""
import argparse
import datetime as dt
import hashlib
import json
import os
import pathlib
import re
import shutil
import tempfile
import urllib.request
from storage_byte_backup import (AgeEncryptor, BackupError, BackupDiagnostics, ValidationError, boto3_store, source_from_env,
                                 make_plan, prepare_plan, apply_plan, safe_write_json, utc_now)


def nearest_database_backup(store, boundary, check_run):
    candidates, token, seen = [], None, set()
    pattern = re.compile(r'^daily/(\d{4}-\d\d-\d\dT\d\d-\d\d-\d\dZ)-(\d+)-(\d+)/locally-supabase-production-.*\.tar\.gz\.age$')
    while True:
        params={'Bucket':store.bucket,'Prefix':'daily/','MaxKeys':1000}
        if token: params['ContinuationToken']=token
        page=store.client.list_objects_v2(**params)
        for item in page.get('Contents',[]):
            match=pattern.fullmatch(item['Key'])
            if not match: continue
            captured=dt.datetime.strptime(match[1],'%Y-%m-%dT%H-%M-%SZ').replace(tzinfo=dt.timezone.utc)
            if captured <= boundary: candidates.append((captured,item['Key'],match[2],int(match[3])))
        if len(candidates)>10000: raise ValidationError('database association inventory ceiling exceeded')
        if not page.get('IsTruncated'): break
        token=page.get('NextContinuationToken')
        if not token or token in seen: raise ValidationError('database association pagination incomplete')
        seen.add(token)
    for captured,key,run_id,attempt in sorted(candidates,reverse=True):
        if not check_run(run_id,attempt): continue
        response=store.client.get_object(Bucket=store.bucket,Key=key+'.sha256')
        try: checksum=response['Body'].read(512).decode('ascii').split()[0]
        finally: response['Body'].close()
        if not re.fullmatch('[a-f0-9]{64}',checksum): raise ValidationError('database backup checksum invalid')
        head=store.head(key);store.verify_bytes(key,checksum,head['ContentLength'])
        backup_id=key.split('/')[1]
        return {'id':backup_id,'capturedAt':captured.isoformat().replace('+00:00','Z'),
                'ciphertextSha256':checksum,'workflowRunId':run_id,'runAttempt':attempt}
    raise ValidationError('no successful verified logical database backup at capture boundary')


def successful_database_run(run_id,attempt):
    token=os.environ.get('GITHUB_TOKEN','')
    if not token: raise ValidationError('database association requires read-only GitHub run evidence')
    request=urllib.request.Request('https://api.github.com/repos/hyungeunseanson/locally-web/actions/runs/'+run_id,
        headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','User-Agent':'locally-storage-backup'})
    with urllib.request.urlopen(request,timeout=30) as response: run=json.load(response)
    return run.get('conclusion')=='success' and run.get('run_attempt')==attempt and run.get('path')=='.github/workflows/supabase-r2-backup.yml' and run.get('head_branch')=='main'


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--summary',required=True,type=pathlib.Path)
    args=parser.parse_args(argv)
    diagnostics=BackupDiagnostics(args.summary)
    root=None
    evidence={}
    try:
        diagnostics.at('configuration','none','validate')
        root=pathlib.Path(tempfile.mkdtemp(prefix='locally-authoritative-storage-' + os.environ.get('GITHUB_RUN_ID','operator') + '-', dir=os.environ.get('RUNNER_TEMP')))
        os.chmod(root,0o700)
        source_args=argparse.Namespace(project_url='https://uhinvcydgzqlpnvieyal.supabase.co',timeout=30,multi_source=True,diagnostics=diagnostics)
        source=source_from_env(source_args);store=boto3_store()
        boundary=dt.datetime.now(dt.timezone.utc)
        diagnostics.at('database_backup_association','r2','associate')
        db=nearest_database_backup(store,boundary,successful_database_run)
        evidence['databaseBackupEvidence']=db
        run=os.environ.get('GITHUB_RUN_ID','operator');attempt=os.environ.get('GITHUB_RUN_ATTEMPT','1')
        snapshot=boundary.strftime('%Y-%m-%dT%H-%M-%SZ')+'-storage-'+run+'-'+attempt
        evidence['snapshotId']=snapshot
        diagnostics.at('source_inventory_supabase','supabase','inventory')
        entries=source.inventory();plan=make_plan(entries,snapshot,db['id'],db['capturedAt'],boundary.isoformat().replace('+00:00','Z'))
        evidence.update(objectCount=len(entries),sourceBytes=sum(e['size'] for e in entries))
        safe_write_json(root/'plan.json',plan)
        prepared,budget=prepare_plan(plan,source,root/'cache',diagnostics=diagnostics);safe_write_json(root/'prepared.json',prepared)
        if args.apply:
            summary,_=apply_plan(prepared,prepared['planDigest'],source,store,AgeEncryptor(os.environ.get('AGE_RECIPIENT')),root/'cache',root/'ciphertext',diagnostics=diagnostics)
        else:
            summary={'status':'dry-run-byte-prepared','snapshotId':snapshot,'objectCount':len(entries),
                     'sourceBytes':sum(e['size'] for e in entries),'planDigest':prepared['planDigest'],'providers':sorted({e['provider'] for e in entries}),
                     'backupDestinationWrites':0,'budget':budget.as_dict()}
        summary['sourcePreparationBudget']=budget.as_dict()
        summary['databaseBackupEvidence']=db
        summary['sourceWrites']=0;summary['sourceDeletes']=0
        summary['restoreProof']='offline-private-identity-required'
        summary.update(diagnostics.summary(summary['status'],'capture_complete'))
        safe_write_json(args.summary,summary);print(json.dumps(summary,sort_keys=True))
        return 0
    except Exception as error:
        summary=diagnostics.summary('failed',error.code if isinstance(error,BackupError) else 'storage_backup_operator_failed')
        summary.update(evidence)
        safe_write_json(args.summary,summary);print(json.dumps(summary,sort_keys=True))
        return 1
    finally:
        if root: shutil.rmtree(root,ignore_errors=True)


if __name__=='__main__':
    raise SystemExit(main())
