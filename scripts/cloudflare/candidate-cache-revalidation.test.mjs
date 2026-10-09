import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { chromium } from '@playwright/test';
import { cacheDigest, validateCachedResponse, createCacheRevalidationObserver, nativeBodyLatch } from './candidate-cache-revalidation.mjs';
import { installProductionMutationGate } from './run-production-browser-smoke.mjs';
import { versionOverrideHeader } from './candidate-release-contract.mjs';
import { coverageOwnerFor, prepareCoverageContext } from './candidate-coverage-owner.mjs';
const workerName = 'locally-web-opennext-production', versionId = '22222222-2222-4222-8222-222222222222';
const override = versionOverrideHeader(workerName, versionId), bytes = Buffer.from('window.fixtureExecutions=(window.fixtureExecutions||0)+1;');
const sha = cacheDigest(bytes), url = 'http://localhost/_next/static/chunks/fixture.js';
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

for (const kind of ['etag','last-modified','vary']) test(`real Chromium ${kind}: cold200, native conditional304, cached bytes and JS execution`, {timeout:15000}, async () => {
  const calls=[], errors=[], pending=new Set(), modified=new Date(Date.now()-86400000).toUTCString();
  const server=createServer((req,res)=>{
    if(req.url==='/_next/static/chunks/fixture.js') {
      const conditional=Boolean(req.headers['if-none-match']||req.headers['if-modified-since']);
      calls.push({conditional,override:req.headers['cloudflare-workers-version-overrides'],cookie:Boolean(req.headers.cookie),auth:Boolean(req.headers.authorization)});
      res.setHeader('cache-control','public, max-age=0, must-revalidate');if(kind==='last-modified')res.setHeader('last-modified',modified);else res.setHeader('etag','"fixture"');
      if(kind==='vary')res.setHeader('vary','Accept-Language');
      res.setHeader('content-type','application/javascript');
      res.writeHead(conditional ?304:200);res.end(conditional ?undefined:bytes);return;
    }
    res.setHeader('content-type','text/html');res.end('<html><body><script src="/_next/static/chunks/fixture.js"></script></body></html>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
  const context=await browser.newContext({serviceWorkers:'block'});
  const observer=createCacheRevalidationObserver({origin,override,readAsset:async()=>bytes});
  prepareCoverageContext(context,origin,observer.watch);
  try {
    await installProductionMutationGate(context,origin,{versionOverride:{workerName,versionId,onReadResponse:observer.onReadResponse}});
    context.on('response',response=>{const p=observer.observe(response).catch(e=>errors.push({code:e.code??e.name,message:e.message})).finally(()=>pending.delete(p));pending.add(p);});
    const page=await context.newPage();await page.goto(origin,{waitUntil:'load'});
    assert.equal(await page.evaluate(()=>window.fixtureExecutions),1);
    await page.addScriptTag({url:origin+'/_next/static/chunks/fixture.js'});
    await Promise.all([...pending]);await observer.checkpoint(page);
    assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>window.fixtureExecutions),2);
    assert(calls.some(r=>!r.conditional));assert(calls.some(r=>r.conditional));
    assert.equal(observer.receipts.length,1);assert.equal(observer.receipts[0].scriptExecuted,true);
    assert(calls.every(r=>r.override===override&&!r.cookie&&!r.auth));
  }finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
});

for(const wrongArtifact of [false,true])test(`native per-request 200 body remains authoritative when Playwright body is empty (${wrongArtifact?'reject wrong artifact':'positive'})`,{timeout:15000},async()=>{
  const server=createServer((req,res)=>{
    if(req.url==='/_next/static/chunks/fixture.js'){res.writeHead(req.headers['if-none-match']?304:200,{'content-type':'application/javascript',etag:'"fixture"','cache-control':'public,max-age=0,must-revalidate'}).end(req.headers['if-none-match']?undefined:bytes);}
    else res.writeHead(200,{'content-type':'text/html'}).end('<html><body><script src="/_next/static/chunks/fixture.js"></script></body></html>');
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});const context=await browser.newContext({serviceWorkers:'block'});
  const observer=createCacheRevalidationObserver({origin,override,readAsset:async()=>wrongArtifact?Buffer.from('wrong'):bytes}),jobs=[],errors=[];let apiBodyCalls=0;
  prepareCoverageContext(context,origin,observer.watch);
  try{
    await installProductionMutationGate(context,origin,{versionOverride:{workerName,versionId,onReadResponse:observer.onReadResponse}});
    context.on('response',response=>{const simulated=new Proxy(response,{get(target,key){if(key==='body')return async()=>{apiBodyCalls++;return Buffer.alloc(0)};const value=target[key];return typeof value==='function'?value.bind(target):value;}});jobs.push(observer.observe(simulated).catch(e=>errors.push({code:e.code,stage:e.cacheStage})));});
    const page=await context.newPage();await page.goto(origin,{waitUntil:'load'});
    if(!wrongArtifact)await page.addScriptTag({url:origin+'/_next/static/chunks/fixture.js'});
    await Promise.all(jobs);
    assert.equal(apiBodyCalls,0);
    if(wrongArtifact)assert(errors.some(e=>e.code==='candidate_cache_revalidation_failed'&&e.stage==='full200-hash'));
    else{assert.deepEqual(errors,[]);await observer.checkpoint(page);assert.equal(await page.evaluate(()=>window.fixtureExecutions),2);assert.equal(observer.receipts.length,1);assert.equal(observer.receipts[0].sha256,sha);assert.equal(observer.receipts[0].scriptExecuted,true);}
  }finally{await context.close();await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});


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

for (const corrupt of [false, true]) test(`live browser200 streaming ${corrupt ? 'rejects corrupted native bytes' : 'does not depend on post-load body storage'}`, { timeout: 15000 }, async () => {
  const server = createServer((req, res) => {
    if (req.url.endsWith('.js')) res.writeHead(req.headers['if-none-match'] ? 304 : 200, { 'content-type': 'application/javascript', etag: '"fixture"', 'cache-control': 'public,max-age=0,must-revalidate' }).end(req.headers['if-none-match'] ? undefined : bytes);
    else res.writeHead(200, { 'content-type': 'text/html' }).end('<script src="/_next/static/chunks/fixture.js"></script>');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage(), cdp = await coverageOwnerFor(page, origin).ready;
  const originalSend = cdp.send.bind(cdp), originalOn = cdp.on.bind(cdp), statuses = new Map(); let firstBodyReads = 0;
  originalOn('Network.responseReceived', e => statuses.set(e.requestId, e.response.status));
  cdp.send = (method, params) => {
    if (method === 'Network.getResponseBody' && statuses.get(params.requestId) === 200) { firstBodyReads++; return Promise.resolve({ body: '', base64Encoded: false }); }
    return originalSend(method, params);
  };
  cdp.on = (event, handler) => originalOn(event, event === 'Network.dataReceived' && corrupt ? e => handler(e.data ? { ...e, data: Buffer.alloc(Buffer.from(e.data, 'base64').length, 120).toString('base64') } : e) : handler);
  const observer = createCacheRevalidationObserver({ origin, override, readAsset: async () => bytes }), jobs = [], errors = [];
  await observer.watch(page);
  try {
    await installProductionMutationGate(context, origin, { versionOverride: { workerName, versionId, onReadResponse: observer.onReadResponse } });
    context.on('response', r => jobs.push(observer.observe(r).catch(e => errors.push({ code: e.code, stage: e.cacheStage }))));
    await page.goto(origin, { waitUntil: 'load' });
    if (!corrupt) await page.addScriptTag({ url: origin + '/_next/static/chunks/fixture.js' });
    await Promise.all(jobs); assert.equal(firstBodyReads, 0);
    if (corrupt) assert(errors.some(e => e.code === 'candidate_cache_revalidation_failed' && e.stage === 'full200-hash'));
    else { assert.deepEqual(errors, []); await observer.checkpoint(page); assert.equal(observer.receipts[0].scriptExecuted, true); assert.equal(observer.receipts[0].sha256, sha); assert.equal(await page.evaluate(() => window.fixtureExecutions), 2); }
  } finally { await context.close(); await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
});

test('late304 uses the single owner final snapshot without a second coverage consumer', { timeout: 15000 }, async () => {
  const server = createServer((req, res) => {
    if (req.url.endsWith('.js')) res.writeHead(req.headers['if-none-match'] ? 304 : 200, { 'content-type': 'application/javascript', etag: '"fixture"', 'cache-control': 'public,max-age=0,must-revalidate' }).end(req.headers['if-none-match'] ? undefined : bytes);
    else res.writeHead(200, { 'content-type': 'text/html' }).end('<script src="/_next/static/chunks/fixture.js"></script>');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) }), context = await browser.newContext({ serviceWorkers: 'block' });
  const observer = createCacheRevalidationObserver({ origin, override, readAsset: async () => bytes }), jobs = [], errors = [];
  prepareCoverageContext(context, origin, observer.watch);
  try {
    await installProductionMutationGate(context, origin, { versionOverride: { workerName, versionId, onReadResponse: observer.onReadResponse } });
    context.on('response', r => jobs.push(observer.observe(r).catch(e => errors.push(e.code))));
    const page = await context.newPage(), owner = coverageOwnerFor(page, origin); await page.goto(origin, { waitUntil: 'load' }); await Promise.all(jobs); await observer.checkpoint(page);
    await page.addScriptTag({ url: origin + '/_next/static/chunks/fixture.js' }); await Promise.all(jobs);
    assert.deepEqual(errors, []); assert.equal(await page.evaluate(() => window.fixtureExecutions), 2); assert.equal(observer.receipts.length, 1); assert.equal(observer.receipts[0].scriptExecuted, false);
    await page.close(); const snapshot = owner.read(), proof = observer.receipts[0].executionProof;
    assert.equal(observer.receipts[0].scriptExecuted, true); assert.equal(proof.ownerId, snapshot.ownerId); assert.equal(proof.snapshotId, snapshot.snapshotId); assert.equal(proof.sha256, sha);
    assert.equal(snapshot.finalized, true); assert.equal(snapshot.cleanupComplete, true); assert.equal(snapshot.audit.filter(r => r.method === 'Profiler.startPreciseCoverage').length, 1);
    assert.deepEqual(snapshot.audit.filter(r => r.method === 'Profiler.takePreciseCoverage').map(r => r.caller), ['cache-gate', 'before-teardown']);
  } finally { await context.close(); await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
});
