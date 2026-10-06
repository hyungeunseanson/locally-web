#!/usr/bin/env node
import {readFile,open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {build} from 'esbuild';
import {AwsClient} from 'aws4fetch';
import {createClient} from '@supabase/supabase-js';
import {COMMUNITY_BUCKET,COMMUNITY_LEGACY_BASE,COMMUNITY_MAX_BYTES,communityMime} from '../../app/utils/communityMediaContract.mjs';
import {communityDigest,planCommunityMigration,validateCommunityPlan,executeCommunityPlan,assertCommunityCurrent} from './community-media-migration.mjs';
import {communityLocalDecoder} from './community-local-decoder.mjs';
const project='https://uhinvcydgzqlpnvieyal.supabase.co';
async function boundedBytes(response) {const reader=response.body?.getReader();if(!reader)throw Error('community_source_empty');const chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>COMMUNITY_MAX_BYTES)throw Error('community_byte_limit');chunks.push(value);}}finally{await reader.cancel();reader.releaseLock();}return new Uint8Array(Buffer.concat(chunks));}
/** Bucket-locked conditional writer; has no overwrite/delete/copy/multipart method. */
export function communityOperatorBinding(env,fetcher=fetch) {
 if(!/^https:\/\/[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(env.R2_ENDPOINT||'')||!env.COMMUNITY_R2_ACCESS_KEY_ID||!env.COMMUNITY_R2_SECRET_ACCESS_KEY)throw Error('community_operator_config');
 if(['AVATAR_R2_ACCESS_KEY_ID','R2_AVATAR_SOURCE_READ_ACCESS_KEY_ID','R2_SOURCE_ACCESS_KEY_ID','R2_SOURCE_READ_ACCESS_KEY_ID','R2_ACCESS_KEY_ID','AWS_ACCESS_KEY_ID','HOST_PROFILE_R2_ACCESS_KEY_ID','R2_HOST_PROFILE_SOURCE_READ_ACCESS_KEY_ID','R2_COMMUNITY_SOURCE_READ_ACCESS_KEY_ID'].some(name=>env[name]&&env[name]===env.COMMUNITY_R2_ACCESS_KEY_ID))throw Error('community_operator_credential_reused');
 if(['AVATAR_R2_SECRET_ACCESS_KEY','HOST_PROFILE_R2_SECRET_ACCESS_KEY','R2_AVATAR_SOURCE_READ_SECRET_ACCESS_KEY','R2_HOST_PROFILE_SOURCE_READ_SECRET_ACCESS_KEY','R2_COMMUNITY_SOURCE_READ_SECRET_ACCESS_KEY','R2_SOURCE_SECRET_ACCESS_KEY','R2_SECRET_ACCESS_KEY','AWS_SECRET_ACCESS_KEY'].some(name=>env[name]&&env[name]===env.COMMUNITY_R2_SECRET_ACCESS_KEY))throw Error('community_operator_credential_reused');
 const signer=new AwsClient({accessKeyId:env.COMMUNITY_R2_ACCESS_KEY_ID,secretAccessKey:env.COMMUNITY_R2_SECRET_ACCESS_KEY,service:'s3',region:'auto',retries:0});
 const metadata=r=>({size:Number(r.headers.get('content-length')),httpMetadata:{contentType:r.headers.get('content-type'),cacheControl:r.headers.get('cache-control'),contentDisposition:r.headers.get('content-disposition')},customMetadata:Object.fromEntries([...r.headers].filter(([k])=>k.startsWith('x-amz-meta-')).map(([k,v])=>[k.slice(11),v]))});
 async function request(method,key,headers={},body){if(!/^community\/v1\/[a-f0-9]{64}\/[a-f0-9-]{36}\/image$/.test(key))throw Error('community_key_invalid');const signed=await signer.sign(env.R2_ENDPOINT+'/'+COMMUNITY_BUCKET+'/'+key,{method,headers,body});return fetcher(signed,{redirect:'error',signal:AbortSignal.timeout(30000)});}
 return {
  async head(key){const r=await request('HEAD',key);if(r.status===404)return null;if(!r.ok)throw Error('community_destination_head');return metadata(r);},
  async get(key){const r=await request('GET',key);if(r.status===404){await r.body?.cancel();return null;}if(!r.ok){await r.body?.cancel();throw Error('community_destination_get');}const bytes=await boundedBytes(r);return {...metadata(r),arrayBuffer:async()=>bytes.slice().buffer};},
  async put(key,bytes,options){if(options.onlyIf?.etagDoesNotMatch!=='*')throw Error('community_conditional_required');const r=await request('PUT',key,{'If-None-Match':'*','Content-Type':options.httpMetadata.contentType,'Cache-Control':options.httpMetadata.cacheControl,...(options.httpMetadata.contentDisposition?{'Content-Disposition':options.httpMetadata.contentDisposition}:{}),'x-amz-content-sha256':options.sha256,...Object.fromEntries(Object.entries(options.customMetadata).map(([k,v])=>['x-amz-meta-'+k,v]))},bytes);await r.body?.cancel();if([409,412].includes(r.status))return null;if(!r.ok)throw Error('community_destination_create');return {size:bytes.length};},
 };
}
export async function communityPrivateJson(file,value){
 const handle=await open(file,constants.O_WRONLY|constants.O_CREAT|constants.O_TRUNC|constants.O_NOFOLLOW,0o600);
 try{await handle.chmod(0o600);await handle.writeFile(JSON.stringify(value,null,2)+'\n');}finally{await handle.close();}
}
async function main(){
 const args=Object.fromEntries(process.argv.slice(2).map(v=>v.replace(/^--/,'').split('='))),mode=args.mode??'validate';
 if(mode==='validate'){const plan=validateCommunityPlan(JSON.parse(await readFile(args.plan,'utf8')),args['confirm-digest']);console.log(JSON.stringify({mode,objects:plan.entries.length,posts:plan.posts.length,planDigest:plan.planDigest,productionMutations:0}));return;}
 if(!['plan','prepare','apply','rollback'].includes(mode)||!args.output)throw Error('community_arguments');
 if(mode!=='plan'&&(!args['approved-digest']||args['approved-digest']!==args['confirm-digest']))throw Error('community_approved_digest_required');
 const plan=mode==='plan'?null:validateCommunityPlan(JSON.parse(await readFile(args.plan,'utf8')),args['confirm-digest']);
 if(process.env.NEXT_PUBLIC_SUPABASE_URL!==project||!process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith('sb_secret_'))throw Error('community_operator_config');
 const registry=createClient(project,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false},global:{fetch:(url,init)=>fetch(url,{...init,redirect:'error',signal:AbortSignal.timeout(30000)})}});
 const bundle=await build({entryPoints:['app/utils/communityMedia.ts'],bundle:true,platform:'node',format:'esm',write:false});const core=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
 // Offline raster decoder shares the pinned local Images implementation.
 const rasterBundle=await build({entryPoints:['app/utils/communityRaster.ts'],bundle:true,platform:'node',format:'esm',write:false});const raster=await import('data:text/javascript;base64,'+Buffer.from(rasterBundle.outputFiles[0].text).toString('base64'));
 const decode=(bytes,mime)=>raster.validateCommunityRaster(bytes,mime,communityLocalDecoder);
 const inventory=async()=>{const r=await registry.rpc('community_media_migration_inventory');if(r.error||!r.data)throw Error('community_inventory_failed');return r.data;};
 const readSource=async item=>{const r=await fetch(COMMUNITY_LEGACY_BASE+item.source.key,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30000),headers:{'Accept-Encoding':'identity'}});if(!r.ok||communityMime(r.headers.get('content-type'))!==item.source.mime){await r.body?.cancel();throw Error('community_source_read_failed');}return boundedBytes(r);};
 if(mode==='plan'){const before=await inventory(),result=await planCommunityMigration(before,readSource,decode);if(communityDigest(await inventory())!==result.inventoryDigest)throw Error('community_inventory_drift');await communityPrivateJson(args.output,result);console.log(JSON.stringify({mode,objects:result.entries.length,posts:result.posts.length,references:result.entries.reduce((n,e)=>n+e.references.length,0),sourceBytes:result.entries.reduce((n,e)=>n+e.source.size,0),legacy_unreferenced_retained:result.legacy_unreferenced_retained,planDigest:result.planDigest,productionMutations:0}));return;}
 const binding=communityOperatorBinding(process.env);
 const deps={inventory,readSource,validateImage:decode,record:r=>communityPrivateJson(args.output,{...r,planDigest:plan.planDigest}),prepare:(item,bytes)=>core.prepareCommunityAsset({registry,binding,decoder:communityLocalDecoder,actorId:item.ownerId,ownerId:item.ownerId,bytes,contentType:item.source.mime,assetId:item.assetId,idempotencyKey:item.idempotencyKey}),
  async cas(payload,rollback){const r=await registry.rpc('apply_community_media_locators',{...payload,p_rollback:rollback});if(r.error||r.data!==true)throw Error('community_cas_conflict');},
  async verify(p,mode){const fresh=await inventory(),phase=assertCommunityCurrent(p,fresh,mode);if(phase!==(mode==='rollback'?'rolled_back':'applied'))throw Error('community_commit_verification');
   for(const item of p.entries){const r=await registry.from('media_assets').select('*').eq('id',item.assetId).single(),a=r.data;if(r.error||!a||a.owner_id!==item.ownerId||a.business_scope!=='community'||a.bucket!==item.bucket||a.object_key!==item.key||a.public_url!==item.newUrl||a.expected_sha256!==item.sha256||Number(a.expected_size)!==item.source.size||a.mime!==item.source.mime||!a.verified_at||!a.uploaded_at||a.state!==(mode==='rollback'?'tombstoned':'committed'))throw Error('community_asset_verification');
    const refs=await registry.from('media_asset_references').select('parent_type,parent_id,reference_digest').eq('asset_id',item.assetId);if(refs.error||!Array.isArray(refs.data))throw Error('community_reference_verification');const expected=mode==='rollback'?[]:[...new Set(item.references.map(x=>x.postId))].map(id=>({parent_type:'community_post',parent_id:id,reference_digest:createHash('sha256').update(item.newUrl).digest('hex')}));const sort=v=>v.sort((a,b)=>a.parent_id.localeCompare(b.parent_id));if(communityDigest(sort(refs.data))!==communityDigest(sort(expected)))throw Error('community_reference_verification');await core.verifyCommunityBytes(binding,a);
   }
  }
 };
 try{const result=await executeCommunityPlan(plan,args['confirm-digest'],deps,mode);console.log(JSON.stringify(result));}catch(error){let lastProgress=null;try{const saved=JSON.parse(await readFile(args.output,'utf8'));if(saved.planDigest===plan.planDigest)lastProgress=saved;}catch{}await communityPrivateJson(args.output,{status:'failed',lastProgress,planDigest:plan.planDigest,code:/^community_[a-z_]+$/.test(error.message)?error.message:'community_operator_failed',requiresFreshVerification:true,physicalDeletes:0});throw error;}
}
import {createHash} from 'node:crypto';
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error(JSON.stringify({status:'failed',code:e instanceof Error&&/^community_[a-z_]+$/.test(e.message)?e.message:'community_operator_failed',sourceWrites:0,sourceDeletes:0,physicalDeletes:0}));process.exitCode=1;});
