import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {build} from 'esbuild';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {COMMUNITY_BASE_URL,COMMUNITY_LEGACY_BASE,communityKey} from '../../app/utils/communityMediaContract.mjs';
const require=createRequire(import.meta.url);await mkdir('.tmp',{recursive:true});const dir=await mkdtemp(path.resolve('.tmp/community-post-'));
await build({entryPoints:['app/api/community/posts/route.ts'],outfile:dir+'/route.cjs',bundle:true,platform:'node',format:'cjs',plugins:[{name:'local-boundaries',setup(b){
 b.onResolve({filter:/^next\/server$/},()=>({path:require.resolve('next/server'),external:true}));
 b.onResolve({filter:/supabase\/(admin|server)|communityMedia\.server|next\/cache|utils\/sanitize|utils\/adminAccess/},a=>({path:a.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export async function createClient(){return globalThis.__communityClient} export function createAdminClient(){return globalThis.__communityAdmin} export function loadCommunityRuntime(){return globalThis.__communityEnv} export function sanitizeText(s){return s} export async function resolveAdminAccess(){return {isAdmin:true}} export function revalidatePath(){} export function revalidateTag(){}`,loader:'js'}));
}}]});const {POST}=require(dir+'/route.cjs');after(()=>rm(dir,{recursive:true,force:true}));
const owner='11111111-1111-4111-8111-111111111111',asset='22222222-2222-4222-8222-222222222222',legacy='community/'+owner+'/fixture.jpg';
function fixture(flag){let remove=0,inserts=0;const admin={from(){const q={select(){return q},contains(){return q},limit:async()=>({data:[],error:null})};return q},storage:{from(){return {getPublicUrl:key=>({data:{publicUrl:COMMUNITY_LEGACY_BASE+key}})}}}};const client={auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},from(){const q={insert(){inserts++;return q},select(){return q},single:async()=>({data:null,error:{code:'fixture_failure',message:'fixture_insert_failure'}})};return q},storage:{from(){return {remove:async()=>{remove++;return {error:null}}}}}};globalThis.__communityClient=client;globalThis.__communityAdmin=admin;globalThis.__communityEnv={CLOUDFLARE_DEPLOYMENT_ENV:'production',COMMUNITY_R2_SOURCE_ENABLED:flag,PUBLIC_COMMUNITY_SOURCE_R2:{},IMAGES:{}};return {remove:()=>remove,inserts:()=>inserts};}
const request=body=>new Request('https://app.test/api/community/posts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:'Synthetic',content:'Synthetic',category:'qna',...body})});
test('R2 post INSERT failure cannot reach old Supabase remove authority',async()=>{const f=fixture('true');const response=await POST(request({images:[COMMUNITY_BASE_URL+'/'+communityKey(owner,asset)],image_asset_ids:[asset],image_paths:[]}));assert.equal(response.status,500);assert.equal(f.inserts(),1);assert.equal(f.remove(),0);});
test('stale browser legacy post/save fails closed on active or malformed flag with zero remove',async()=>{for(const [flag,status] of [['true',409],['typo',503]]){const f=fixture(flag);assert.equal((await POST(request({images:[COMMUNITY_LEGACY_BASE+legacy],image_paths:[legacy]}))).status,status);assert.equal(f.remove(),0);assert.equal(f.inserts(),0);}});
test('explicit flag false preserves owner/ref-checked legacy cleanup before cutover',async()=>{const f=fixture('false');assert.equal((await POST(request({images:[COMMUNITY_LEGACY_BASE+legacy],image_paths:[legacy]}))).status,500);assert.equal(f.remove(),1);});
