// Local workerd, real isolated R2 and Images decode. Never contacts a provider.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.resolve('miniflare'))('sharp');
import {readFile} from 'node:fs/promises';
const owner='11111111-1111-4111-8111-111111111111';
const source=`import {createCommunityUploadHandlers} from './app/utils/communityUploadHandler.ts';
const owner='${owner}';const rows=new Map();
const client={auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},from(table){const q={select(){return q},eq(){return q},single:async()=>({data:table==='profiles'?{id:owner}:{id:'fixture',user_id:'foreign'},error:null})};return q},storage:{from(){throw Error('unexpected Supabase fallback')}}};
const registry={async rpc(name,a){let row=rows.get(a.p_id);if(name==='begin_community_media_asset'){row={id:a.p_id,owner_id:a.p_owner_id,business_scope:'community',parent_type:'community_owner',parent_id:a.p_owner_id,provider:'r2',bucket:'locally-public-community-originals',object_key:a.p_key,public_url:a.p_url,expected_sha256:a.p_sha256,expected_size:a.p_size,mime:a.p_mime,state:'pending'};rows.set(a.p_id,row)}else if(name==='mark_community_media_uploaded')row.uploaded_at='fixture';else if(name==='verify_community_media_asset')row.verified_at='fixture';return {data:row,error:null}}};
export default {fetch(request,env){const h=createCommunityUploadHandlers({createClient:async()=>client,createAdminClient:()=>registry,loadRuntime:()=>env});return request.method==='GET'?h.GET():h.POST(request)}};`;
const script=(await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'browser',format:'esm',write:false})).outputFiles[0].text;
const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
const names=['PUBLIC_COMMUNITY_SOURCE_R2','PUBLIC_HOST_PROFILE_SOURCE_R2','PUBLIC_AVATAR_R2','PUBLIC_EXPERIENCE_MEDIA_SOURCE_R2'];
const create=(r2Buckets,images=true,flag='true')=>new Miniflare(convertV4MiniflareOptions({cf:false,modules:true,script,compatibilityDate:config.compatibility_date,compatibilityFlags:['nodejs_compat'],bindings:{CLOUDFLARE_DEPLOYMENT_ENV:'production',COMMUNITY_R2_SOURCE_ENABLED:flag},r2Buckets,...(images?{images:{binding:'IMAGES'}}:{})}));
const mf=create(names),closed=create(names.slice(1)),noDecoder=create(names,false),legacy=create(names,true,'false');
async function upload(runtime,payload,mime,name,options={}){const form=new FormData();form.set('file',new File([payload],name,{type:mime}));if(options.post)form.set('post_id',options.post);const req=new Request('http://localhost/api/community/images',{method:'POST',body:form});const bytes=await req.arrayBuffer();return runtime.dispatchFetch(req.url,{method:'POST',headers:{origin:options.origin??'http://localhost','content-type':req.headers.get('content-type'),'content-length':options.length??String(bytes.byteLength)},body:new Uint8Array(bytes)});}
try{
 const bucket=await mf.getR2Bucket(names[0]);
 for(const format of ['jpeg','png','webp','gif','avif']){
  const bytes=await sharp({create:{width:4,height:4,channels:3,background:'#abcdef'}}).toFormat(format).toBuffer();
  const response=await upload(mf,bytes,'image/'+format,'fixture.'+format);assert.equal(response.status,200,await response.clone().text());
  const value=await response.json();assert.equal(value.authority,'r2');const object=await bucket.get(new URL(value.publicUrl).pathname.slice(1));
  assert.match(object.key,/^community\/v1\/[a-f0-9]{64}\/[a-f0-9-]{36}\/image$/);assert.deepEqual(Buffer.from(await object.arrayBuffer()),bytes);assert.equal(object.httpMetadata.contentType,'image/'+format);assert.equal(object.httpMetadata.cacheControl,'public, max-age=31536000, immutable');assert.equal(object.customMetadata.asset_id,value.assetId);const blocked=await bucket.put(object.key,new Uint8Array([1,2,3]),{onlyIf:{etagDoesNotMatch:'*'}});assert.equal(blocked,null);assert.deepEqual(Buffer.from(await (await bucket.get(object.key)).arrayBuffer()),bytes);
 }
 const count=(await bucket.list()).objects.length;
 for(const [bytes,mime,name,status] of [[Buffer.from([255,216,255,1]),'image/jpeg','broken.jpg',400],[Buffer.from('<svg/>'),'image/svg+xml','a.svg',400],[Buffer.alloc(0),'image/png','empty.png',413],[Buffer.from('heic'),'image/heic','a.heic',400],[Buffer.alloc(10*1024*1024+1),'image/png','large.png',413]])assert.equal((await upload(mf,bytes,mime,name)).status,status);
 const png=await sharp({create:{width:2,height:2,channels:3,background:'red'}}).png().toBuffer();
 assert.equal((await upload(mf,png,'image/jpeg','mismatch.jpg')).status,400);
 assert.equal((await upload(mf,png,'image/png','a.png',{origin:'http://foreign'})).status,403);
 assert.equal((await upload(mf,png,'image/png','a.png',{post:owner})).status,403);
 await assert.rejects(upload(mf,png,'image/png','a.png',{length:'1'}),/fetch failed/);
 for(const runtime of [closed,noDecoder]){assert.equal((await upload(runtime,png,'image/png','a.png')).status,503);assert.equal((await runtime.dispatchFetch('http://localhost/api/community/images')).status,503);}
 assert.equal((await upload(legacy,png,'image/png','a.png')).status,409);
 assert.equal((await (await legacy.dispatchFetch('http://localhost/api/community/images')).json()).authority,'supabase');
 assert.equal((await bucket.list()).objects.length,count);
 for(const name of names.slice(1))assert.equal((await (await mf.getR2Bucket(name)).list()).objects.length,0);
 console.log('COMMUNITY_SERVER_WRITE_AUTHORITY_READY PASS');console.log('COMMUNITY_SOURCE_BYTE_VERIFIED PASS');console.log('COMMUNITY_R2_FAIL_CLOSED PASS');console.log('COMMUNITY_WORKER_CROSS_AUTHORITY_ISOLATION PASS');console.log('COMMUNITY_RASTER_FULL_DECODE_PASS');
}finally{await Promise.all([mf,closed,noDecoder,legacy].map(x=>x.dispose()));}
