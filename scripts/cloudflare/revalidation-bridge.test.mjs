import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { createRevalidationBridge } from '../../app/utils/isrRevalidationBridge.mjs';
import { patchQueueArtifact, inspectQueueToken, readProviderCompatToken, sha256, assertNoClientTokenLeakage, applyRevalidationBridge } from './revalidation-bridge-build.mjs';
import { main as deploy } from './run-production-deploy.mjs';

const compat = '0'.repeat(32), current = '1'.repeat(32);
const rewrite = createRevalidationBridge(compat, current);
const request = (method = 'HEAD', changes = {}) => new Request('https://fixture.invalid/cache?fixture=1', { method,
  headers: { 'x-isr': '1', 'x-prerender-revalidate': compat, 'x-unrelated': 'preserved', ...changes } });
test('only exact HEAD ISR credential is translated; original remains untouched', () => {
  const input = request(), output = rewrite(input);
  assert.notEqual(output,input);assert.equal(output.url,input.url);assert.equal(output.method,'HEAD');
  assert.equal(input.headers.get('x-prerender-revalidate'),compat);assert.equal(output.headers.get('x-prerender-revalidate'),current);
  assert.equal(output.headers.get('x-unrelated'),'preserved');
});
for (const [name, make] of [
  ['GET',()=>request('GET')],['POST',()=>request('POST')],['normal HEAD',()=>new Request('https://fixture.invalid',{method:'HEAD'})],
  ['missing x-isr',()=>{const r=request();r.headers.delete('x-isr');return r;}],['wrong x-isr',()=>request('HEAD',{'x-isr':'01'})],
  ['missing token',()=>{const r=request();r.headers.delete('x-prerender-revalidate');return r;}],['wrong token',()=>request('HEAD',{'x-prerender-revalidate':'2'.repeat(32)})],
  ['session cookie',()=>request('HEAD',{cookie:'fixture-session'})],['authorization',()=>request('HEAD',{authorization:'fixture-auth'})],
  ['browser fetch metadata',()=>request('HEAD',{'sec-fetch-mode':'navigate'})],['release probe',()=>request('HEAD',{'x-locally-release-probe':'1'})],
]) test(`${name} is the identical request object`,()=>{const input=make();assert.equal(rewrite(input),input);});

const queue = token => `import { DurableObject } from 'cloudflare:workers';
var DOQueueHandler=class extends DurableObject { async executeRevalidation(msg){return this.service.fetch(msg.url,{method:'HEAD',headers:{'x-isr':'1','x-prerender-revalidate':'${token}'}});} };`;
test('AST patch changes only the selected literal; preserves all other bytes',()=>{
  const original=queue(current),n=inspectQueueToken(original),patched=patchQueueArtifact(original,current,compat);
  assert.equal(patched,original.slice(0,n.start)+JSON.stringify(compat)+original.slice(n.end));
  assert.equal(inspectQueueToken(patched).value,compat);
});
for(const [name,mutate] of [
  ['method',s=>s.replace('executeRevalidation','renamed')],['HTTP method',s=>s.replace("method:'HEAD'","method:'GET'")],
  ['ISR marker',s=>s.replace("'x-isr':'1'","'x-isr':'2'")],['class',s=>s.replace('DOQueueHandler','Other')],
  ['duplicate token',s=>s+`;const extra='${current}';`],['duplicate header',s=>s+`;const extra={'x-prerender-revalidate':'${compat}'};`],
  ['unparseable',s=>s+'???'],['unexpected fingerprint',s=>s.replace(current,'3'.repeat(32))],
  ['unexpected header spread',s=>s.replace("headers:{", "headers:{...msg.headers,")],
]) test(`patch fails closed for ${name} without printing token`,()=>assert.throws(()=>patchQueueArtifact(mutate(queue(current)),current,compat),e=>e.message==='OPENNEXT_REVALIDATION_BRIDGE_PATCH_CONTRACT_CHANGED'&&!String(e.stack).includes(current)));

