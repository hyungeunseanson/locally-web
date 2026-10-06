import { createHash } from 'node:crypto';
import { HOST_PROFILE_BASE_URL, HOST_PROFILE_BUCKET, HOST_PROFILE_MAX_BYTES, legacyHostProfileKey, hostProfileKey, hostProfileMime } from '../../app/utils/hostProfileMediaContract.mjs';
const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v==='object' ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])) : v;
export const hostProfileDigest = v => createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const hashBytes = b => createHash('sha256').update(b).digest('hex');
const fail = code => {throw Error('host_profile_'+code);};
function deterministicId(value) {const b=Buffer.from(hostProfileDigest(value).slice(0,32),'hex');b[6]=(b[6]&15)|80;b[8]=(b[8]&63)|128;const h=b.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
export function selectHostProfileSources(inventory) {
 if(inventory.bucketPublic!==true||!Array.isArray(inventory.references)||!Array.isArray(inventory.objects)||inventory.objects.length>1000)fail('inventory_invalid');
 for(const kind of ['host_application','profile_legacy_host','auth_legacy_host'])if(inventory.references.filter(r=>r.kind===kind).length>5000)fail('inventory_bounds');
 const objects=new Map(),groups=new Map(),parents=new Set();
 for(const o of inventory.objects){if(objects.has(o.key)||!/^profile\/[a-f0-9-]{36}_[0-9]+$/.test(o.key)||!Number.isSafeInteger(o.size)||o.size<0)fail('object_invalid');objects.set(o.key,o);}
 for(const r of inventory.references){
  if(!['host_application','profile_legacy_host','auth_legacy_host'].includes(r.kind)||parents.has(r.kind+':'+r.id))fail('duplicate_parent');parents.add(r.kind+':'+r.id);
  const key=legacyHostProfileKey(r.locator);if(key===null)continue;
  const object=objects.get(key);if(!object)fail('source_missing');if(object.size===0)fail('source_empty');
  if(object.owner!==r.owner||key.split('/')[1].split('_')[0]!==r.owner||(['profile_legacy_host','auth_legacy_host'].includes(r.kind)&&r.id!==r.owner))fail('owner_mismatch');
  if(!groups.has(key))groups.set(key,{ownerId:r.owner,oldUrl:r.locator,source:object,references:[]});
  const group=groups.get(key);if(group.ownerId!==r.owner)fail('shared_owner_mismatch');if(r.kind==='auth_legacy_host' && (!/^[a-f0-9]{64}$/.test(r.metadataDigest||'') || (!inventory.references.some(p=>p.kind==='profile_legacy_host'&&p.owner===r.owner&&p.locator===r.locator)||!inventory.references.some(p=>p.kind==='host_application'&&p.owner===r.owner&&p.locator===r.locator))))fail('auth_public_disagreement');group.references.push({kind:r.kind,id:r.id,...(r.kind==='auth_legacy_host'?{metadataDigest:r.metadataDigest}:{})});
 }
 const entries=[...groups.values()].sort((a,b)=>a.source.key.localeCompare(b.source.key));
 if(entries.length>200||entries.reduce((n,r)=>n+r.source.size,0)>128*1024*1024||entries.some(r=>r.source.size>HOST_PROFILE_MAX_BYTES||r.references.length>200))fail('source_bounds');
 for(const r of entries){hostProfileMime(r.source.mime);r.references.sort((a,b)=>(a.kind+':'+a.id).localeCompare(b.kind+':'+b.id));}
 return {entries,unreferenced:inventory.objects.length-groups.size};
}
export async function planHostProfileMigration(inventory,readSource,validateImage) {
 const selected=selectHostProfileSources(inventory),entries=[];
 for(const item of selected.entries){const bytes=await readSource(item);if(bytes.length!==item.source.size)fail('size_mismatch');if(validateImage(bytes,item.source.mime)!==item.source.mime)fail('mime_mismatch');
  const sha256=hashBytes(bytes),assetId=deterministicId({owner:item.ownerId,source:item.source,sha256});const key=hostProfileKey(item.ownerId,assetId);
  entries.push({...item,sha256,assetId,key,bucket:HOST_PROFILE_BUCKET,newUrl:HOST_PROFILE_BASE_URL+'/'+key,idempotencyKey:hostProfileDigest({scope:'host-profile-migration-v1',assetId})});
 }
 const plan={schema:'host-profile-source-migration-v1',inventoryDigest:hostProfileDigest(inventory),legacy_unreferenced_retained:selected.unreferenced,entries};
 return {...plan,planDigest:hostProfileDigest(plan)};
}
export function validateHostProfilePlan(plan,digest) {
 const {planDigest,...payload}=plan??{};
 if(plan?.schema!=='host-profile-source-migration-v1'||!Array.isArray(plan.entries)||plan.entries.length>200||planDigest!==digest||hostProfileDigest(payload)!==digest)fail('plan_digest_invalid');
 const keys=new Set(),parents=new Set();let bytes=0;
 for(const e of plan.entries){
  if(keys.has(e.source?.key)||legacyHostProfileKey(e.oldUrl)!==e.source.key||e.source.owner!==e.ownerId||e.source.key.split('/')[1].split('_')[0]!==e.ownerId||e.assetId!==deterministicId({owner:e.ownerId,source:e.source,sha256:e.sha256})||e.key!==hostProfileKey(e.ownerId,e.assetId)||e.bucket!==HOST_PROFILE_BUCKET||e.newUrl!==HOST_PROFILE_BASE_URL+'/'+e.key||!Number.isSafeInteger(e.source.size)||e.source.size<=0||e.source.size>HOST_PROFILE_MAX_BYTES||!/^[a-f0-9]{64}$/.test(e.sha256)||e.idempotencyKey!==hostProfileDigest({scope:'host-profile-migration-v1',assetId:e.assetId})||!Array.isArray(e.references)||e.references.length<1||e.references.length>200)fail('plan_identity_invalid');
  hostProfileMime(e.source.mime);keys.add(e.source.key);bytes+=e.source.size;
  for(const r of e.references){const p=r.kind+':'+r.id;if(!['host_application','profile_legacy_host','auth_legacy_host'].includes(r.kind)||parents.has(p)||(['profile_legacy_host','auth_legacy_host'].includes(r.kind)&&r.id!==e.ownerId)||(r.kind==='auth_legacy_host'&&!/^[a-f0-9]{64}$/.test(r.metadataDigest||'')))fail('plan_parent_invalid');parents.add(p);}
 }
 if(bytes>128*1024*1024)fail('source_bounds');return plan;
}
export async function executeHostProfilePlan(plan,digest,deps,mode) {
 validateHostProfilePlan(plan,digest);if(!['prepare','apply','rollback'].includes(mode))fail('mode_invalid');
 const progress={mode,objects:plan.entries.length,prepared:0,applied:0,rolledBack:0,resumed:0,sourceWrites:0,sourceDeletes:0,physicalDeletes:0};
 for(const item of plan.entries){
  const inventory=await deps.inventory();if(inventory.legacyWritesFrozen!==true)fail('legacy_writer_not_frozen');selectHostProfileSources(inventory);
  const source=inventory.objects.find(o=>o.key===item.source.key);if(hostProfileDigest(source)!==hostProfileDigest(item.source))fail('source_metadata_drift');
  const current=item.references.map(r=>inventory.references.find(row=>row.kind===r.kind&&row.id===r.id));
  if(current.some(r=>!r||r.owner!==item.ownerId))fail('parent_drift');
  if(mode!=='rollback')for(const r of item.references.filter(r=>r.kind==='auth_legacy_host')){const row=current.find(p=>p.kind===r.kind&&p.id===r.id);if(row.locator===item.oldUrl&&row.metadataDigest!==r.metadataDigest)fail('auth_metadata_drift');}
  const allOld=current.every(r=>r.locator===item.oldUrl),allNew=current.every(r=>r.locator===item.newUrl);
  if(!allOld&&!allNew)fail('locator_drift');
  const actualRefs=inventory.references.filter(r=>r.locator===item.oldUrl||r.locator===item.newUrl).map(({kind,id})=>({kind,id})).sort((a,b)=>(a.kind+':'+a.id).localeCompare(b.kind+':'+b.id));
  if(hostProfileDigest(actualRefs)!==hostProfileDigest(item.references.map(({kind,id})=>({kind,id}))))fail('reference_set_drift');
  const bytes=await deps.readSource(item);if(bytes.length!==item.source.size||hashBytes(bytes)!==item.sha256||deps.validateImage(bytes,item.source.mime)!==item.source.mime)fail('source_byte_drift');
  await deps.record({...progress,currentAssetId:item.assetId,currentStage:'source-verified'});
  if(mode==='rollback') {
   if(allNew){await deps.cas(item,true);await deps.verifyRollback(item);progress.rolledBack++;}else{await deps.verifyRollback(item);progress.resumed++;}
  } else {
   const asset=await deps.prepare(item,bytes);if(asset.id!==item.assetId||asset.public_url!==item.newUrl)fail('prepared_identity_mismatch');progress.prepared++;await deps.record({...progress,currentAssetId:item.assetId,currentStage:'destination-verified'});
   // Recheck source/owners/references after the provider operation; CAS itself is atomic.
   const after=await deps.inventory();if(after.legacyWritesFrozen!==true)fail('legacy_writer_not_frozen');if(hostProfileDigest(after.objects.find(o=>o.key===item.source.key))!==hostProfileDigest(item.source))fail('source_metadata_drift');
   for(const r of item.references){const row=after.references.find(p=>p.kind===r.kind&&p.id===r.id);if(!row||row.owner!==item.ownerId||row.locator!==(allNew?item.newUrl:item.oldUrl))fail('locator_drift');if(r.kind==='auth_legacy_host'&&allOld&&row.metadataDigest!==r.metadataDigest)fail('auth_metadata_drift');}
   const reread=await deps.readSource(item);if(reread.length!==item.source.size||hashBytes(reread)!==item.sha256)fail('source_byte_drift');
   if(mode==='apply'){if(allOld){await deps.cas(item,false);progress.applied++;}else progress.resumed++;await deps.verifyCommitted(item);}else if(allNew)await deps.verifyCommitted(item);
  }
  await deps.record(progress);
 }
 return progress;
}
