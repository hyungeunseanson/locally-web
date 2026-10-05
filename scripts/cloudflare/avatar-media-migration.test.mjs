import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { SUPABASE_AVATAR_BASE } from '../../app/utils/avatarMediaContract.mjs';
import { avatarOperatorBinding } from './avatar-media-operator.mjs';
import { prepareAvatarCutoverConfig } from './prepare-avatar-cutover-config.mjs';
import { selectLiveAvatars, planAvatarMigration, validateAvatarPlan, executeAvatarPlan, rollbackAvatarPlan } from './avatar-media-migration.mjs';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const bytes=new Uint8Array([0xff,0xd8,0xff,1]);
const inventory=()=>({bucketPublic:true,profiles:[{id:owner,avatar_url:SUPABASE_AVATAR_BASE+'wrong-prefix/live.jpg'},{id:other,avatar_url:'https://lh3.googleusercontent.com/oauth'}],objects:[{key:'wrong-prefix/live.jpg',ownerId:owner,size:4,mime:'image/jpeg',version:'v1',updatedAt:'fixed'},{key:'orphan.jpg',ownerId:other,size:5,mime:'image/jpeg',version:'v1',updatedAt:'fixed'}]});
const validate=(payload,mime)=>{assert.equal(payload[0],0xff);return mime;};
const plan=()=>planAvatarMigration(inventory(),async()=>bytes,validate);
test('selection trusts storage owner_id, tolerates prefix mismatch, excludes external URLs and retains orphans',()=>{
  const result=selectLiveAvatars(inventory());assert.equal(result.selected.length,1);assert.equal(result.selected[0].ownerId,owner);assert.equal(result.legacy_unreferenced_retained,1);assert.equal(result.unreferencedBytes,5);
  const bad=inventory();bad.objects[0].ownerId=other;assert.throws(()=>selectLiveAvatars(bad));bad.objects=[];assert.throws(()=>selectLiveAvatars(bad));
});
test('strict legacy locator selection rejects aliases/query/traversal, wrong bucket stays outside scope',()=>{
  for(const url of [SUPABASE_AVATAR_BASE+'wrong-prefix/live.jpg?x=1',SUPABASE_AVATAR_BASE+'../live.jpg',SUPABASE_AVATAR_BASE+'%2e%2e/live.jpg']){const i=inventory();i.profiles[0].avatar_url=url;assert.throws(()=>selectLiveAvatars(i));}
  const i=inventory();i.profiles[0].avatar_url=i.profiles[0].avatar_url.replace('/avatars/','/images/');assert.equal(selectLiveAvatars(i).selected.length,0);
});
test('payload plan is deterministic/digest-bound with exact old locator and zero mutation adapters',async()=>{
  let reads=0;const a=await planAvatarMigration(inventory(),async()=>{reads++;return bytes;},validate),b=await plan();
  assert.deepEqual(a,b);assert.equal(reads,1);assert.equal(a.sourceWrites,0);assert.equal(a.sourceDeletes,0);assert.equal(a.entries[0].sha256,createHash('sha256').update(bytes).digest('hex'));assert.equal(a.entries[0].oldUrl,inventory().profiles[0].avatar_url);
  validateAvatarPlan(a,a.planDigest);assert.throws(()=>validateAvatarPlan(a,'0'.repeat(64)));const edited=structuredClone(a);edited.entries[0].newUrl='bad';assert.throws(()=>validateAvatarPlan(edited,a.planDigest));
});
test('bounded migration rejects >100 live rows and >128MiB before payload reads',()=>{
  const i=inventory();i.profiles=[];i.objects=[];
  for(let n=0;n<101;n++){const id=crypto.randomUUID(),key=`legacy/${n}.jpg`;i.profiles.push({id,avatar_url:SUPABASE_AVATAR_BASE+key});i.objects.push({key,ownerId:id,size:4,mime:'image/jpeg'});}
  assert.throws(()=>selectLiveAvatars(i));i.profiles.pop();i.objects.pop();for(const object of i.objects)object.size=10*1024*1024;assert.throws(()=>selectLiveAvatars(i));
});
function deps(plan,failure){
  const current=inventory(),events=[],asset={id:plan.entries[0].assetId,public_url:plan.entries[0].newUrl,state:'pending',verified_at:'fixed'};
  return {current,events,asset,inventory:async()=>structuredClone(current),readSource:async()=>failure==='bytes'?new Uint8Array([0xff,0xd8,0xff,9]):bytes,validateImage:validate,record:async summary=>events.push({...summary}),
    prepare:async()=>{events.push('prepare');if(failure==='race')current.profiles[0].avatar_url='https://example.org/newer';return asset;},
    commit:async()=>{events.push('commit');if(failure==='cas')throw new Error('conflict');asset.state='committed';current.profiles[0].avatar_url=asset.public_url;},verifyCommitted:async()=>{events.push('verify');assert.equal(current.profiles[0].avatar_url,asset.public_url);assert.equal(asset.state,'committed');},
    rollback:async()=>{events.push('rollback');current.profiles[0].avatar_url=plan.entries[0].oldUrl;asset.state='tombstoned';}};
}
test('prepare registers/copies/verifies only; apply CAS commits and verifies same deterministic asset',async()=>{
  const p=await plan(),d=deps(p);const prepared=await executeAvatarPlan(p,p.planDigest,d,'prepare');assert.equal(prepared.prepared,1);assert.equal(prepared.committed,0);assert(!d.events.includes('commit'));assert.equal(d.current.profiles[0].avatar_url,p.entries[0].oldUrl);
  const result=await executeAvatarPlan(p,p.planDigest,d,'apply');assert.equal(result.committed,1);assert.equal(result.verified,1);assert.equal(result.sourceWrites,0);assert.equal(result.sourceDeletes,0);assert.equal(result.remoteDeletes,0);
});
test('owner/metadata/locator/byte drift fails closed; no user overwrite or source delete',async()=>{
  const p=await plan();for(const field of ['ownerId','size','version']){const d=deps(p);d.current.objects[0][field]='drift';await assert.rejects(executeAvatarPlan(p,p.planDigest,d,'prepare'));assert(!d.events.includes('prepare'));}
  for(const failure of ['bytes','race','cas']){const d=deps(p,failure);await assert.rejects(executeAvatarPlan(p,p.planDigest,d,'apply'));assert.equal(d.asset.state,'pending');if(failure==='race')assert.equal(d.current.profiles[0].avatar_url,'https://example.org/newer');}
});
test('digest mismatch stops before inventory, prepare or CAS',async()=>{
  const p=await plan();let calls=0;await assert.rejects(executeAvatarPlan(p,'wrong',{inventory:async()=>{calls++;}}));assert.equal(calls,0);
});
test('rollback is digest-bound exact new -> old CAS; newer user avatar remains untouched',async()=>{
  const p=await plan(),d=deps(p);await executeAvatarPlan(p,p.planDigest,d,'apply');assert.equal((await rollbackAvatarPlan(p,p.planDigest,d)).rolledBack,1);assert.equal(d.current.profiles[0].avatar_url,p.entries[0].oldUrl);
  d.current.profiles[0].avatar_url='https://example.org/newer';await assert.rejects(rollbackAvatarPlan(p,p.planDigest,d));assert.equal(d.current.profiles[0].avatar_url,'https://example.org/newer');await assert.rejects(rollbackAvatarPlan(p,'wrong',d));
});
test('dedicated S3 adapter always sends If-None-Match; 409/412 return conflict for exact caller reconciliation',async()=>{
  const p=await plan(),item=p.entries[0];const operations=[];
  const env={R2_ENDPOINT:'https://'+'a'.repeat(32)+'.r2.cloudflarestorage.com',AVATAR_R2_ACCESS_KEY_ID:'fixture',AVATAR_R2_SECRET_ACCESS_KEY:'fixture'};
  for(const status of [200,409,412]){
    const binding=avatarOperatorBinding(env,async request=>{operations.push(request.method);assert.equal(request.headers.get('if-none-match'),'*');assert(new URL(request.url).pathname.startsWith('/locally-public-avatars/'));return new Response('',{status});});
    const result=await binding.put(item.key,bytes,{onlyIf:{etagDoesNotMatch:'*'},sha256:item.sha256,httpMetadata:{contentType:item.mime,cacheControl:'immutable'},customMetadata:{}});
    assert.equal(result===null,status!==200);assert(!('delete' in binding));assert(!('copy' in binding));
    await assert.rejects(binding.put(item.key,bytes,{onlyIf:{}}));
  }
  assert.deepEqual(operations,['PUT','PUT','PUT']);
});
test('offline cutover config adds only avatar binding/flag; Queue/Cron, other flags and settings unchanged',()=>{
  const base={keep_vars:true,env:{production:{name:'locally-web-opennext-production',vars:{EXPERIENCE_MEDIA_R2_SOURCE_ENABLED:'true'},r2_buckets:[{binding:'existing',bucket_name:'existing'}],queues:{consumers:[{queue:'existing'}]},triggers:{crons:['existing']}}}};
  const next=prepareAvatarCutoverConfig(base);assert.equal(next.env.production.vars.AVATAR_R2_SOURCE_ENABLED,'false');assert.deepEqual(next.env.production.queues,base.env.production.queues);assert.deepEqual(next.env.production.triggers,base.env.production.triggers);
  assert.equal(prepareAvatarCutoverConfig(next,'true').env.production.r2_buckets.length,2);
  const bad=structuredClone(base);bad.env.production.r2_buckets.push({binding:'PUBLIC_AVATAR_R2',bucket_name:'backup'});assert.throws(()=>prepareAvatarCutoverConfig(bad));assert.throws(()=>prepareAvatarCutoverConfig(base,'typo'));
});
