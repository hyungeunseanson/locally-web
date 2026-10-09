import { createHash } from 'node:crypto';
import { CandidateReleaseBlocked } from './candidate-release-contract.mjs';
import { coverageOwnerFor } from './candidate-coverage-owner.mjs';

export const cacheDigest = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = (stage = 'cache-proof') => { const error = new CandidateReleaseBlocked('candidate_cache_revalidation_failed'); error.cacheStage = stage; throw error; };
const requireProof = (value, stage) => { if (!value) fail(stage); };
const etag = value => /^(?:W\/)?"[^"\r\n]+"$/.test(value ?? '') ? value.replace(/^W\//, '') : null;
const vary = headers => (headers.get('vary') ?? '').toLowerCase().split(',').map(v => v.trim()).filter(Boolean).sort();

// Deliberately narrow: only observed, query-free Next JS GETs can reuse cache.
// API/RSC, HEAD without browser bytes, and ambiguous validators fail closed.
export function validateCachedResponse(previous, current, override) {
  requireProof(previous && current, 'missing-representation');
  const url = new URL(current.url);
  requireProof(/^\/_next\/static\/chunks\/[\w.-]+\.js$/.test(url.pathname) && !url.search && !url.hash);
  requireProof(current.method === 'GET' && current.resourceType === 'script' && current.status === 304);
  requireProof(previous.url === current.url && previous.status === 200 && previous.method === 'GET');
  for (const row of [previous, current]) {
    requireProof(row.requestHeaders.get('cloudflare-workers-version-overrides') === override, 'version-override');
    requireProof(!row.requestHeaders.has('cookie') && !row.requestHeaders.has('authorization'));
    requireProof(!row.responseHeaders.has('location') && !row.redirected && row.finished);
    requireProof(!/\bno-store\b/i.test(row.responseHeaders.get('cache-control') ?? ''));
  }
  const beforeVary = vary(previous.responseHeaders), afterVary = vary(current.responseHeaders);
  requireProof(!beforeVary.some(v => ['*', 'cookie', 'authorization'].includes(v)), 'unsafe-vary');
  // A 304 may omit representation metadata; if present it must agree.
  requireProof(!current.responseHeaders.has('vary') || JSON.stringify(beforeVary) === JSON.stringify(afterVary), 'vary-response');
  for (const name of new Set([...beforeVary, 'accept-encoding'])) {
    requireProof(previous.requestHeaders.get(name) === current.requestHeaders.get(name), 'vary-request');
  }
  requireProof(!current.responseHeaders.has('content-encoding') || current.responseHeaders.get('content-encoding') === previous.responseHeaders.get('content-encoding'), 'encoding');
  const inm = current.requestHeaders.get('if-none-match'), ims = current.requestHeaders.get('if-modified-since');
  if (inm !== null) {
    const tag = etag(inm);
    // GET uses weak ETag comparison (RFC 9110). This alone is insufficient:
    // exact cached browser bytes, candidate artifact and executed JS are mandatory.
    requireProof(tag && tag === etag(previous.responseHeaders.get('etag')) && tag === etag(current.responseHeaders.get('etag')), 'etag');
  } else {
    const modified = previous.responseHeaders.get('last-modified');
    const date = previous.responseHeaders.get('date'), now = current.responseHeaders.get('date');
    requireProof(ims && ims === modified && current.responseHeaders.get('last-modified') === modified);
    requireProof(Number.isFinite(Date.parse(ims)) && Date.parse(date) >= Date.parse(ims) + 60000 && Date.parse(now) >= Date.parse(date));
    requireProof(!previous.responseHeaders.has('etag') && !current.responseHeaders.has('etag'));
  }
  requireProof(current.networkBytes === 0 && previous.networkBytes > 0 && previous.browserBytes === previous.networkBytes, 'network-body');
  requireProof(previous.networkSHA256 === previous.localSHA256 && previous.browserSHA256 === previous.localSHA256, 'previous-hash');
  requireProof(current.browserBytes === previous.browserBytes && current.browserSHA256 === previous.localSHA256 && current.localSHA256 === previous.localSHA256, 'cached-hash');
  return { pathname: url.pathname, status: 304, networkBodyBytes: 0, sha256: previous.localSHA256,
    validatorKind: inm !== null ? 'etag' : 'last-modified', validatorFingerprint: cacheDigest(inm ?? ims),
    validatedCachedRepresentation: true, browserFinished: true, scriptExecuted: false };
}

