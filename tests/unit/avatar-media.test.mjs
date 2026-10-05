import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtemp, rm, readFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { avatarKey, avatarOwnerScope, avatarWriteAuthority, AVATAR_BASE_URL, AVATAR_MAX_BYTES } from '../../app/utils/avatarMediaContract.mjs';
await mkdir('.tmp',{recursive:true});
const temp=await mkdtemp(path.resolve('.tmp/avatar-tests-'));
await build({ entryPoints:['app/utils/avatarMedia.ts','app/utils/avatarUploadHandler.ts','app/components/PublicHostProfileImage.tsx','next.config.ts'],bundle:true,platform:'node',format:'esm',outdir:temp,external:['react','react/jsx-runtime','@sentry/nextjs','@opennextjs/cloudflare'] });
const media=await import(pathToFileURL(temp+'/app/utils/avatarMedia.js'));
const component=(await import(pathToFileURL(temp+'/app/components/PublicHostProfileImage.js'))).default;
const config=(await import(pathToFileURL(temp+'/next.config.js'))).default;
const {createAvatarUploadHandler}=await import(pathToFileURL(temp+'/app/utils/avatarUploadHandler.js'));
after(()=>rm(temp,{recursive:true,force:true}));
const owner='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222';
const bytes=new Uint8Array([0xff,0xd8,0xff,1,2]);
export function fixture(failure) {
  const objects=new Map(),events=[];let asset,puts=0;
  const registry={async rpc(name,args){
    events.push(name);
    if(name==='begin_avatar_media_asset') asset ??= {id:args.p_id,owner_id:args.p_owner_id,object_key:args.p_key,public_url:args.p_url,
      expected_sha256:args.p_sha256,expected_size:args.p_size,mime:args.p_mime,provider:'r2',bucket:'locally-public-avatars',business_scope:'avatar',parent_id:args.p_owner_id,state:'pending',verified_at:null};
    if(name==='verify_avatar_media_asset') asset.verified_at='2026-10-05T00:00:00Z';
    if(name==='commit_profile_avatar') {if(failure==='cas')return {data:null,error:{code:'40001'}};asset.state='committed';}
    return {data:failure==='owner'?{...asset,owner_id:other}:asset,error:failure===name?{code:'fixture'}:null};
  }};
  const binding={async head(key){if(failure==='head')throw new Error('private details');const object=objects.get(key);return object && failure==='headMismatch'?{...object,customMetadata:{}}:object??null;},
    async put(key,value,options){puts++;events.push('PUT');assert.deepEqual(options.onlyIf,{etagDoesNotMatch:'*'});assert(options.sha256);if(failure==='put')throw new Error('private details');
      if(objects.has(key))return null;objects.set(key,{size:value.length,httpMetadata:options.httpMetadata,customMetadata:options.customMetadata,arrayBuffer:async()=>value.slice().buffer});return failure==='concurrent'?null:objects.get(key);},
    async get(key){events.push('GET');const object=objects.get(key);return failure==='byteMismatch'?{...object,arrayBuffer:async()=>new Uint8Array([0xff,0xd8,0xff,9,9]).buffer}:object??null;}};
  return {registry,binding,objects,events,puts:()=>puts,asset:()=>asset,input:{registry,binding,actorId:owner,ownerId:owner,bytes,contentType:'image/jpeg'}};
}
test('opaque owner namespace, immutable per-asset identity, no raw UUID and scoped raster extension',()=>{
  const a=avatarKey(owner,crypto.randomUUID(),'image/jpeg'),b=avatarKey(owner,crypto.randomUUID(),'image/jpeg');
  assert.notEqual(a,b);assert(!a.includes(owner));assert.match(a,/^avatars\/v1\/[a-f0-9]{64}\/[a-f0-9-]{36}\/avatar.jpg$/);
  assert.notEqual(avatarOwnerScope(owner),avatarOwnerScope(other));assert.throws(()=>avatarKey('not-uuid',crypto.randomUUID(),'image/jpeg'));
});
test('auth and exact profile owner precede any registry/provider operation',async()=>{
  for(const actorId of [null,other]){const f=fixture();await assert.rejects(media.prepareManagedAvatar({...f.input,actorId}),error=>[401,403].includes(error.status));assert.equal(f.events.length,0);}
});
test('independent raster MIME/magic, nonempty and 10MiB ceiling; reject SVG/HEIC/disguised ISO media',()=>{
  assert.equal(media.validateAvatarImage(bytes,'image/jpeg'),'image/jpeg');
  for(const [payload,mime] of [[bytes,'image/svg+xml'],[bytes,'image/heic'],[bytes,'image/png'],[new Uint8Array(),'image/jpeg'],[new Uint8Array(AVATAR_MAX_BYTES+1),'image/jpeg'],[new TextEncoder().encode('0000ftypheic0000'),'image/avif']])assert.throws(()=>media.validateAvatarImage(payload,mime));
  const maximum=new Uint8Array(AVATAR_MAX_BYTES);maximum.set(bytes);assert.equal(media.validateAvatarImage(maximum,'image/jpeg'),'image/jpeg');
  for(const [payload,mime] of [[[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a],'image/png'],[new TextEncoder().encode('GIF89a'),'image/gif'],[new TextEncoder().encode('RIFF0000WEBP'),'image/webp'],[new TextEncoder().encode('0000ftypavif0000'),'image/avif']])assert.equal(media.validateAvatarImage(new Uint8Array(payload),mime),mime);
});
test('pending precedes create-only PUT; full byte verification precedes verify and profile CAS',async()=>{
  const f=fixture(),asset=await media.prepareManagedAvatar(f.input);assert.equal(asset.state,'pending');assert(asset.verified_at);
  assert.deepEqual(f.events,['begin_avatar_media_asset','PUT','GET','verify_avatar_media_asset']);
  const result=await media.commitManagedAvatar(f.registry,asset,'legacy');assert.equal(result.authority,'r2');assert.equal(f.asset().state,'committed');assert.equal(f.puts(),1);
});
test('conditional create conflict is accepted only after exact HEAD metadata and actual GET SHA',async()=>{
  const f=fixture('concurrent');const asset=await media.prepareManagedAvatar(f.input);assert(asset.verified_at);assert.equal(f.puts(),1);
  for(const failure of ['headMismatch','byteMismatch']){const broken=fixture(failure);await assert.rejects(media.prepareManagedAvatar(broken.input));assert(!broken.events.includes('verify_avatar_media_asset'));}
});
test('provider and registry failure leave pending record; no second authority or physical delete',async()=>{
  for(const failure of ['head','put','verify_avatar_media_asset']){const f=fixture(failure);await assert.rejects(media.prepareManagedAvatar(f.input),error=>error instanceof media.AvatarMediaError&&!error.message.includes('private'));assert.equal(f.asset().state,'pending');assert(!f.events.includes('commit_profile_avatar'));assert(!('delete' in f.binding));}
});
test('registry owner mismatch cannot write; profile CAS conflict retains traceable verified pending',async()=>{
  const f=fixture('owner');await assert.rejects(media.prepareManagedAvatar(f.input));assert.equal(f.puts(),0);
  const race=fixture('cas'),asset=await media.prepareManagedAvatar(race.input);await assert.rejects(media.commitManagedAvatar(race.registry,asset,'old'),error=>error.status===409);assert.equal(asset.state,'pending');assert(asset.verified_at);
});
test('flag is server-only, default false; true/malformed/missing-binding never silently fall back',()=>{
  assert.equal(avatarWriteAuthority(null,undefined),'supabase');assert.equal(avatarWriteAuthority({AVATAR_R2_SOURCE_ENABLED:'false'}),'supabase');
  for(const env of [null,{AVATAR_R2_SOURCE_ENABLED:'true'},{AVATAR_R2_SOURCE_ENABLED:'typo'},{CLOUDFLARE_DEPLOYMENT_ENV:'canary',AVATAR_R2_SOURCE_ENABLED:'true',PUBLIC_AVATAR_R2:{}}])assert.throws(()=>avatarWriteAuthority(env,'true'));
  assert.equal(avatarWriteAuthority({CLOUDFLARE_DEPLOYMENT_ENV:'production',AVATAR_R2_SOURCE_ENABLED:'true',PUBLIC_AVATAR_R2:{}}),'r2');
});
const mirror=JSON.parse(await readFile('app/data/publicHostProfileImages.generated.json','utf8'));
const avatarHosts=Object.entries(mirror).filter(([,row])=>row.originUrl.includes('/public/avatars/'));
test('public host baseline remains 52 entries: 2 avatar origins and 50 images/profile origins',()=>{assert.equal(Object.keys(mirror).length,52);assert.equal(avatarHosts.length,2);assert.equal(Object.values(mirror).filter(row=>row.originUrl.includes('/public/images/profile/')).length,50);});
for(const [index,[hostId,entry]] of avatarHosts.entries())test(`existing avatar-origin host ${index+1}: stale derivative origin falls back to authoritative R2 with write flag false`,()=>{
  process.env.NEXT_PUBLIC_CLOUDFLARE_HOST_PROFILE_BASE_URL='https://profiles-media.locally-travel.com';
  process.env.AVATAR_R2_SOURCE_ENABLED='false';
  const old=renderToStaticMarkup(React.createElement(component,{hostId,originImageUrl:entry.originUrl,alt:'fixture',sizes:'40px'}));assert(old.includes('data-host-profile-image-delivery="cloudflare-r2"'));
  const next=AVATAR_BASE_URL+'/'+avatarKey(owner,crypto.randomUUID(),'image/jpeg');
  const html=renderToStaticMarkup(React.createElement(component,{hostId,originImageUrl:next,alt:'fixture',sizes:'40px'}));assert(html.includes(`src="${next}"`));assert(html.includes('data-host-profile-image-delivery="avatar-r2"'));assert(!html.includes(entry.originUrl));
});
test('Next/Image permits only canonical avatar namespace and retains external OAuth patterns',()=>{
  assert.deepEqual(config.images.remotePatterns.find(row=>row.hostname==='avatars-media.locally-travel.com'),{protocol:'https',hostname:'avatars-media.locally-travel.com',pathname:'/avatars/v1/**',search:''});
  for(const host of ['lh3.googleusercontent.com','k.kakaocdn.net'])assert(config.images.remotePatterns.some(row=>row.hostname===host));
});
test('desktop/mobile converge on one endpoint; later profile saves cannot overwrite newer avatar; host editor untouched',async()=>{
  for(const file of ['app/account/page.tsx','app/components/mobile/MobileProfileView.tsx']){
    const source=await readFile(file,'utf8');assert.match(source,/await uploadProfileAvatar\(compressedFile\)/);assert.doesNotMatch(source,/storage\.from\('avatars'\)/);assert.doesNotMatch(source,/avatar_url: (profile|editData)\.avatar_url,/);
  }
  const host=await readFile('app/host/dashboard/components/ProfileEditor.tsx','utf8');assert.match(host,/storage\.from\('images'\)/);assert.match(host,/profile\//);
});

function routeFixture({auth=true,profileOwner=owner,flag='false',failure,cas=true}={}) {
  const f=fixture(failure),calls=[];
  const supabase={auth:{getUser:async()=>({data:{user:auth?{id:owner}:null},error:null})},
    from(table){assert.equal(table,'profiles');const query={select(){return query;},eq(field,value){calls.push(['eq',field,value]);return query;},is(field,value){calls.push(['is',field,value]);return query;},
      single:async()=>({data:{id:profileOwner,avatar_url:null},error:null}),maybeSingle:async()=>({data:cas?{id:owner}:null,error:null}),update(value){calls.push(['update',value]);return query;}};return query;},
    storage:{from(bucket){assert.equal(bucket,'avatars');return {upload:async(key)=>{calls.push(['supabase-PUT',key]);return {error:null};},getPublicUrl:key=>({data:{publicUrl:'https://fixture.supabase.co/avatars/'+key}})};}}};
  const handler=createAvatarUploadHandler({createClient:async()=>supabase,createAdminClient:()=>f.registry,loadAvatarRuntime:()=>({CLOUDFLARE_DEPLOYMENT_ENV:'production',AVATAR_R2_SOURCE_ENABLED:flag,PUBLIC_AVATAR_R2:f.binding})});
  return {...f,calls,handler};
}
function request({payload=bytes,mime='image/jpeg',origin='https://app.test',extra}={}) {
  const form=new FormData();form.set('file',new File([payload],'avatar.jpg',{type:mime}));if(extra)form.set('objectKey',extra);
  return new Request('https://app.test/api/profile/avatar',{method:'POST',headers:{origin,'content-length':String(payload.length+1024)},body:form});
}
test('actual server handler denies unauthenticated/cross-owner/cross-origin input before writes',async()=>{
  for(const [options,input,status] of [[{auth:false},{},401],[{profileOwner:other},{},403],[{}, {origin:'https://evil.test'},403]]) {
    const f=routeFixture(options),response=await f.handler(request(input));assert.equal(response.status,status);assert.equal(f.puts(),0);assert(!f.calls.some(row=>row[0]==='supabase-PUT'));
  }
});
test('actual server handler denies arbitrary keys, empty and bad magic/MIME independently',async()=>{
  for(const input of [{extra:'arbitrary'},{payload:new Uint8Array()},{mime:'image/png'}]){const f=routeFixture();const response=await f.handler(request(input));assert.equal(response.status,400);assert(!f.calls.some(row=>row[0]==='supabase-PUT'));}
});
test('flag-false handler retains user-session Supabase authority and CAS; UI gets URL only after commit',async()=>{
  const f=routeFixture(),response=await f.handler(request());assert.equal(response.status,200);assert.equal((await response.json()).authority,'supabase');assert.equal(f.puts(),0);assert(f.calls.some(row=>row[0]==='is'&&row[1]==='avatar_url'&&row[2]===null));
  const race=routeFixture({cas:false});assert.equal((await race.handler(request())).status,409);
});
test('flag-true handler uses owned registry -> conditional R2 -> verified -> profile CAS without Supabase fallback',async()=>{
  const f=routeFixture({flag:'true'}),response=await f.handler(request());assert.equal(response.status,200);assert.equal((await response.json()).authority,'r2');assert.equal(f.asset().owner_id,owner);assert.equal(f.asset().state,'committed');assert(!f.calls.some(row=>row[0]==='supabase-PUT'));
  for(const failure of ['put','cas']){const broken=routeFixture({flag:'true',failure});assert([409,503].includes((await broken.handler(request())).status));assert(!broken.calls.some(row=>row[0]==='supabase-PUT'));}
});
