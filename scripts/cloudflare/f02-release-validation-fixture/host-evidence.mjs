import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCacheRevalidationObserver} from '../../scripts/cloudflare/candidate-cache-revalidation.mjs';
import {prepareCoverageContext} from '../../scripts/cloudflare/candidate-coverage-owner.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
export function createHostEvidence({context,origin,override,readAsset}){
 const cache=createCacheRevalidationObserver({origin,override,readAsset}),pending=new Set(),errors=[],staticProofs=[],httpErrors=[];
 prepareCoverageContext(context,origin,cache.watch);
 context.on('response',response=>{
  const request=response.request(),u=new URL(response.url());if(u.origin!==origin)return;
  const s=response.status();if(s>=300&&s!==304&&!(u.pathname==='/api/proxy-bookings'&&!u.search&&s===401&&request.method()==='GET'&&request.isNavigationRequest()&&request.resourceType()==='document'&&request.frame()===request.frame().page().mainFrame()))httpErrors.push({pathname:u.pathname,status:s});
  const job=(async()=>{
   await cache.observe(response);
   if(!u.pathname.startsWith('/_next/static/'))return;
   if(s===304){assert(['script','font'].includes(request.resourceType()));return;}
   assert.equal(s,200);assert.equal(await response.finished(),null);
   if(request.resourceType()!=='script'){
    const bytes=await response.body(),local=await readAsset(u.pathname);assert.equal(hash(bytes),hash(local));
    staticProofs.push({pathname:u.pathname,status:s,type:request.resourceType(),source:'actual-browser-response',bytes:bytes.length,sha256:hash(bytes),hashMatch:true});
   }
  })().catch(e=>errors.push({code:e.code??e.name,cacheStage:e.cacheStage??null,pathname:u.pathname})).finally(()=>pending.delete(job));pending.add(job);
 });
 return {
  cache,
  onReadResponse:async(proof,request)=>{
   await cache.onReadResponse(proof,request);
   const u=new URL(proof.url);
   if(u.pathname.startsWith('/_next/static/')&&proof.status===200){
    const local=await readAsset(u.pathname);assert.equal(proof.networkSHA256,hash(local));assert.equal(proof.networkBytes,local.length);
    staticProofs.push({pathname:u.pathname,status:200,type:request.resourceType(),source:'actual-forwarded200+exact-local-artifact',bytes:local.length,sha256:hash(local),hashMatch:true});
   }
  },
  collect:async page=>{
   let timer;try{await Promise.race([(async()=>{while(pending.size)await Promise.all([...pending]);})(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('HOST_CACHE_CAPTURE_TIMEOUT')),1000)})]);}finally{clearTimeout(timer)}
   assert.deepEqual(errors,[]);assert.deepEqual(httpErrors,[]);await cache.checkpoint(page);
   assert(staticProofs.some(r=>r.type==='script'));return {staticProofs,cache304:cache.receipts};
  },
  final:()=>{const owners=cache.coverageEvidence();assert(owners.length>0);assert(owners.every(o=>o.finalized&&o.cleanupComplete));assert(cache.receipts.every(r=>r.validatedCachedRepresentation&&(r.representationKind==='font'?r.fontProof?.nativeCachedBody||r.fontProof?.rendered&&r.fontProof?.customFont:r.scriptExecuted&&r.executionProof?.executed)));return {owners,staticProofs,cache304:cache.receipts,collectorErrors:errors,httpErrors};}
 };
}