// Chromium may announce loadingFinished before its decoded dataReceived events.
// Read native bytes once both facts exist; no polling, retry or Node-body fallback.
export function nativeBodyLatch(expectedBytes, readBody, resolve, reject) {
  let received = 0, finished = false, read = false;
  const check = () => {
    if (received > expectedBytes) { if (!read) { read = true; reject(new CandidateReleaseBlocked('candidate_cache_revalidation_failed')); } return; }
    if (!read && finished && received === expectedBytes) { read = true; Promise.resolve().then(readBody).then(resolve, reject); }
  };
  return { data: bytes => { received += bytes; check(); }, finish: () => { finished = true; check(); }, read: () => ({ received, finished, read }) };
}

// All private headers and cache provenance are scoped to ONE anonymous context
// and candidate. Only sanitized receipts escape this collector.
export function createCacheRevalidationObserver({ origin, override, readAsset }) {
  const wire = new WeakMap(), pages = new WeakMap(), cached = new Map(), receipts = [], pageOwners = new Set(), states = new Set(), expectations = new WeakMap(), networkLengths = new Map();
  function watch(page) {
    if (pages.has(page)) return pages.get(page).ready;
    const owner = coverageOwnerFor(page, origin);
    pageOwners.add(owner);
    const state = { owner, receipts: [], expectations: [], network: new Map(), terminals: new Map(), streams: new Map() };
    pages.set(page, state); states.add(state);
    state.ready = (async () => {
      const cdp = await owner.ready;
      state.cdp = cdp;
      // Late responses can complete after the page checkpoint, while the
      // existing owner is taking its final before-teardown snapshot. Read that
      // same accumulated stream; never take a competing Profiler snapshot.
      owner.subscribe(snapshot => {
        for (const row of state.receipts) {
          if (row.receipt.scriptExecuted || row.generation !== snapshot.generation) continue;
          const proof = owner.prove(row.url, row.receipt.sha256);
          if (proof) { row.receipt.scriptExecuted = true; row.receipt.executionProof = proof; }
        }
      });
      cdp.on('Network.requestWillBeSent', event => {
        const url = new URL(event.request.url);
        if (url.origin !== origin || event.type !== 'Script' || !/^\/_next\/static\/chunks\/[\w.-]+\.js$/.test(url.pathname) || url.search) return;
        const stream = { url: event.request.url, requestId: event.requestId, chunks: [], size: 0, claimed: false };
        state.streams.set(event.requestId, stream);
        stream.ready = cdp.send('Network.streamResourceContent', { requestId: event.requestId }).then(result => {
          const buffered = Buffer.from(result.bufferedData ?? '', 'base64');
          stream.size += buffered.length; stream.chunks.unshift(buffered);
          requireProof(stream.size <= 16 * 1024 * 1024, 'native-stream-limit');
        });
        stream.ready.catch(() => {});
      });
      cdp.on('Network.responseReceived', event => {
        const candidates = state.expectations.filter(row => !row.requestId && row.url === event.response.url && row.status === event.response.status);
        if (candidates.length > 1) { for (const row of candidates) row.reject(new CandidateReleaseBlocked('candidate_cache_revalidation_failed')); return; }
        const expected = candidates[0];
        if (expected) {
          if (expected.stream.requestId !== event.requestId) { expected.reject(new CandidateReleaseBlocked('candidate_cache_revalidation_failed')); return; }
          expected.requestId = event.requestId;
          state.network.set(event.requestId, expected);
          expected.latch = nativeBodyLatch(expected.expectedBytes, async () => {
            if (expected.status === 200) {
              await expected.stream.ready;
              // Capture actual browser data before renderer resource reuse can
              // replace getResponseBody's storage with an empty representation.
              requireProof(expected.stream.size <= 16 * 1024 * 1024, 'native-stream-limit');
              return Buffer.concat(expected.stream.chunks);
            }
            const result = await cdp.send('Network.getResponseBody', { requestId: event.requestId });
            return Buffer.from(result.body, result.base64Encoded ? 'base64' : 'utf8');
          }, expected.resolve, expected.reject);
          const terminal = state.terminals.get(event.requestId);
          if (terminal) { expected.latch.data(terminal.bytes); if (terminal.finished) expected.latch.finish(); }
        }
      });
      cdp.on('Network.dataReceived', event => {
        const stream = state.streams.get(event.requestId);
        if (stream && event.data !== undefined) {
          const bytes = Buffer.from(event.data, 'base64'); stream.size += bytes.length;
          if (stream.size <= 16 * 1024 * 1024) stream.chunks.push(bytes);
        }
        const terminal = state.terminals.get(event.requestId) ?? { bytes: 0, finished: false };
        terminal.bytes += event.dataLength; state.terminals.set(event.requestId, terminal);
        state.network.get(event.requestId)?.latch.data(event.dataLength);
      });
      cdp.on('Network.loadingFinished', event => {
        const terminal = state.terminals.get(event.requestId) ?? { bytes: 0, finished: false };
        terminal.finished = true; state.terminals.set(event.requestId, terminal);
        state.network.get(event.requestId)?.latch.finish();
      });
      cdp.on('Network.loadingFailed', event => {
        // A failed request is never an active identity for a later browser
        // request. Its original requestfailed event remains a mandatory FAIL.
        const stream = state.streams.get(event.requestId); if (stream) stream.failed = true;
        state.network.get(event.requestId)?.reject(new CandidateReleaseBlocked('candidate_cache_revalidation_failed'));
      });
      await cdp.send('Network.enable');
    })();
    return state.ready;
  }
  async function onReadResponse(proof, request) {
    const page = request.frame().page();
    // Block first document fulfill until coverage starts; cache proof must not
    // rely on enabling Profiler after the application has already executed.
    await watch(page);
    if (!new URL(proof.url).pathname.startsWith('/_next/static/')) return;
    if ((proof.status === 200 || proof.status === 304) && request.resourceType() === 'script' && /^\/_next\/static\/chunks\/[\w.-]+\.js$/.test(new URL(proof.url).pathname)) {
      if (proof.status === 200) networkLengths.set(proof.url, proof.networkBytes);
      const expectedBytes = networkLengths.get(proof.url);
      requireProof(Number.isInteger(expectedBytes), 'missing-network-predecessor');
      const candidates = [...pages.get(page).streams.values()].filter(row => row.url === proof.url && !row.claimed && !row.failed);
      requireProof(candidates.length === 1, 'native-stream-request-identity');
      const stream = candidates[0]; stream.claimed = true;
      // Register streaming while the route is paused, before fulfill emits data.
      await stream.ready;
      const expected = { url: proof.url, status: proof.status, expectedBytes, stream, stage: 'await-response' };
      expectations.set(request, expected);
      proof.browserGeneration = pages.get(page).owner.read().generation;
      proof.browserBody = new Promise((resolve, reject) => { expected.resolve = resolve; expected.reject = reject; });
      // The response observer consumes this promise; retain fail-closed errors
      // without an unhandled rejection if the page closes before a response.
      proof.browserBody.then(bytes => { expected.nativeBodyBytes = bytes.length; }, error => { expected.nativeError = error.code ?? error.name; });
      pages.get(page).expectations.push(expected);
    }
    wire.set(request, proof);
  }
  async function observe(response) {
    const request = response.request(), url = new URL(request.url());
    if (url.origin !== origin) return;
    const status = response.status(), proof = wire.get(request);
    if (status !== 304 && !(status === 200 && proof && request.resourceType() === 'script' && /^\/_next\/static\/chunks\/[\w.-]+\.js$/.test(url.pathname) && !url.search)) return;
    if (status === 304 && (!proof || request.resourceType() !== 'script')) fail();
    const page = request.frame().page(), state = pages.get(page);
    requireProof(state);
    const predecessors = [...(cached.get(request.url()) ?? [])];
    const expected = expectations.get(request);
    const progress = stage => { if (expected) expected.stage = stage; };
    const capture = (async () => {
      progress('response-finished');
      const finished = await response.finished();
      requireProof(finished === null, 'response-finished');
      // First200 uses live native CDP bytes; cached304 uses the browser's
      // native cached representation. Both require terminal events and exact
      // byte/hash agreement. Never substitute Node or artifact bytes.
      requireProof(proof.browserBody, 'native-browser-body-missing');
      progress('native-body');
      const bytes = await proof.browserBody;
      progress('local-asset');
      const local = await readAsset(url.pathname);
      const row = { ...proof, requestHeaders: new Headers(proof.requestHeaders), responseHeaders: new Headers(proof.responseHeaders),
        finished: true, redirected: Boolean(request.redirectedFrom()), browserBytes: bytes.length,
        browserSHA256: cacheDigest(bytes), localSHA256: cacheDigest(local) };
      if (status === 200) {
        if (!(row.networkSHA256 === row.localSHA256 && row.browserSHA256 === row.localSHA256 && row.browserBytes === row.networkBytes)) {
          const error = new CandidateReleaseBlocked('candidate_cache_revalidation_failed');
          error.cacheStage = 'full200-hash';
          error.cacheBytes = { networkSHA256: row.networkSHA256, browserSHA256: row.browserSHA256, localSHA256: row.localSHA256, networkBytes: row.networkBytes, browserBytes: row.browserBytes };
          throw error;
        }
        progress('complete'); return row;
      }
      progress('predecessors');
      const prior = await Promise.all(predecessors);
      const matching = prior.filter(p => p.browserSHA256 === row.browserSHA256);
      requireProof(matching.length > 0, 'missing-browser-cached-representation');
      // Every potentially corresponding representation must validate, rather
      // than picking a convenient matching entry from an ambiguous cache.
      const validated = matching.map(p => validateCachedResponse(p, row, override));
      const receipt = validated[0];
      receipts.push(receipt); state.receipts.push({ url: request.url(), receipt, generation: proof.browserGeneration });
      progress('complete'); return row;
    })();
    if (status === 200) {
      const rows = cached.get(request.url()) ?? []; rows.push(capture); cached.set(request.url(), rows);
    }
    return capture;
  }
  async function checkpoint(page) {
    const state = pages.get(page);
    if (!state) return;
    await state.ready;
    const snapshot = await state.owner.collect('cache-gate');
    for (const { url, receipt, generation } of state.receipts) {
      if (receipt.scriptExecuted) continue;
      const proof = generation === snapshot.generation && state.owner.prove(url, receipt.sha256);
      if (!proof) {
        const error = new CandidateReleaseBlocked('candidate_cache_revalidation_failed');
        error.coverageEvidence = { pathname: receipt.pathname, sha256: receipt.sha256, stage: 'script-execution-checkpoint', owner: state.owner.read() };
        throw error;
      }
      receipt.scriptExecuted = true; receipt.executionProof = proof;
    }
  }
  return { watch, onReadResponse, observe, checkpoint, receipts, diagnostics: () => [...states].flatMap(s => s.expectations.filter(e => e.stage !== 'complete').map(e => ({ ownerId: s.owner.ownerId, pathname: new URL(e.url).pathname, status: e.status, stage: e.stage, expectedBytes: e.expectedBytes, requestId: e.requestId, latch: e.latch?.read(), streamBytes: e.stream.size, nativeBodyBytes: e.nativeBodyBytes, nativeError: e.nativeError }))), coverageEvidence: () => [...pageOwners].map(o => o.read()) };
}