const versionId='11111111-1111-4111-8111-111111111111';
const policy={workerName:'locally-web-opennext-production',baselineVersionId:versionId,compatTokenSha256:sha256(compat)};
function provider({etagMismatch=false,rollout=false,wrongToken=false}={}) {
  let deployments=0;const calls=[];
  return {calls,fetch:async(url,options)=>{
    calls.push({url,method:options.method});assert.equal(options.method,'GET');
    const ok=result=>Response.json({success:true,result});
    if(url.endsWith('/deployments')) {deployments++;return ok({deployments:[{id:rollout&&deployments>1?'changed':'same',created_on:'2026-01-01',versions:[{version_id:versionId,percentage:100}]}]});}
    if(url.endsWith('/content/v2')){const form=new FormData();form.set('worker.js',new Blob(['// .open-next/.build/durable-objects/queue.js\n'+queue(wrongToken?current:compat)]),'worker.js');const r=new Response(form);r.headers.set('etag',(etagMismatch?'b':'a').repeat(64));return r;}
    return ok({id:versionId,resources:{script:{etag:'a'.repeat(64),named_handlers:[{name:'DOQueueHandler',handlers:['class']}]}}});
  }};
}
test('provider provenance ties single stable100, version ETag, content ETag and lineage digest',async()=>{
  const p=provider();const out=await readProviderCompatToken({policy,credentials:{accountId:'fixture',apiToken:'fixture'},fetchImplementation:p.fetch});
  assert.equal(out.token,compat);assert.equal(out.provenance.compatSha256,sha256(compat));assert.equal(out.provenance.etagMatch,true);assert.equal(p.calls.length,4);
  assert(!JSON.stringify(out.provenance).includes(compat));
});
for(const option of ['etagMismatch','rollout','wrongToken'])test(`provider rejects ${option}`,async()=>{
  const p=provider({[option]:true});await assert.rejects(readProviderCompatToken({policy,credentials:{accountId:'fixture',apiToken:'fixture'},fetchImplementation:p.fetch}),{message:'OPENNEXT_REVALIDATION_BRIDGE_PROVENANCE_FAILED'});
});
test('scan covers JS, maps, fonts and HTML; neither credential may leak',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'isr-client-'));
  try {await mkdir(path.join(root,'nested'));const file=path.join(root,'nested','asset.html');await writeFile(file,'safe');assert.equal(await assertNoClientTokenLeakage([root],[compat,current]),1);
    for(const token of [compat,current]){await writeFile(file,token);await assert.rejects(assertNoClientTokenLeakage([root],[compat,current]),{message:'OPENNEXT_REVALIDATION_BRIDGE_CLIENT_TOKEN_LEAK'});}
  } finally {await rm(root,{recursive:true,force:true});}
});
test('official live deploy rejects fixture before build or any provider action',async()=>{
  const calls=[];await assert.rejects(deploy([],{environment:{LOCALLY_ISR_BRIDGE_SOURCE:'fixture'},runCommand:()=>calls.push('mutation')}),{message:'OPENNEXT_REVALIDATION_BRIDGE_FIXTURE_DEPLOY_FORBIDDEN'});assert.deepEqual(calls,[]);
});
test('precompressed client assets cannot hide either credential',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'isr-compressed-'));
  try {for(const [extension,compress] of [['gz',gzipSync],['br',brotliCompressSync]]){
    const file=path.join(root,`app.js.${extension}`);await writeFile(file,compress(Buffer.from(current)));
    await assert.rejects(assertNoClientTokenLeakage([root],[compat,current]),{message:'OPENNEXT_REVALIDATION_BRIDGE_CLIENT_TOKEN_LEAK'});await rm(file);
  }}finally{await rm(root,{recursive:true,force:true});}
});
test('private output stays ignored and wrapper delegates through exact translation',async()=>{
  assert((await readFile('.gitignore','utf8')).includes('/.open-next/'));
  const wrapper=await readFile('cloudflare-worker.ts','utf8');assert(wrapper.includes('openNextWorker.fetch(rewriteRevalidation(request), env, ctx)'));
  assert(!wrapper.includes('previewModeId'));
});
test('post-build patch writes only generated files, hash-only proof; failed patch invalidates stale output',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'isr-build-'));
  const put=async(p,s)=>{await mkdir(path.dirname(path.join(root,p)),{recursive:true});await writeFile(path.join(root,p),s);};
  try {
    await put('node_modules/@opennextjs/cloudflare/package.json',JSON.stringify({version:'1.19.6'}));
    await put('.next/prerender-manifest.json',JSON.stringify({preview:{previewModeId:current}}));
    await put('config/cloudflare/revalidation-bridge.json',JSON.stringify(policy));
    await put('.open-next/.build/durable-objects/queue.js',queue(current));
    await put('.open-next/assets/index.html','safe');await put('.next/static/app.js','safe');
    const proof=await applyRevalidationBridge({root,mode:'fixture'});
    assert.equal(proof.kind,'fixture');assert.equal(proof.clientLeakage,false);assert(!JSON.stringify(proof).includes(compat));assert(!JSON.stringify(proof).includes(current));
    assert.equal(inspectQueueToken(await readFile(path.join(root,'.open-next/.build/durable-objects/queue.js'),'utf8')).value,compat);
    await put('.open-next/.build/durable-objects/queue.js','changed upstream structure');
    await assert.rejects(applyRevalidationBridge({root,mode:'fixture'}),{message:'OPENNEXT_REVALIDATION_BRIDGE_PATCH_CONTRACT_CHANGED'});
    await assert.rejects(readFile(path.join(root,'.open-next/locally-revalidation-bridge.js')),{code:'ENOENT'});
    await assert.rejects(readFile(path.join(root,'.open-next/locally-revalidation-bridge-proof.json')),{code:'ENOENT'});
  }finally{await rm(root,{recursive:true,force:true});}
});
