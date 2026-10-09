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

function fontFixture() {
  const f = fixture();
  for (const row of [f.previous, f.current]) {
    row.url = 'http://localhost/_next/static/media/fixture.woff2'; row.resourceType = 'font';
    row.nativeIdentity = { ownerId: 'one', targetId: 'target', generation: 1, frameId: 'frame', requestId: row.status === 200 ? 'first' : 'second' };
  }
  f.previous.responseHeaders.set('content-type', 'font/woff2'); f.current.nativeIdentity.predecessorId = 'first';
  return f;
}
test('font304 requires native predecessor lineage as well as every existing cache validator', () => {
  const f = fontFixture(), receipt = validateCachedResponse(f.previous, f.current, override);
  assert.equal(receipt.representationKind, 'font'); assert.equal(receipt.scriptExecuted, false);
});
for (const [name, mutate] of Object.entries({
  cold: f => { f.previous = null; },
  'wrong native request': f => { f.current.nativeIdentity.predecessorId = 'other'; },
  'same request': f => { f.current.nativeIdentity.requestId = 'first'; },
  'wrong frame': f => { f.current.nativeIdentity.frameId = 'other'; },
  'wrong target': f => { f.current.nativeIdentity.targetId = 'other'; },
  'wrong generation': f => { f.current.nativeIdentity.generation++; },
  'wrong owner': f => { f.current.nativeIdentity.ownerId = 'other'; },
  'missing native identity': f => { delete f.previous.nativeIdentity; },
  'wrong 304 MIME': f => { f.current.responseHeaders.set('content-type', 'text/html'); },
  'wrong MIME': f => { f.previous.responseHeaders.set('content-type', 'text/html'); },
  'wrong validator': f => { f.current.requestHeaders.set('if-none-match', '"wrong"'); },
  'wrong cached SHA': f => { f.current.browserSHA256 = 'a'.repeat(64); },
  'wrong bytes': f => { f.current.browserBytes++; },
  'wrong artifact': f => { f.current.localSHA256 = 'a'.repeat(64); },
  cookie: f => { f.current.requestHeaders.set('cookie', 'forbidden'); },
  authorization: f => { f.current.requestHeaders.set('authorization', 'forbidden'); },
  'wrong version': f => { f.current.requestHeaders.set('cloudflare-workers-version-overrides', 'other'); },
  'wrong encoding': f => { f.current.responseHeaders.set('content-encoding', 'gzip'); },
  'wrong Vary': f => { f.current.responseHeaders.set('vary', 'Accept-Language'); },
  query: f => { f.current.url += '?anything=1'; },
  'nonzero 304 body': f => { f.current.networkBytes = 1; },
})) test(`font304 rejects ${name}`, () => { const f = fontFixture(); mutate(f); assert.throws(() => validateCachedResponse(f.previous, f.current, override), { code: 'candidate_cache_revalidation_failed' }); });

for (const fault of ['system-font', 'zero-glyphs', 'different-face', 'additional-read', 'changed-document']) test(`decoded font probe independently rejects ${fault}`, async () => {
  const { proveCachedFont } = await import('./candidate-cache-revalidation-font.mjs');
  const identity = { ownerId: 'one', targetId: 'target', generation: 1, frameId: 'frame', requestId: 'second', predecessorId: 'first' };
  let evaluations = 0, snapshots = 0, readCounts = 0, glyphReads = 0;
  const page = { isClosed: () => false, evaluate: async () => { evaluations++; return { loaded: true, sourceURLMatches: true }; } };
  const owner = { read: () => ({ targetId: fault === 'changed-document' && snapshots++ > 0 ? 'other' : 'target', generation: 1, finalized: false }) };
  const cdp = { send: async method => {
    if (method === 'DOM.getDocument') return { root: { nodeId: 1 } };
    if (method === 'DOM.querySelector') return { nodeId: 2 };
    if (method === 'CSS.getPlatformFontsForNode') return { fonts: [{ familyName: fault === 'different-face' && glyphReads++ > 0 ? 'other' : 'fixture', postScriptName: 'fixture', glyphCount: fault === 'zero-glyphs' ? 0 : 6, isCustomFont: fault !== 'system-font' }] };
    return {};
  } };
  await assert.rejects(proveCachedFont({ page, cdp, owner, url: 'http://localhost/_next/static/media/fixture.woff2', bytes,
    identity, readCount: () => fault === 'additional-read' ? readCounts++ : 0 }), { code: 'candidate_cache_revalidation_failed' });
  assert.equal(evaluations, 2, 'even a rejected proof must remove its transient face/probes');
});

for (const delayed of [false, true]) test(`native request identity waits for its actual CDP event (${delayed})`, async () => {
  const { awaitNativeStream } = await import('./candidate-cache-revalidation.mjs');
  const state = { streams: new Map(), requestWaiters: new Set() }, row = { url: 'https://fixture.test/a', requestId: 'native-1', claimed: false };
  if (!delayed) state.streams.set(row.requestId, row);
  const waiting = awaitNativeStream(state, row.url);
  if (delayed) queueMicrotask(() => { state.streams.set(row.requestId, row); for (const notify of [...state.requestWaiters]) notify(); });
  assert.deepEqual(await waiting, [row]); assert.equal(state.requestWaiters.size, 0);
});
test('native request identity never chooses among ambiguous native events', async () => {
  const { awaitNativeStream } = await import('./candidate-cache-revalidation.mjs');
  const state = { streams: new Map(), requestWaiters: new Set() };
  for (const requestId of ['one', 'two']) state.streams.set(requestId, { url: 'https://fixture.test/a', requestId });
  assert.equal((await awaitNativeStream(state, 'https://fixture.test/a')).length, 2);
});
test('missing native event still fails within the original capture budget and cleans up', async () => {
  const { awaitNativeStream } = await import('./candidate-cache-revalidation.mjs');
  const state = { streams: new Map(), requestWaiters: new Set() };
  await assert.rejects(awaitNativeStream(state, 'https://fixture.test/a'), e => e.code === 'candidate_cache_revalidation_failed' && e.cacheStage === 'native-stream-request-event');
  assert.equal(state.requestWaiters.size, 0);
});
