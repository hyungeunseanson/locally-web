import assert from 'node:assert/strict';
import test from 'node:test';
import { cacheDigest, validateCachedResponse, nativeBodyLatch } from './candidate-cache-revalidation.mjs';
import { versionOverrideHeader } from './candidate-release-contract.mjs';
const workerName = 'locally-web-opennext-production', versionId = '22222222-2222-4222-8222-222222222222';
const override = versionOverrideHeader(workerName, versionId), bytes = Buffer.from('window.fixtureExecutions=(window.fixtureExecutions||0)+1;');
const sha = cacheDigest(bytes);
const url = 'http://localhost/_next/static/chunks/fixture.js';
function fixture() {
  const previous = { url, method:'GET', resourceType:'script', status:200, requestHeaders:new Headers({'cloudflare-workers-version-overrides':override}), responseHeaders:new Headers({etag:'W/"fixture"','cache-control':'public, max-age=0, must-revalidate'}), finished:true, redirected:false, networkBytes:bytes.length, browserBytes:bytes.length, networkSHA256:sha, browserSHA256:sha, localSHA256:sha };
  const current = {...previous,status:304,networkBytes:0,requestHeaders:new Headers({'cloudflare-workers-version-overrides':override,'if-none-match':'W/"fixture"'}),responseHeaders:new Headers({etag:'"fixture"','cache-control':'public, max-age=0, must-revalidate'})};
  return {previous,current};
}
test('conditional ETag GET validates only a complete matching cached browser representation', () => {
  const {previous,current} = fixture(), receipt = validateCachedResponse(previous,current,override);
  assert.equal(receipt.validatedCachedRepresentation,true); assert.equal(receipt.networkBodyBytes,0); assert.equal(receipt.scriptExecuted,false);
  assert(!JSON.stringify(receipt).includes('"fixture"'));
});
test('strong ETag and matching Vary representation work without weakening byte evidence', () => {
  const {previous,current} = fixture(); previous.responseHeaders.set('etag','"fixture"');
  for (const r of [previous,current]) {r.requestHeaders.set('accept-language','en');r.responseHeaders.set('vary','Accept-Language');}
  assert.equal(validateCachedResponse(previous,current,override).validatedCachedRepresentation,true);
});
test('Last-Modified-only validation requires exact dates and conservative freshness evidence', () => {
  const {previous,current} = fixture();
  const modified='Thu, 08 Oct 2026 00:00:00 GMT', date='Thu, 08 Oct 2026 00:02:00 GMT';
  for(const r of [previous,current]){r.responseHeaders.delete('etag');r.responseHeaders.set('last-modified',modified);r.responseHeaders.set('date',date);}
  current.requestHeaders.delete('if-none-match');current.requestHeaders.set('if-modified-since',modified);
  assert.equal(validateCachedResponse(previous,current,override).validatorKind,'last-modified');
  previous.responseHeaders.set('date',modified);assert.throws(()=>validateCachedResponse(previous,current,override));
});
const negative = {
  'no cache': f=>{f.previous=null;},
  'no conditional': f=>f.current.requestHeaders.delete('if-none-match'),
  'validator mismatch':f=>f.current.requestHeaders.set('if-none-match','"other"'),
  'ambiguous wildcard':f=>f.current.requestHeaders.set('if-none-match','*'),
  'ambiguous tag list':f=>f.current.requestHeaders.set('if-none-match','"fixture", "other"'),
  'response validator mismatch':f=>f.current.responseHeaders.set('etag','"other"'),
  'wrong browser cached bytes':f=>{f.current.browserSHA256='0'.repeat(64);},
  'wrong artifact':f=>{f.current.localSHA256='0'.repeat(64);},
  'previous mixed Worker':f=>f.previous.requestHeaders.set('cloudflare-workers-version-overrides','old'),
  'wrong Candidate':f=>f.current.requestHeaders.set('cloudflare-workers-version-overrides','other'),
  'Vary mismatch':f=>{f.previous.responseHeaders.set('vary','Accept-Language');f.previous.requestHeaders.set('accept-language','en');f.current.requestHeaders.set('accept-language','ko');},
  'Vary wildcard':f=>f.previous.responseHeaders.set('vary','*'),
  'Vary replacement':f=>f.current.responseHeaders.set('vary','Accept-Language'),
  'encoding mismatch':f=>{f.previous.responseHeaders.set('content-encoding','br');f.current.responseHeaders.set('content-encoding','gzip');},
  'encoding negotiation mismatch':f=>f.current.requestHeaders.set('accept-encoding','gzip'),
  'RSC 304':f=>{f.current.url='http://localhost/experiences/1?_rsc=a';f.current.resourceType='fetch';},
  'API 304':f=>{f.current.url='http://localhost/api/private';f.current.resourceType='fetch';},
  'query static asset':f=>{f.current.url+='?v=other';},
  '302':f=>{f.current.status=302;}, '307':f=>{f.current.status=307;},
  '404':f=>{f.current.status=404;}, '503':f=>{f.current.status=503;},
  'truncated cache':f=>{f.previous.browserBytes--;},
  'cache SHA mismatch':f=>{f.previous.networkSHA256='0'.repeat(64);},
  'incomplete load':f=>{f.current.finished=false;},
  'redirect chain':f=>{f.current.redirected=true;},
  'Location on304':f=>f.current.responseHeaders.set('location','/elsewhere'),
  'nonempty network304':f=>{f.current.networkBytes=1;},
  'no-store cache':f=>f.previous.responseHeaders.set('cache-control','no-store'),
  'cookie leak':f=>f.current.requestHeaders.set('cookie','PRIVATE_SENTINEL'),
  'auth leak':f=>f.previous.requestHeaders.set('authorization','PRIVATE_SENTINEL'),
  'write':f=>{f.current.method='POST';},
};
for(const [name,mutate] of Object.entries(negative)) test(`reject ${name}`,()=>{const f=fixture();mutate(f);assert.throws(()=>validateCachedResponse(f.previous,f.current,override),{code:'candidate_cache_revalidation_failed'});});

test('native body latch waits for decoded data even when loadingFinished arrives first; reads once',async()=>{
  let reads=0,body;
  const latch=nativeBodyLatch(4,async()=>{reads++;return Buffer.from('full')},b=>{body=b},assert.fail);
  latch.finish();await new Promise(r=>setImmediate(r));assert.equal(reads,0);
  latch.data(2);await new Promise(r=>setImmediate(r));assert.equal(reads,0);
  latch.data(2);await new Promise(r=>setImmediate(r));assert.equal(reads,1);assert.equal(body.toString(),'full');
  latch.finish();latch.data(0);await new Promise(r=>setImmediate(r));assert.equal(reads,1);
});
test('native body latch rejects oversized data and never completes truncated data or masks body errors',async()=>{
  let reads=0,rejected;
  const overflow=nativeBodyLatch(4,async()=>{reads++},assert.fail,e=>{rejected=e});overflow.data(5);overflow.finish();assert.equal(rejected.code,'candidate_cache_revalidation_failed');assert.equal(reads,0);
  const truncated=nativeBodyLatch(4,async()=>{reads++},assert.fail,assert.fail);truncated.data(3);truncated.finish();await new Promise(r=>setImmediate(r));assert.equal(reads,0);
  const failure=Error('fixture body error');const broken=nativeBodyLatch(4,async()=>{throw failure},assert.fail,e=>{rejected=e});broken.data(4);broken.finish();await new Promise(r=>setImmediate(r));assert.equal(rejected,failure);
});
