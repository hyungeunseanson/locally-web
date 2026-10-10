import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const hash = (s,algorithm='sha256') => createHash(algorithm).update(s).digest('hex');
// PHASE 2 extends three payment entrypoints. Keep their reviewed bytes pinned here;
// installed PHASE 1 SQL, targeted helpers, and the negative ACL controls remain pinned below.
const originals = [
  {
    "path": "app/api/payment/cardNotificationHandler.ts",
    "sha256": "25c0ef4acf466a9268c5be4cffadd2acc881d2adaf8c8c14da9429138128500d"
  },
  {
    "path": "app/api/payment/experienceCardConfirmation.ts",
    "sha256": "9aca54612b9ede006bfa44bce8933bc1fc2051e698447bc49f932a92c6a09b95"
  },
  {
    "path": "app/utils/opsAnomalyMonitor/checks.ts",
    "sha256": "fc01c2be6808bbcadb6975663211a2c1df026e717c56d8698330f1c8bf50d00f"
  },
  {
    "path": "app/utils/opsAnomalyMonitor/config.ts",
    "sha256": "84536bf5616cd378c0490c1a3d8f92ada3955d11fc56fa36be08512d34a6d25b"
  },
  {
    "path": "app/utils/opsAnomalyMonitor/runOpsAnomalyMonitor.ts",
    "sha256": "54bd196914bc60975a6d68d8fb693f07f1afcc7783a7634fc1a4f1f1aed84de0"
  },
  {
    "path": "app/utils/opsAnomalyMonitor/types.ts",
    "sha256": "2ddad0a7f2910f58f3ee1de6cac7048d4c14fc45e947ce6acbe7150624277a41"
  },
  {
    "path": "app/utils/payments/card/server.ts",
    "sha256": "4aabf43f91cb75fbec23eb964fd99d7451c9276f335a70584e80e7ebc194ddf7"
  },
  {
    "path": "app/utils/payments/card/targetedCloseoutTargets.ts",
    "sha256": "657345cf33a467a1905f213511e3cbf3d31d2ba6542b35964fcd0ef78463b944"
  },
  {
    "path": "app/utils/payments/card/targetedNicePayCloseout.ts",
    "sha256": "6c29d135310e3b51b8c95d85e7e47b3cf628424c75db9389ec23db9f90fd7aaf"
  }
];
const sourceHashes = {
  'docs/financial/installed/20261009035059_targeted_nicepay_ab_closeout.sql':'be1df53834cda17b362d7f24a01b035ec1c5c00c5cb5ff278c2ef8287e93fb90',
  'docs/financial/phase1-installed-v2-review.sql':'573bf194564b6c00bb2f57eb0494aaed298be59fc01276a975fc0653f3925f38',
};
const catalog=JSON.parse(await readFile('docs/financial/phase1-installed-catalog.json','utf8'));
function checkACL(f) {
  assert.equal(f.owner,'postgres'); assert.equal(f.security_definer,true);
  assert.deepEqual(f.proconfig,['search_path=""']);
  assert.equal(f.anon_execute,false); assert.equal(f.authenticated_execute,false);
  assert.equal(f.service_role_execute,f.schema_name==='public');
}
function checkSource(path,body) { assert.equal(hash(body),sourceHashes[path]); }
test('application protection source matches the completed operating tree exactly',async()=>{
  assert.equal(originals.length,9);
  for(const f of originals) assert.equal(hash(await readFile(f.path)),f.sha256,f.path);
});
test('already installed S and V2 are exact archives, not automatic migration replay',async()=>{
  for(const [p,sha] of Object.entries(sourceHashes)) {
    const bytes=await readFile(p); assert.equal(hash(bytes),sha); checkSource(p,bytes);
  }
  await assert.rejects(access('supabase/migrations/20261009035059_targeted_nicepay_ab_closeout.sql'));
  const v2=await readFile('docs/financial/phase1-installed-v2-review.sql','utf8');
  assert.match(v2,/REVIEW_ONLY_NO_PRODUCTION_AUTHORIZATION/); assert.match(v2,/ROLLBACK;/);
});
test('all fourteen installed function bodies and privilege boundaries match archives',async()=>{
  const functions=new Map();
  for(const p of Object.keys(sourceHashes)) {
    const sql=await readFile(p,'utf8');
    for(const m of sql.matchAll(/^CREATE(?: OR REPLACE)? FUNCTION\s+(\w+)\.(\w+)\([\s\S]*?\bAS\s+(\$\w*\$)([\s\S]*?)\3/gmi)) functions.set(m[1]+'.'+m[2],hash(m[4],'md5'));
  }
  assert.equal(catalog.functions.length,14); assert.equal(functions.size,14);
  for(const f of catalog.functions) { assert.equal(functions.get(f.schema_name+'.'+f.function_name),f.body_md5);checkACL(f); }
  assert.equal(catalog.functions.find(f=>f.function_name==='close_targeted_card_attempts_risk_acceptance_v2_atomic').body_md5,'cba8814a2cf017d66deafa7bd58da445');
});
test('handoff ledger records S as applied and V2 as a separately installed operation',()=>{
  assert.equal(catalog.migrationLedger.length,29);
  assert.deepEqual(catalog.migrationLedger.at(-1),{version:'20261009035059',name:'targeted_nicepay_ab_closeout'});
  assert.equal(catalog.migrationLedger.filter(m=>/risk_acceptance_v2/.test(m.name)).length,0);
});
test('negative controls reject modified archive bytes and public/authenticated execution',async()=>{
  const p=Object.keys(sourceHashes)[0]; assert.throws(()=>checkSource(p,'changed unsafe SQL'));
  const f=catalog.functions.find(f=>f.schema_name==='public');
  for(const bad of [{anon_execute:true},{authenticated_execute:true},{proconfig:['search_path=public']},{security_definer:false},{service_role_execute:false}]) assert.throws(()=>checkACL({...f,...bad}));
  assert.ok((await readFile(p)).length>0);
});
