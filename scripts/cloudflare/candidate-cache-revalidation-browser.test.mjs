import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { chromium } from '@playwright/test';
import { cacheDigest, createCacheRevalidationObserver } from './candidate-cache-revalidation.mjs';
import { installProductionMutationGate } from './run-production-browser-smoke.mjs';
import { versionOverrideHeader } from './candidate-release-contract.mjs';
import { coverageOwnerFor, prepareCoverageContext } from './candidate-coverage-owner.mjs';
import { verifyPinnedReleaseBrowser } from './verify-pinned-release-browser.mjs';
// Native304 integration belongs to the actual release browser, not a fallback.
const identity = verifyPinnedReleaseBrowser(process.env.PLAYWRIGHT_EXECUTABLE_PATH);
identity.catch(() => {});
const launch = async () => { await identity; return chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }); };
const workerName = 'locally-web-opennext-production', versionId = '22222222-2222-4222-8222-222222222222';
const override = versionOverrideHeader(workerName, versionId), bytes = Buffer.from('window.fixtureExecutions=(window.fixtureExecutions||0)+1;');
const sha = cacheDigest(bytes);
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
  const browser=await launch();
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
  const browser=await launch();const context=await browser.newContext({serviceWorkers:'block'});
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


for (const corrupt of [false, true]) test(`live browser200 streaming ${corrupt ? 'rejects corrupted native bytes' : 'does not depend on post-load body storage'}`, { timeout: 15000 }, async () => {
  const server = createServer((req, res) => {
    if (req.url.endsWith('.js')) res.writeHead(req.headers['if-none-match'] ? 304 : 200, { 'content-type': 'application/javascript', etag: '"fixture"', 'cache-control': 'public,max-age=0,must-revalidate' }).end(req.headers['if-none-match'] ? undefined : bytes);
    else res.writeHead(200, { 'content-type': 'text/html' }).end('<script src="/_next/static/chunks/fixture.js"></script>');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await launch();
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
  const browser = await launch(), context = await browser.newContext({ serviceWorkers: 'block' });
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
