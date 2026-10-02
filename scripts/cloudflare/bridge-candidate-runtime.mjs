import assert from 'node:assert/strict';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { parse } from 'acorn';
import { artifactModule, bridgeCredentials } from './bridge-candidate-compatibility.mjs';
import { buildSync } from 'esbuild';
import { patchQueueArtifact } from './revalidation-bridge-build.mjs';
import { createRevalidationBridge } from '../../app/utils/isrRevalidationBridge.mjs';

const require=createRequire(import.meta.url);
const {checkIsOnDemandRevalidate}=require('next/dist/server/api-utils/index.js');
export async function verifyBridgeRuntimeMatrix(stableSource, candidateSource) {
const sources=[stableSource,candidateSource];
const credentials=sources.map(bridgeCredentials),compat=credentials[0][0];
assert.equal(credentials[1][0],compat);
const token=g=>g===2?'f'.repeat(32):credentials[g][1];
const moduleText=(name,g=0)=>artifactModule(sources[Math.min(g,1)],name);
const prelude=stableSource.slice(0,stableSource.search(/^\/\/ /m));
const tests=[];const test=(name,fn)=>tests.push({name,fn});
function removeImports(s){for(const n of parse(s,{ecmaVersion:'latest',sourceType:'module'}).body.filter(n=>n.type==='ImportDeclaration').reverse())s=s.slice(0,n.start)+s.slice(n.end);return s;}
function state(db=new DatabaseSync(':memory:')){
  const initial=[],waits=[];let alarm=null;
  const sql={exec(query,...args){let rows=[];if(query.includes(';')&&!args.length)db.exec(query);else{const s=db.prepare(query);if(s.columns().length)rows=s.all(...args);else s.run(...args);}rows.toArray=()=>Array.from(rows);return rows;}};
  const ctx={storage:{sql,getAlarm:async()=>alarm,setAlarm:async x=>{alarm=x;}},blockConcurrencyWhile(fn){const p=Promise.resolve().then(fn);initial.push(p);return p;},waitUntil(p){waits.push(p);}};
  return{db,ctx,ready:()=>Promise.all(initial),alarm:()=>alarm,async drain(){while(waits.length)await Promise.all(waits.splice(0));}};
}
function realm(){const c=vm.createContext({createHash,Response,Request,Headers,URL,AbortSignal,Buffer,TextEncoder,TextDecoder,setTimeout,clearTimeout,process:{env:{}},console:{log(){},debug(){},info(){},warn(){},error(){}},fetch(){throw Error('FIXTURE_NETWORK_FORBIDDEN');},DurableObject:class{constructor(ctx,env){this.ctx=ctx;this.env=env;}}});c.DurableObject2=c.DurableObject;return c;}
const built=new Map();
function doSource(g,name){
  const file=name==='DOQueueHandler'?'queue':'sharded-tag-cache';
  if(g<2)return moduleText(`.open-next/.build/durable-objects/${file}.js`,g);
  const key=`${g}/${name}`;if(built.has(key))return built.get(key);
  // Compile installed upstream, never modify node_modules. Only synthetic
  // preview/build constants and in-memory outputs enter these tests.
  let code=buildSync({entryPoints:[require.resolve(`@opennextjs/cloudflare/durable-objects/${file}`)],bundle:true,platform:'node',format:'esm',external:['cloudflare:workers'],write:false,
    define:{'process.env.__NEXT_PREVIEW_MODE_ID':JSON.stringify(token(g)),'process.env.__OPEN_NEXT_BUILD_ID':JSON.stringify(`fixture-build-${g}`)}}).outputFiles[0].text;
  if(name==='DOQueueHandler')code=patchQueueArtifact(code,token(g),compat);
  built.set(key,code);return code;
}
async function object(g,name,env={},db){const c=realm();let code=removeImports(doSource(g,name));const tree=parse(code,{ecmaVersion:'latest',sourceType:'module'});
  for(const n of tree.body.filter(n=>n.type==='ExportNamedDeclaration').reverse()){assert.equal(n.declaration,null);code=code.slice(0,n.start)+code.slice(n.end);}
  vm.runInContext(prelude+code+`;globalThis.TestDO=${name}`,c);const s=state(db),obj=new c.TestDO(s.ctx,env);await s.ready();return{obj,s};}
function callback(g,status){const records=[],rewrite=createRevalidationBridge(compat,token(g));return{records,service:{async fetch(url,options){assert.equal(new URL(url).hostname,'fixture.invalid');const original=new Request(url,options),r=rewrite(original);
  const accepted=checkIsOnDemandRevalidate(Object.fromEntries(r.headers),{previewModeId:token(g)}).isOnDemandRevalidate;
  records.push({accepted,translated:r!==original,method:r.method,marker:r.headers.get('x-isr')});
  return new Response(null,{status:status??200,headers:{'x-nextjs-cache':accepted?'REVALIDATED':'HIT'}});
}}};}
const binding=obj=>({idFromName:n=>n,get:()=>obj});
function clients(q,t,g=0){const c=realm();c.context={env:{NEXT_CACHE_DO_QUEUE:binding(q),NEXT_TAG_CACHE_DO_SHARDED:binding(t)},ctx:{waitUntil:p=>p.catch(()=>{})},cf:{}};
  vm.runInContext(prelude+removeImports(moduleText('.open-next/middleware/open-next.config.mjs',g))+`;init_open_next_config();globalThis.openNextConfig=open_next_config_default;globalThis[cloudflareContextSymbol]=context;globalThis.queue=do_queue_default;globalThis.tag=new ShardedDOTagCache({baseShardSize:12,regionalCache:false});`,c);return c;}
const msg=(id='one')=>({MessageGroupId:'fixture-shard',MessageDeduplicationId:id,MessageBody:{host:'fixture.invalid',url:`/fixture/${id}`,lastModified:1}});
const count=(s,t)=>s.db.prepare(`SELECT count(*) AS n FROM ${t}`).get().n;
for(const [w,d] of [[0,0],[1,1],[1,0],[0,1],[2,2],[2,1],[1,2]])test(`generation ${w} Worker -> generation ${d} DO: enqueue, auth, drain, tag lookup`,async()=>{
  const cb=callback(w),q=await object(d,'DOQueueHandler',{WORKER_SELF_REFERENCE:cb.service}),t=await object(d,'DOShardedTagCache');
  try{const client=clients(q.obj,t.obj,w);assert.equal(await client.queue.send(msg()),undefined);await q.s.drain();assert.equal(cb.records.length,1);assert.equal(cb.records[0].accepted,true);assert.equal(cb.records[0].translated,compat!==token(w));assert.equal(count(q.s,'sync'),1);assert.equal(q.obj.ongoingRevalidations.size,0);
    await client.tag.writeTags([{tag:'fixture-tag',stale:1000,expire:null}]);assert.equal(await client.tag.getLastRevalidated(['fixture-tag']),1000);assert.equal(await client.tag.hasBeenRevalidated(['fixture-tag'],1),true);assert.equal(await client.tag.getLastRevalidated(['missing']),0);
  }finally{q.s.db.close();t.s.db.close();}
});
test('wrong compat token remains rejected by unmodified Next authentication',()=>{const rewrite=createRevalidationBridge(compat,token(1)),r=new Request('https://fixture.invalid',{method:'HEAD',headers:{'x-isr':'1','x-prerender-revalidate':token(2)}});assert.equal(rewrite(r),r);assert.equal(checkIsOnDemandRevalidate(Object.fromEntries(r.headers),{previewModeId:token(1)}).isOnDemandRevalidate,false);});
for(const g of [0,1,2])for(const status of [404,500,503])test(`generation ${g}: ${status} and alarm retry contract`,async()=>{
  const q=await object(g,'DOQueueHandler',{WORKER_SELF_REFERENCE:callback(1,status).service});try{await clients(q.obj,null).queue.send(msg());await q.s.drain();assert.equal(count(q.s,'sync'),0);assert.equal(q.obj.routeInFailedState.size,status===404?0:1);
    if(status!==404){assert(q.s.alarm()>0);const data=JSON.parse(q.s.db.prepare('SELECT data FROM failed_state').get().data);assert.deepEqual(Object.keys(data).sort(),['msg','nextAlarmMs','retryCount']);q.obj.service=callback(1).service;await q.obj.alarm();assert.equal(count(q.s,'sync'),1);assert.equal(q.obj.routeInFailedState.size,0);}
  }finally{q.s.db.close();}
});
for(const [from,to] of [[0,1],[1,0],[1,2],[2,1],[1,1]])test(`generation ${from}->${to} persisted reset is only retry/sync metadata, next stale request re-enqueues`,async()=>{
  const cb=callback(to),q=await object(from,'DOQueueHandler',{WORKER_SELF_REFERENCE:cb.service});
  await q.obj.revalidate(msg('sync'));await q.s.drain();await q.obj.addToFailedState(msg('retry'));assert.equal(count(q.s,'sync'),1);assert.equal(count(q.s,'failed_state'),1);
  // Unrelated fixture data survives: initState has only the two scoped DELETEs.
  q.s.db.exec('CREATE TABLE unrelated_fixture (id TEXT); INSERT INTO unrelated_fixture VALUES (\'preserve\')');
  const n=await object(to,'DOQueueHandler',{WORKER_SELF_REFERENCE:cb.service},q.s.db);
  assert.equal(count(n.s,'sync'),from===to?1:0);assert.equal(count(n.s,'failed_state'),from===to?1:0);assert.equal(count(n.s,'unrelated_fixture'),1);
  if(from!==to){const before=cb.records.length;await clients(n.obj,null).queue.send(msg('retry'));await n.s.drain();assert.equal(cb.records.length,before+1);assert.equal(count(n.s,'sync'),1);}
  const t=await object(from,'DOShardedTagCache');await t.obj.writeTags(['legacy'],1234);await t.obj.writeTags([{tag:'modern',stale:2345,expire:3456}]);const nt=await object(to,'DOShardedTagCache',{},t.s.db);
  assert.equal((await nt.obj.getTagData(['legacy'])).legacy.revalidatedAt,1234);assert.equal((await nt.obj.getTagData(['modern'])).modern.expire,3456);q.s.db.close();t.s.db.close();
});
test('bridge queue deduplicates concurrent work and drains',async()=>{
  let release;const gate=new Promise(r=>{release=r;});const cb=callback(1);let calls=0;const q=await object(1,'DOQueueHandler',{WORKER_SELF_REFERENCE:{async fetch(...args){calls++;await gate;return cb.service.fetch(...args);}}});const c=clients(q.obj,null);await c.queue.send(msg());await c.queue.send(msg());assert.equal(calls,1);release();await q.s.drain();assert.equal(q.obj.ongoingRevalidations.size,0);q.s.db.close();
});

for(const {fn} of tests) await fn();
return {fourWay:'PASS',generation01:'PASS',generation12:'PASS',rollback:'PASS',buildState:'BUILD_STATE_RESET_EXPECTED',checks:tests.length};
}
