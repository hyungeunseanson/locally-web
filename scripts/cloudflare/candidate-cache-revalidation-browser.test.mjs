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

for (const fault of ['none', 'parallel', 'unused-cached-face', 'activation-network', 'lost-native-body', 'wrong-native-body', 'wrong-current-font', 'ambiguous-font-source', 'system-fallback', 'glyph-mismatch']) test(`real decoded font304: ${fault}`, { timeout: 15000 }, async () => {
  const { readFile } = await import('node:fs/promises');
  const fontBytes = await readFile(new URL('../../app/fonts/Inter/Inter_18pt-Regular.woff2', import.meta.url));
  const path = '/_next/static/media/fixture.woff2', paths = [path, ...(fault === 'parallel' ? [1, 2, 3].map(i => '/_next/static/media/fixture' + i + '.woff2') : [])], calls = [], errors = [], jobs = [];
  const server = createServer((req, res) => {
    if (paths.includes(req.url)) {
      const warm = Boolean(req.headers['if-none-match']); calls.push({ warm, override: req.headers['cloudflare-workers-version-overrides'] });
      res.writeHead(warm ? 304 : 200, { 'content-type': 'font/woff2', etag: '"font"', 'cache-control': 'public,max-age=0,must-revalidate' }).end(warm ? undefined : fontBytes);
    } else if (req.url === '/_next/static/chunks/font.css') res.writeHead(200, { 'content-type': 'text/css' }).end(paths.map((p, i) => '@font-face{font-family:fixture' + i + ';src:url(../media/' + p.split('/').at(-1) + ')}').join(''));
    else res.writeHead(200, { 'content-type': 'text/html' }).end('<link rel="stylesheet" href="/_next/static/chunks/font.css">' + (['unused-cached-face', 'activation-network'].includes(fault) ? '<link rel="preload" as="font" crossorigin="anonymous" href="' + path + '">' : '') + paths.map((p, i) => '<span style="font-family:' + (['unused-cached-face', 'activation-network'].includes(fault) ? 'sans-serif' : 'fixture' + i) + '">Aa0123</span>').join(''));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await launch(), context = await browser.newContext({ serviceWorkers: 'block' });
  const observer = createCacheRevalidationObserver({ origin, override, readAsset: async () => fontBytes });
  prepareCoverageContext(context, origin, observer.watch);
  try {
    await installProductionMutationGate(context, origin, { versionOverride: { workerName, versionId, onReadResponse: async (proof, request) => {
      try { await observer.onReadResponse(proof, request); }
      catch (e) { errors.push({ code: e.code, stage: e.cacheStage, ...(e.cacheCaptureEvidence ? { identity: e.cacheCaptureEvidence } : {}) }); throw e; }
    } } });
    context.on('response', r => jobs.push(observer.observe(r).catch(e => errors.push({ code: e.code, stage: e.cacheStage }))));
    const page = await context.newPage(), owner = coverageOwnerFor(page, origin), cdp = await owner.ready;
    await page.goto(origin, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready); await Promise.all(jobs); assert.deepEqual(errors, []);
    if (['unused-cached-face', 'activation-network'].includes(fault)) await page.evaluate(() => {
      // Deterministically enter the unused-face API state; body, decoded font,
      // CSS source, platform glyphs and HTTP counts remain actual Chromium data.
      const status = Object.getOwnPropertyDescriptor(FontFace.prototype, 'status').get, load = FontFace.prototype.load;
      let activated = false;
      Object.defineProperty(FontFace.prototype, 'status', { configurable: true, get() { return this.family === 'fixture0' && !activated ? 'unloaded' : status.call(this); } });
      FontFace.prototype.load = function () { if (this.family === 'fixture0') activated = true; return load.call(this); };
    });
    const send = cdp.send.bind(cdp), statuses = new Map();
    cdp.on('Network.responseReceived', e => statuses.set(e.requestId, e.response.status));
    // Exercise the decoded FontResource path explicitly. Its predecessor body
    // and renderer proof still come from the real browser, not injected bytes.
    if (!fault.includes('native-body')) cdp.send = (method, params) => {
      if (method === 'Network.getResponseBody' && statuses.get(params.requestId) === 304) return Promise.reject(new Error('No data found for resource with given identifier'));
      return send(method, params);
    };
    if (fault.includes('native-body')) cdp.send = (method, params) => {
      if (method === 'Network.getResponseBody') {
        if (fault === 'lost-native-body') return Promise.reject(new Error('missing native predecessor'));
        return Promise.resolve({ body: Buffer.alloc(fontBytes.length, 1).toString('base64'), base64Encoded: true });
      }
      return send(method, params);
    };
    if (['system-fallback', 'glyph-mismatch'].includes(fault)) cdp.send = async (method, params) => {
      if (method === 'Network.getResponseBody' && statuses.get(params.requestId) === 304) throw new Error('No data found for resource with given identifier');
      const result = await send(method, params);
      if (method === 'CSS.getPlatformFontsForNode') return { fonts: result.fonts.map(f => ({ ...f, ...(fault === 'system-fallback' ? { isCustomFont: false } : { glyphCount: 0 }) })) };
      return result;
    };
    if (fault === 'wrong-current-font') await page.evaluate(() => { document.styleSheets[0].cssRules[0].style.setProperty('src', 'local("Arial")'); });
    if (fault === 'ambiguous-font-source') await page.evaluate(path => { document.styleSheets[0].cssRules[0].style.setProperty('src', 'url(' + path + '),local("Arial")'); }, path);
    if (fault === 'activation-network') await page.evaluate(path => { const load = FontFace.prototype.load; FontFace.prototype.load = async function () { if (this.family === 'fixture0' && this.status === 'unloaded') await (await fetch(path, { cache: 'no-store' })).arrayBuffer(); return load.call(this); }; }, path);
    // Force the local conditional experiment after the proven native200. A missing
    // cached FontResource/body still fails; never retry a cold load into a PASS.
    await context.setExtraHTTPHeaders({ 'If-None-Match': '"font"' });
    // Await each actual terminal notification before draining response jobs.
    // FontFace.load resolves on the renderer channel; PW response events can
    // follow it. A snapshot taken earlier can miss the negative proof entirely.
    const terminals = paths.map(path => new Promise(resolve => {
      const cleanup = () => { page.off('response', response); page.off('requestfailed', failed); };
      const response = r => { if (r.url() === origin + path && r.status() === 304) { cleanup(); resolve(); } };
      const failed = r => { if (r.url() === origin + path) { cleanup(); resolve(); } };
      page.on('response', response); page.on('requestfailed', failed);
    }));
    try {
      await page.evaluate(async paths => { await Promise.all(paths.map(async (path, i) => { const f = new FontFace('trigger' + i, 'url(' + path + ')'); document.fonts.add(f); await f.load(); })); }, paths.map(p => origin + p));
    } catch (error) {
      // A negative can also reject the native FontFace. It only passes this
      // control if the cache observer independently records a failed proof.
      if (['none', 'parallel', 'unused-cached-face'].includes(fault)) throw error;
    }
    await Promise.all(terminals); await Promise.all(jobs);
    assert.equal(calls.length, paths.length * 2 + (fault === 'activation-network' ? 1 : 0)); assert.deepEqual(calls.map(r => r.warm), [...paths.map(() => false), ...paths.map(() => true), ...(fault === 'activation-network' ? [true] : [])]); assert(calls.every(r => r.override === override));
    if (['none', 'parallel', 'unused-cached-face'].includes(fault)) {
      assert.deepEqual(errors, []);
      assert.equal(observer.receipts.length, paths.length); await observer.checkpoint(page);
      const receipt = observer.receipts[0]; assert.equal(receipt.representationKind, 'font'); assert.equal(receipt.scriptExecuted, false);
      assert.equal(receipt.sha256, cacheDigest(fontBytes)); assert.equal(receipt.fontProof.rendered, true); assert.equal(receipt.fontProof.glyphCount, 6);
      assert.equal(receipt.fontProof.provenance, 'native-predecessor-body-and-current-decoded-font'); assert.equal(receipt.fontProof.additionalHTTPReads, 0);
      if (fault === 'unused-cached-face') assert.equal(receipt.fontProof.cachedFaceActivated, true);
      await page.close(); assert.equal(owner.read().cleanupComplete, true);
    } else { assert(errors.length > 0 || observer.diagnostics().some(e => e.nativeError === 'candidate_cache_revalidation_failed'), 'actual font proof failure must never PASS'); if (fault === 'activation-network') assert(errors.some(e => e.stage === 'font-probe-network-read')); }
  } finally { await context.close(); await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
});

for (const corrupt of [false, true]) test(`fulfilled font200 crossing page close ${corrupt ? 'keeps corrupt native proof FAIL' : 'finishes native proof before owner detaches'}`, { timeout: 15000 }, async () => {
  const { readFile } = await import('node:fs/promises');
  const fontBytes = await readFile(new URL('../../app/fonts/Inter/Inter_18pt-Regular.woff2', import.meta.url));
  let release; const held = new Promise(r => { release = r; });
  const server = createServer(async (req, res) => {
    if (req.url.endsWith('.woff2')) { await held; res.writeHead(200, { 'content-type': 'font/woff2', etag: '"font"' }).end(fontBytes); }
    else res.writeHead(200, { 'content-type': 'text/html' }).end('<style>@font-face{font-family:fixture;src:url(/_next/static/media/fixture.woff2)}span{font-family:fixture}</style><span>Aa0123</span>');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await launch(), context = await browser.newContext({ serviceWorkers: 'block' });
  const observer = createCacheRevalidationObserver({ origin, override, readAsset: async () => fontBytes }), jobs = [], errors = [];
  prepareCoverageContext(context, origin, observer.watch);
  let resolveClosed; const closed = new Promise(r => { resolveClosed = r; });
  try {
    await installProductionMutationGate(context, origin, { versionOverride: { workerName, versionId, onReadResponse: async (proof, request) => {
      await observer.onReadResponse(proof, request);
      if (request.resourceType() === 'font') request.frame().page().close().then(() => resolveClosed(null), e => resolveClosed(e));
    } } });
    context.on('response', r => jobs.push(observer.observe(r).catch(e => errors.push(e))));
    const page = await context.newPage(), owner = coverageOwnerFor(page, origin), cdp = await owner.ready, send = cdp.send.bind(cdp);
    if (corrupt) cdp.send = (method, params) => method === 'Network.getResponseBody'
      ? Promise.resolve({ body: Buffer.alloc(fontBytes.length, 1).toString('base64'), base64Encoded: true }) : send(method, params);
    await page.goto(origin, { waitUntil: 'domcontentloaded' }); release();
    const error = await closed; await Promise.all(jobs);
    if (corrupt) { assert.equal(error.code, 'candidate_cache_revalidation_failed'); assert(errors.some(e => e.cacheStage === 'full200-hash')); }
    else { assert.equal(error, null); assert.deepEqual(errors, []); }
    assert.equal(page.isClosed(), true); assert.equal(owner.read().cleanupComplete, true);
  } finally { release(); await context.close(); await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
});
