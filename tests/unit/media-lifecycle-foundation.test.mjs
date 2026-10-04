import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const temp = await mkdtemp(tmpdir() + '/locally-lifecycle-tests-');
await build({ entryPoints: ['app/utils/mediaLifecycle.ts','app/utils/communityImageCleanup.ts'], bundle: true, platform: 'node', format: 'esm', outdir: temp });
const media = await import(pathToFileURL(temp + '/mediaLifecycle.js'));
const community = await import(pathToFileURL(temp + '/communityImageCleanup.js'));
after(() => rm(temp,{recursive:true,force:true}));
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const bytes = new Uint8Array([0xff,0xd8,0xff,1,2]);
function fixture(failure) {
  const rows = new Map(), objects = new Map(), events = [];
  let pending, putCalls = 0;
  const registry = { async rpc(name,args) {
    events.push(name);
    if (failure === name) return {data:null,error:{code:'fixture'}};
    if (name === 'begin_experience_media_asset') {
      pending = rows.get(args.p_idempotency_key);
      if (!pending) {
        pending = { id:args.p_id, owner_id:args.p_owner_id, object_key:args.p_key, public_url:args.p_url, expected_sha256:args.p_sha256, expected_size:args.p_size, mime:args.p_mime, state:'pending' };
        rows.set(args.p_idempotency_key,pending);
      }
      if (failure === 'owner') return { data:{...pending,owner_id:other},error:null };
      return { data:pending, error:null };
    }
    return {data:pending,error:null};
  } };
  const binding = {
    async head(key) { if (failure === 'head') throw new Error('private provider details'); return objects.get(key) ?? null; },
    async put(key,value,options) {
      putCalls++;events.push('PUT');assert.deepEqual(options.onlyIf,{etagDoesNotMatch:'*'});
      if (failure === 'put' || failure === 'abort') throw new Error('private provider details');
      const object={size:value.length,httpMetadata:options.httpMetadata,customMetadata:options.customMetadata,arrayBuffer:async()=>value.slice().buffer};
      if (objects.has(key)) return null;
      objects.set(key,object);
      if (failure === 'concurrent') return null; // Another identical retry won the conditional create.
      return object;
    },
    async get(key) {
      const object=objects.get(key);
      if (failure === 'altered') return {...object,arrayBuffer:async()=>new Uint8Array([0xff,0xd8,0xff,9,9]).buffer};
      return object ?? null;
    },
  };
  const input={registry,binding,actorId:owner,ownerId:owner,folder:'hero',bytes,contentType:'image/jpeg',idempotencyKey:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'};
  return {input,rows,objects,events,putCalls:()=>putCalls};
}
test('pending precedes conditional PUT; retry returns same identity with one writer and actual-byte verification',async()=>{
  const f=fixture();const first=await media.uploadManagedExperienceMedia(f.input);const retry=await media.uploadManagedExperienceMedia(f.input);
  assert.deepEqual(first,retry);assert.equal(first.state,'pending');assert.equal(f.putCalls(),1);
  assert.equal(f.events[0],'begin_experience_media_asset');assert.match(first.publicUrl,/^https:\/\/media-canary\.locally-travel\.com\/sources\/v1\/experience\/[a-f0-9]{64}\//);
  assert.equal(f.rows.size,1);
});
test('concurrent identical conditional-create loser verifies winning bytes',async()=>{
  const f=fixture('concurrent');assert.equal((await media.uploadManagedExperienceMedia(f.input)).state,'pending');assert.equal(f.putCalls(),1);
});
test('PUT, HEAD, DB verification and abort failures keep traceable pending assets; no secondary writer',async()=>{
  for(const failure of ['put','head','verify_experience_media_asset','abort','altered']) {
    const f=fixture(failure);await assert.rejects(media.uploadManagedExperienceMedia(f.input),error=>error instanceof media.MediaLifecycleError && !error.message.includes('private'));
    assert.equal(f.rows.size,1);assert.equal([...f.rows.values()][0].state,'pending');
    assert(f.putCalls() <= 1);
  }
});
test('registry/ownership failure cannot PUT; mismatched idempotent payload cannot reuse an object',async()=>{
  for(const failure of ['begin_experience_media_asset','owner']) { const f=fixture(failure);await assert.rejects(media.uploadManagedExperienceMedia(f.input));assert.equal(f.putCalls(),0); }
  const f=fixture();await media.uploadManagedExperienceMedia(f.input);await assert.rejects(media.uploadManagedExperienceMedia({...f.input,bytes:new Uint8Array([0xff,0xd8,0xff,9])}),error=>error.status===409);assert.equal(f.putCalls(),1);
});
const owned='community/'+owner+'/fixture-1.png';
test('community ownership namespace, traversal, encoded-key, shared reference and DB failure are fail closed',async()=>{
  const removed=[];const deps={hasReferences:async()=>false,removeOwned:async paths=>removed.push(...paths)};
  assert.equal((await community.cleanupOwnedCommunityImages([owned],owner,deps)).status,'complete');assert.deepEqual(removed,[owned]);
  for(const path of ['community/'+other+'/a.png','community/'+owner+'/../a.png','community/'+owner+'/%2e%2e.png','avatars/'+owner+'/a.png','community/'+owner+'/a.png?token=bad','community/'+owner+'/a/b.png']) {
    assert.equal((await community.cleanupOwnedCommunityImages([path],owner,deps)).status,'denied');
  }
  assert.equal((await community.cleanupOwnedCommunityImages([owned],owner,{...deps,hasReferences:async()=>true})).status,'referenced');
  assert.equal((await community.cleanupOwnedCommunityImages([owned],owner,{...deps,hasReferences:async()=>{throw new Error('DB failed')}})).status,'blocked');
  assert.equal(removed.length,1);
});
const asset={assetId:'opaque',provider:'r2',state:'pending',lifecycleManaged:true,createdAt:'2026-10-01T00:00:00Z',backupPinned:false,migrationPinned:false,expectedSha256:await media.mediaByteSha(bytes),expectedSize:bytes.length};
function deletion(failure) {
  const events=[];let object=bytes,attempts=0,refs=0;
  const deps={journal:async(event,code)=>events.push([event,code]),referenceCount:async()=>refs,
    readBytes:async()=>object,deleteObject:async()=>{attempts++;if(failure==='delete')throw new Error('private');object=null;},
    purgePublicCache:async()=>{if(failure==='purge')throw new Error('private');}};
  return {deps,events,attempts:()=>attempts,setRefs:n=>refs=n,exists:()=>object!==null};
}
test('physical delete failure and purge failure remain retryable; completion follows object deletion and purge',async()=>{
  for(const failure of ['delete','purge']) {
    const f=deletion(failure);assert.equal((await media.executeManagedDeletion(asset,f.deps,{enabled:true,minimumAgeMs:1})).status,'failed');
    assert.equal(f.events.at(-1)[0],'failed');assert(!f.events.some(x=>x[0]==='complete'));
    f.deps.deleteObject=async()=>{};f.deps.purgePublicCache=async()=>{};
    assert.equal((await media.executeManagedDeletion(asset,f.deps,{enabled:true,minimumAgeMs:1})).status,'complete');
    assert.equal(f.events.at(-2)[0],'object-deleted');assert.equal(f.events.at(-1)[0],'complete');
  }
});
test('no references, pins, legacy objects or implicit age policy can authorize sweeping',async()=>{
  for(const changed of [{backupPinned:true},{migrationPinned:true},{lifecycleManaged:false},{state:'committed'}]) {
    const f=deletion();assert.equal((await media.executeManagedDeletion({...asset,...changed},f.deps,{enabled:true,minimumAgeMs:1})).status,'blocked');assert.equal(f.attempts(),0);
  }
  for(const policy of [{enabled:false},{enabled:true},{enabled:true,minimumAgeMs:NaN}]) { const f=deletion();assert.equal((await media.executeManagedDeletion(asset,f.deps,policy)).status,'blocked');assert.equal(f.attempts(),0); }
  const f=deletion();f.setRefs(1);assert.equal((await media.executeManagedDeletion(asset,f.deps,{enabled:true,minimumAgeMs:1})).code,'reference_exists');assert.equal(f.attempts(),0);
  const plan=await media.planManagedPendingAssets([asset,{...asset,lifecycleManaged:false}],async()=>0);
  assert.equal(plan.managedPending,1);assert.equal(plan.ageEligible,0);assert.equal(plan.physicalDeletionEnabled,false);
});
test('durable claim denial aborts before provider mutation; journal uses guarded SQL RPCs',async()=>{
  const f=deletion();const calls=[];
  const deps=media.durableMediaDeletionDependencies({rpc:async(name,args)=>{calls.push([name,args]);return {data:false,error:null};}},asset.assetId,f.deps,{enabled:true,minimumAgeMs:1});
  await assert.rejects(media.executeManagedDeletion(asset,deps,{enabled:true,minimumAgeMs:1}));assert.equal(f.attempts(),0);assert.equal(calls[0][0],'claim_media_deletion');
});
test('runtime integration retains R2 authority, guarded registry, user-session community remove and account journal before parent delete',async()=>{
  const upload=await readFile('app/api/host/experience-images/upload/route.ts','utf8');assert.match(upload,/uploadManagedExperienceMedia/);assert.match(upload,/MediaLifecycleError/);
  const cleanup=await readFile('app/api/community/posts/route.ts','utf8');assert.match(cleanup,/supabase\.storage\.from\('images'\)\.remove/);assert.doesNotMatch(cleanup,/supabaseAdmin\.storage.*remove/);
  const account=await readFile('app/api/admin/delete/route.ts','utf8');assert(account.indexOf('plan_media_owner_deletion')<account.indexOf("supabaseAdmin.from('host_applications').delete()"));
});
