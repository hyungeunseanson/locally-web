import subprocess,os,pathlib,json,hashlib,datetime,sys
root=pathlib.Path('.wrangler/f02-pr212-final-validation')
epoch=sys.argv[1];assert epoch.replace('-','').isalnum()
out=root/'evidence'/epoch;out.mkdir(exist_ok=False)
source=json.loads((root/'source.json').read_text())
prepath=root/'evidence'/source['officialPreflight'];pre=json.loads(prepath.read_text());assert pre['verdict']=='PASS' and pre['sourceMain']==source['main'] and pre['gateStatus']=='MERGED_MAIN_READONLY_VALIDATION'
assert subprocess.check_output(['git','rev-parse','HEAD']).decode().strip()==source['main']
assert subprocess.check_output(['git','rev-parse','origin/main']).decode().strip()==source['main']
assert not subprocess.check_output(['git','status','--porcelain','--untracked-files=no'])
assert all(hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()==h for p,h in pre['gateSourceSHA256'].items())
plans=[(category,mode,i) for category,mode,n in [('host-direct','baseline',5),('host-direct','candidate',5),('host-client','baseline',5),('host-client','candidate',5),('browser','baseline',5),('browser','candidate',10)] for i in range(1,n+1)]
assert len(plans)==35
fixture={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [root/'browser.mjs',root/'host-evidence.mjs',root/'recorder.mjs',root/'rsc-fixture.mjs',root/'asset-trace.mjs',root/'community-view-fixture.mjs',root/'epoch.py',root/'source.json',root/'candidate.json',root/'evidence/expected.json',root/'evidence/baseline-fixture-complete.json']}
prev='0'*64;records=[]
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def append(row):
 global prev
 row={'previous':prev,**row};canonical=json.dumps(row,sort_keys=True,separators=(',',':'));row['sha256']=hashlib.sha256(canonical.encode()).hexdigest();prev=row['sha256']
 with (out/'ledger.jsonl').open('a') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n');f.flush();os.fsync(f.fileno())
 return row
with (out/'plan.json').open('x') as f:json.dump({'epoch':epoch,'main':source['main'],'started':stamp(),'plans':plans,'fixture':fixture,'preflight':str(prepath),'preflightSHA256':hashlib.sha256(prepath.read_bytes()).hexdigest(),'gateSourceSHA256':pre['gateSourceSHA256'],'browserIdentity':pre['identity'],'candidateArtifactSHA256':source['artifact'],'promotionAuthorized':False,'retry':False},f,indent=2)
append({'event':'EPOCH_START','at':stamp(),'epoch':epoch,'main':source['main'],'fixture':fixture})
for seq,(category,mode,i) in enumerate(plans,1):
 assert all(hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()==h for p,h in fixture.items())
 label=f'{epoch}-{seq:02d}-{category}-{mode}-{i}'
 append({'event':'RUN_START','at':stamp(),'seq':seq,'label':label,'category':category,'mode':mode});print('START',seq,category,mode,flush=True)
 with (root/'internal'/f'{label}.log').open('x') as log:
  result=subprocess.run(['node',str(root/'browser.mjs'),category,mode,label],env=os.environ,stdout=log,stderr=subprocess.STDOUT)
 path=root/'evidence'/f'{label}.json'
 receipt=json.loads(path.read_text()) if path.exists() else {'verdict':'FAIL','error':{'code':'NO_RECEIPT'},'versionId':None}
 row={'seq':seq,'label':label,'category':category,'mode':mode,'at':stamp(),'versionId':receipt.get('versionId'),'exit':result.returncode,'verdict':receipt['verdict'],'error':receipt.get('error'),'activeFailures':receipt.get('unexplainedPreTeardownFailures'),'consoleErrors':receipt.get('consoleErrors'),'pageErrors':receipt.get('pageErrors'),'teardownCancels':receipt.get('postTeardownCancels'),'evidence':str(path),'evidenceSHA256':hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None}
 records.append(row);append({'event':'RUN_END',**row});print(json.dumps({k:row[k] for k in ['seq','category','mode','versionId','verdict','activeFailures','consoleErrors','pageErrors']}),flush=True)
 if result.returncode!=0 or receipt['verdict']!='PASS':break
valid=len(records)==35 and all(r['verdict']=='PASS' for r in records)
summary={'epoch':epoch,'verdict':'PASS' if valid else 'FAIL','runs':records,'baseline':sum(r['mode']=='baseline' for r in records),'candidate':sum(r['mode']=='candidate' for r in records),'completed':len(records),'main':source['main'],'fixture':fixture,'chain':prev,'finished':stamp(),'previousEpochPassesCarried':0,'promotion':0}
append({'event':'EPOCH_END','at':stamp(),'verdict':summary['verdict'],'completed':len(records)});summary['chain']=prev
with (out/'result.json').open('x') as f:json.dump(summary,f,indent=2)
print(json.dumps({'epoch':epoch,'verdict':summary['verdict'],'completed':len(records)}),flush=True)
sys.exit(0 if valid else 1)
