import {createHash,randomUUID} from 'node:crypto';
import {COMMUNITY_BUCKET,COMMUNITY_BASE_URL,COMMUNITY_MAX_BYTES,communityKey,communityMime,legacyCommunityKey} from '../../app/utils/communityMediaContract.mjs';
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const communityDigest=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const byteSha=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Error('community_'+code)};
export function selectCommunitySources(inventory){
 if(inventory?.bucketPublic!==true||!Array.isArray(inventory.objects)||!Array.isArray(inventory.posts)||inventory.objects.length>1000||inventory.posts.length>10000)fail('inventory_invalid');
 const objects=new Map(),groups=new Map(),parents=new Set();
 for(const o of inventory.objects){if(objects.has(o.key)||!o.key?.startsWith('community/')||!Number.isSafeInteger(o.size)||o.size<0)fail('object_invalid');objects.set(o.key,o);}
 for(const p of inventory.posts){if(parents.has(p.id)||!Array.isArray(p.images)||p.images.length>100||!Number.isSafeInteger(p.revision)||p.revision<0)fail('post_invalid');parents.add(p.id);
  for(const [position,url] of p.images.entries()){
   const key=legacyCommunityKey(url);if(key===null)continue;const source=objects.get(key);if(!source)fail('source_missing');if(source.owner!==p.owner)fail('owner_mismatch');if(!source.size)fail('source_empty');
   if(!groups.has(key))groups.set(key,{ownerId:p.owner,oldUrl:url,source,references:[]});const item=groups.get(key);if(item.ownerId!==p.owner)fail('cross_owner_reference');item.references.push({postId:p.id,position});
  }
 }
 const entries=[...groups.values()].sort((a,b)=>a.source.key.localeCompare(b.source.key));
 if(entries.length>200||entries.reduce((n,e)=>n+e.source.size,0)>128*1024*1024||new Set(entries.flatMap(e=>e.references.map(r=>r.postId))).size>500)fail('source_bounds');
 for(const e of entries){if(e.source.size>COMMUNITY_MAX_BYTES)fail('source_bounds');communityMime(e.source.mime);e.references.sort((a,b)=>a.postId.localeCompare(b.postId)||a.position-b.position);}
 return {entries,unreferenced:objects.size-groups.size};
}
export async function planCommunityMigration(inventory,readSource,validateImage){
 const selected=selectCommunitySources(inventory),entries=[];
 for(const item of selected.entries){const bytes=await readSource(item);if(bytes.length!==item.source.size)fail('size_mismatch');if(await validateImage(bytes,item.source.mime)!==item.source.mime)fail('mime_mismatch');const sha256=byteSha(bytes),assetId=randomUUID(),key=communityKey(item.ownerId,assetId);entries.push({...item,sha256,assetId,key,bucket:COMMUNITY_BUCKET,newUrl:COMMUNITY_BASE_URL+'/'+key,idempotencyKey:communityDigest({scope:'community-migration-v1',assetId})});}
 const mappings=new Map(entries.map(e=>[e.oldUrl,e.newUrl])),postIds=new Set(entries.flatMap(e=>e.references.map(r=>r.postId)));
 const posts=inventory.posts.filter(p=>postIds.has(p.id)).map(p=>({id:p.id,owner:p.owner,revision:p.revision,oldImages:p.images,newImages:p.images.map(u=>mappings.get(u)??u)})).sort((a,b)=>a.id.localeCompare(b.id));
 const payload={schema:'community-source-migration-v1',inventoryDigest:communityDigest(inventory),legacy_unreferenced_retained:selected.unreferenced,entries,posts};return {...payload,planDigest:communityDigest(payload)};
}
export function validateCommunityPlan(plan,digest){
 const {planDigest,...payload}=plan??{};
 if(plan?.schema!=='community-source-migration-v1'||!Array.isArray(plan.entries)||!plan.entries.length||plan.entries.length>200||!Array.isArray(plan.posts)||!plan.posts.length||plan.posts.length>500||!/^([a-f0-9]{64})$/.test(digest??'')||planDigest!==digest||communityDigest(payload)!==digest)fail('plan_digest_invalid');
 const urls=new Map(),ids=new Set(),keys=new Set();let bytes=0;
 for(const e of plan.entries){if(keys.has(e.source?.key)||ids.has(e.assetId)||legacyCommunityKey(e.oldUrl)!==e.source.key||e.source.owner!==e.ownerId||e.key!==communityKey(e.ownerId,e.assetId)||e.bucket!==COMMUNITY_BUCKET||e.newUrl!==COMMUNITY_BASE_URL+'/'+e.key||!Number.isSafeInteger(e.source.size)||e.source.size<=0||e.source.size>COMMUNITY_MAX_BYTES||!/^[a-f0-9]{64}$/.test(e.sha256)||e.idempotencyKey!==communityDigest({scope:'community-migration-v1',assetId:e.assetId})||!Array.isArray(e.references)||!e.references.length)fail('plan_identity_invalid');communityMime(e.source.mime);ids.add(e.assetId);keys.add(e.source.key);urls.set(e.oldUrl,e.newUrl);bytes+=e.source.size;}
 if(bytes>128*1024*1024)fail('source_bounds');const parents=new Set();
 for(const p of plan.posts){if(parents.has(p.id)||!Number.isSafeInteger(p.revision)||p.revision<0||!Array.isArray(p.oldImages)||p.oldImages.length>100||communityDigest(p.oldImages.map(u=>urls.get(u)??u))!==communityDigest(p.newImages)||communityDigest(p.oldImages)===communityDigest(p.newImages))fail('post_plan_invalid');parents.add(p.id);}
 for(const e of plan.entries){const refs=plan.posts.flatMap(p=>p.oldImages.flatMap((u,position)=>u===e.oldUrl?[{postId:p.id,position}]:[])).sort((a,b)=>a.postId.localeCompare(b.postId)||a.position-b.position);if(communityDigest(refs)!==communityDigest(e.references)||plan.posts.some(p=>p.oldImages.includes(e.oldUrl)&&p.owner!==e.ownerId))fail('plan_reference_invalid');}
 return plan;
}
export function communitySqlPayload(plan){return {p_plan_digest:plan.planDigest,p_assets:plan.entries.map(e=>({id:e.assetId,owner:e.ownerId,sourceKey:e.source.key,oldUrl:e.oldUrl,newUrl:e.newUrl,sha256:e.sha256,size:e.source.size,mime:e.source.mime,version:e.source.version,updatedAt:e.source.updatedAt})),p_posts:plan.posts};}
export function assertCommunityCurrent(plan,inventory,mode){
 if(inventory.legacyWritesFrozen!==true)fail('legacy_writer_not_frozen');const selected=selectCommunitySources(inventory),approvedSources=new Set(plan.entries.map(e=>e.source.key));if(selected.entries.some(e=>!approvedSources.has(e.source.key)))fail('unplanned_live_source');
 let phase;
 for(const p of plan.posts){const current=inventory.posts.find(r=>r.id===p.id);if(!current||current.owner!==p.owner)fail('parent_drift');const match=communityDigest(current.images);let currentPhase;
  if(match===communityDigest(p.oldImages)&&current.revision===p.revision)currentPhase='old';
  else if(match===communityDigest(p.newImages)&&current.revision===p.revision+1)currentPhase='applied';
  else if(mode==='rollback'&&match===communityDigest(p.oldImages)&&current.revision===p.revision+2)currentPhase='rolled_back';else fail('newer_edit_conflict');
  if(phase&&phase!==currentPhase)fail('partial_image_set');phase=currentPhase;
 }
 if(mode==='rollback'&&phase==='old')fail('rollback_receipt_required');
 for(const e of plan.entries){if(communityDigest(inventory.objects.find(o=>o.key===e.source.key))!==communityDigest(e.source))fail('source_metadata_drift');const refs=inventory.posts.flatMap(p=>p.images.flatMap((u,position)=>(u===e.oldUrl||u===e.newUrl)?[{postId:p.id,position}]:[])).sort((a,b)=>a.postId.localeCompare(b.postId)||a.position-b.position);if(communityDigest(refs)!==communityDigest(e.references))fail('reference_set_drift');}
 return phase;
}
export async function executeCommunityPlan(plan,digest,deps,mode){
 validateCommunityPlan(plan,digest);if(!['prepare','apply','rollback'].includes(mode))fail('mode_invalid');
 const progress={mode,objects:plan.entries.length,prepared:0,applied:0,rolledBack:0,resumed:0,sourceWrites:0,sourceDeletes:0,physicalDeletes:0};
 assertCommunityCurrent(plan,await deps.inventory(),mode);
 for(const item of plan.entries){const bytes=await deps.readSource(item);if(bytes.length!==item.source.size||byteSha(bytes)!==item.sha256||await deps.validateImage(bytes,item.source.mime)!==item.source.mime)fail('source_byte_drift');
  if(mode!=='rollback'){const asset=await deps.prepare(item,bytes);if(asset.id!==item.assetId||asset.public_url!==item.newUrl)fail('prepared_identity_mismatch');progress.prepared++;}await deps.record({...progress,currentAssetId:item.assetId,currentStage:'byte-verified'});
 }
 const phase=assertCommunityCurrent(plan,await deps.inventory(),mode);
 // Reread every source immediately before the single transactional whole-plan CAS.
 for(const item of plan.entries){const bytes=await deps.readSource(item);if(bytes.length!==item.source.size||byteSha(bytes)!==item.sha256)fail('source_byte_drift');}
 if(mode!=='prepare'){await deps.cas(communitySqlPayload(plan),mode==='rollback');if(mode==='rollback'){progress.rolledBack=phase==='applied'?plan.posts.length:0;progress.resumed=phase==='rolled_back'?plan.posts.length:0;}else{progress.applied=phase==='old'?plan.posts.length:0;progress.resumed=phase==='applied'?plan.posts.length:0;}await deps.verify(plan,mode);}
 await deps.record(progress);return progress;
}
