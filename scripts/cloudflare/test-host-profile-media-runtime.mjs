// Real local workerd + R2 bindings. Synthetic auth/registry only; no remote URLs.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFile} from 'node:fs/promises';
const owner='11111111-1111-4111-8111-111111111111';
const source=`import {createHostProfileUploadHandler} from './app/utils/hostProfileUploadHandler.ts';
const owner='${owner}';let asset;
const client={auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},from(){const q={select(){return q},eq(){return q},single:async()=>({data:{id:owner},error:null})};return q;},storage:{from(){throw Error('fixture unexpected fallback')}}};
const registry={async rpc(name,a){if(name==='begin_host_profile_media_asset')asset={id:a.p_id,owner_id:a.p_owner_id,business_scope:'host_profile',parent_type:'host_profile_owner',parent_id:a.p_owner_id,provider:'r2',bucket:'locally-public-host-profile-originals',object_key:a.p_key,public_url:a.p_url,expected_sha256:a.p_sha256,expected_size:a.p_size,mime:a.p_mime,state:'pending'};else if(name==='verify_host_profile_media_asset')Object.assign(asset,{uploaded_at:'fixture',verified_at:'fixture'});return {data:asset,error:null}}};
export default {fetch(request,env){return createHostProfileUploadHandler({createClient:async()=>client,createAdminClient:()=>registry,loadRuntime:()=>env})(request)}};`;
const script=(await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'browser',format:'esm',write:false})).outputFiles[0].text;
const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
const create=bindings=>new Miniflare(convertV4MiniflareOptions({cf:false,modules:true,script,compatibilityDate:config.compatibility_date,compatibilityFlags:['nodejs_compat'],bindings:{CLOUDFLARE_DEPLOYMENT_ENV:'production',HOST_PROFILE_R2_SOURCE_ENABLED:'true'},r2Buckets:bindings}));
const names=['PUBLIC_HOST_PROFILE_SOURCE_R2','PUBLIC_AVATAR_R2','PUBLIC_EXPERIENCE_MEDIA_SOURCE_R2','PUBLIC_HOST_PROFILE_DERIVATIVE_R2'];const mf=create(names),closed=create(names.slice(1));
function body(bytes,mime,name){const form=new FormData();form.set('file',new File([bytes],name,{type:mime}));return form;}
async function upload(runtime,payload,mime,name){const request=new Request('http://localhost/api/host/profile-photo',{method:'POST',body:body(payload,mime,name)});const bytes=await request.arrayBuffer();return runtime.dispatchFetch(request.url,{method:'POST',headers:{origin:'http://localhost','content-type':request.headers.get('content-type'),'content-length':String(bytes.byteLength)},body:new Uint8Array(bytes)});}
try{
 const response=await upload(mf,new Uint8Array([255,216,255,1]),'image/jpeg','fixture.jpg');assert.equal(response.status,200);const value=await response.json();assert.equal(value.authority,'r2');const bucket=await mf.getR2Bucket(names[0]),list=await bucket.list();assert.equal(list.objects.length,1);assert.match(list.objects[0].key,/^host-profiles\/v1\/[a-f0-9]{64}\/[^/]+\/profile$/);const object=await bucket.get(list.objects[0].key);assert.deepEqual(new Uint8Array(await object.arrayBuffer()),new Uint8Array([255,216,255,1]));assert.equal(object.httpMetadata.contentType,'image/jpeg');
 for(const name of names.slice(1))assert.equal((await (await mf.getR2Bucket(name)).list()).objects.length,0);
 const svg=await upload(mf,new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'),'image/svg+xml','fixture.svg');assert.equal(svg.status,200);const svgValue=await svg.json();const svgObject=await bucket.get(new URL(svgValue.publicUrl).pathname.slice(1));assert.equal(svgObject.httpMetadata.contentDisposition,'attachment');
 const denied=await upload(closed,new Uint8Array([255,216,255,1]),'image/jpeg','fixture.jpg');assert.equal(denied.status,503);for(const name of names.slice(1))assert.equal((await (await closed.getR2Bucket(name)).list()).objects.length,0);
 console.log('HOST_WORKER_R2_UPLOAD_RUNTIME PASS');console.log('HOST_WORKER_CROSS_AUTHORITY_ISOLATION PASS');console.log('HOST_WORKER_FAIL_CLOSED PASS');console.log('HOST_WORKER_SVG_ATTACHMENT PASS');
}finally{await mf.dispose();await closed.dispose();}
