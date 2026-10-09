import { createHash } from 'node:crypto';
import { CandidateReleaseBlocked } from './candidate-release-contract.mjs';
import { isFontCachePath, assertFontLineage, proveCachedFont } from './candidate-cache-revalidation-font.mjs';
import { coverageOwnerFor } from './candidate-coverage-owner.mjs';

export const cacheDigest = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = (stage = 'cache-proof') => { const error = new CandidateReleaseBlocked('candidate_cache_revalidation_failed'); error.cacheStage = stage; throw error; };
const requireProof = (value, stage) => { if (!value) fail(stage); };
const etag = value => /^(?:W\/)?"[^"\r\n]+"$/.test(value ?? '') ? value.replace(/^W\//, '') : null;
const vary = headers => (headers.get('vary') ?? '').toLowerCase().split(',').map(v => v.trim()).filter(Boolean).sort();

// Deliberately narrow: query-free Next JS or native-proven WOFF2 GETs only.
// API/RSC, HEAD without browser bytes, and ambiguous validators fail closed.
export function validateCachedResponse(previous, current, override) {
  requireProof(previous && current, 'missing-representation');
  const url = new URL(current.url);
  const font = current.resourceType === 'font' && isFontCachePath(url);
  requireProof(font || (current.resourceType === 'script' && /^\/_next\/static\/chunks\/[\w.-]+\.js$/.test(url.pathname) && !url.search && !url.hash));
  requireProof(current.method === 'GET' && current.status === 304);
  requireProof(previous.resourceType === current.resourceType);
  if (font) {
    assertFontLineage(previous, current);
    requireProof(/^font\/woff2(?:;|$)/i.test(previous.responseHeaders.get('content-type') ?? '')
      && (!current.responseHeaders.has('content-type') || current.responseHeaders.get('content-type') === previous.responseHeaders.get('content-type')), 'font-mime');
  }
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
    validatedCachedRepresentation: true, browserFinished: true, representationKind: font ? 'font' : 'script', scriptExecuted: false };
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

// Playwright interception and CDP Network events arrive on separate channels.
// Await the first matching native event once, inside the existing capture budget;
// never replay HTTP, invent an identity, or choose among ambiguous requests.
export async function awaitNativeStream(state, url) {
  const candidates = () => [...state.streams.values()].filter(row => row.url === url && !row.claimed && !row.failed);
  if (candidates().length === 0) {
    await new Promise((resolve, reject) => {
      let timer;
      const done = error => { clearTimeout(timer); state.requestWaiters.delete(check); if (error) reject(error); else resolve(); };
      const check = error => { if (error || candidates().length > 0) done(error); };
      state.requestWaiters.add(check);
      timer = setTimeout(() => { const error = new CandidateReleaseBlocked('candidate_cache_revalidation_failed'); error.cacheStage = 'native-stream-request-event'; done(error); }, 1000);
      check();
    });
  }
  return candidates();
}

// All private headers and cache provenance are scoped to ONE anonymous context
// and candidate. Only sanitized receipts escape this collector.
export function createCacheRevalidationObserver({ origin, override, readAsset }) {
  const wire = new WeakMap(), pages = new WeakMap(), cached = new Map(), receipts = [], pageOwners = new Set(), states = new Set(), expectations = new WeakMap(), networkLengths = new Map();
  function watch(page) {
    if (pages.has(page)) return pages.get(page).ready;
    const owner = coverageOwnerFor(page, origin);
    pageOwners.add(owner);
    const state = { owner, requestWaiters: new Set(), fontProofQueue: Promise.resolve(), reads: new Map(), receipts: [], expectations: [], network: new Map(), terminals: new Map(), streams: new Map() };
    pages.set(page, state); states.add(state);
    const close = page.close.bind(page);
    page.close = async (...args) => {
      let timer;
      try {
        // A fulfilled static response can reach Network/PW listeners during the
        // owner's final snapshot. Preserve its already registered native proof
        // before detaching CDP. Use the existing 1s capture budget, not a new
        // navigation timeout or a retry. Every incomplete/failed proof still FAILs.
        await Promise.race([Promise.all(state.expectations.map(e => e.completion)),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new CandidateReleaseBlocked('candidate_capture_timeout')), 1000); })]);
      } finally { clearTimeout(timer); await close(...args); }
    };
    state.ready = (async () => {
      const cdp = await owner.ready;
      state.cdp = cdp;
      // Late responses can complete after the page checkpoint, while the
      // existing owner is taking its final before-teardown snapshot. Read that
      // same accumulated stream; never take a competing Profiler snapshot.
      owner.subscribe(snapshot => {
        for (const row of state.receipts) {
          if (row.receipt.representationKind === 'font' || row.receipt.scriptExecuted || row.generation !== snapshot.generation) continue;
          const proof = owner.prove(row.url, row.receipt.sha256);
          if (proof) { row.receipt.scriptExecuted = true; row.receipt.executionProof = proof; }
        }
      });
      cdp.on('Network.requestWillBeSent', event => {
        const url = new URL(event.request.url);
        const font = event.type === 'Font' && isFontCachePath(url);
        if (url.origin !== origin || (!font && (event.type !== 'Script' || !/^\/_next\/static\/chunks\/[\w.-]+\.js$/.test(url.pathname) || url.search))) return;
        const stream = { url: event.request.url, requestId: event.requestId, chunks: [], size: 0, claimed: false, frameId: event.frameId, font };
        state.streams.set(event.requestId, stream);
        for (const notify of [...state.requestWaiters]) notify();
        stream.ready = font ? Promise.resolve() : cdp.send('Network.streamResourceContent', { requestId: event.requestId }).then(result => {
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
            if (expected.status === 200 && !expected.stream.font) {
              await expected.stream.ready;
              // Capture actual browser data before renderer resource reuse can
              // replace getResponseBody's storage with an empty representation.
              requireProof(expected.stream.size <= 16 * 1024 * 1024, 'native-stream-limit');
              return Buffer.concat(expected.stream.chunks);
            }
            let result;
            try {
              result = await cdp.send('Network.getResponseBody', { requestId: event.requestId });
              expected.proof.nativeBodyProvenance = 'current-native-response-body';
            } catch (error) {
              // Only decoded FontResource's specific native storage error can
              // use its freshly read predecessor plus current renderer proof.
              if (!expected.stream.font || expected.status !== 304
                || !error.message.includes('No data found for resource with given identifier')) throw error;
              result = await cdp.send('Network.getResponseBody', { requestId: expected.predecessorId });
              expected.proof.nativeBodyProvenance = 'native-predecessor-body-and-current-decoded-font';
            }
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
        const expected = [...state.expectations].find(e => e.stream.requestId === event.requestId);
        const error = new CandidateReleaseBlocked('candidate_cache_revalidation_failed');
        expected?.reject(error); expected?.rejectCompletion(error);
      });
      page.once('close', () => { for (const notify of [...state.requestWaiters]) notify(new CandidateReleaseBlocked('candidate_cache_revalidation_failed')); });
      await cdp.send('Network.enable');
    })();
    return state.ready;
  }
  async function onReadResponse(proof, request) {
    const page = request.frame().page();
    // Block first document fulfill until coverage starts; cache proof must not
    // rely on enabling Profiler after the application has already executed.
    await watch(page);
    const reads = pages.get(page).reads; reads.set(proof.url, (reads.get(proof.url) ?? 0) + 1);
    if (!new URL(proof.url).pathname.startsWith('/_next/static/')) return;
    if ((proof.status === 200 || proof.status === 304) && ((request.resourceType() === 'script' && /^\/_next\/static\/chunks\/[\w.-]+\.js$/.test(new URL(proof.url).pathname)) || (request.resourceType() === 'font' && isFontCachePath(new URL(proof.url))))) {
      if (proof.status === 200) networkLengths.set(proof.url, proof.networkBytes);
      const expectedBytes = networkLengths.get(proof.url);
      requireProof(Number.isInteger(expectedBytes) && expectedBytes > 0 && expectedBytes <= 16 * 1024 * 1024, 'missing-network-predecessor');
      const candidates = await awaitNativeStream(pages.get(page), proof.url);
      if (candidates.length !== 1) {
        const error = new CandidateReleaseBlocked('candidate_cache_revalidation_failed');
        error.cacheStage = 'native-stream-request-identity';
        error.cacheCaptureEvidence = { candidateCount: candidates.length, resourceType: request.resourceType(), pathname: new URL(proof.url).pathname, streams: [...pages.get(page).streams.values()].filter(row => row.url === proof.url).map(({ requestId, frameId, claimed, failed, font }) => ({ requestId, frameId, claimed, failed: Boolean(failed), font })) };
        throw error;
      }
      const stream = candidates[0]; stream.claimed = true;
      // Register streaming while the route is paused, before fulfill emits data.
      await stream.ready;
      const expected = { url: proof.url, status: proof.status, expectedBytes, stream, proof, stage: 'await-response' };
      const ownerIdentity = pages.get(page).owner.read();
      proof.nativeIdentity = { ownerId: ownerIdentity.ownerId, targetId: ownerIdentity.targetId, generation: ownerIdentity.generation, frameId: stream.frameId, requestId: stream.requestId };
      if (stream.font) requireProof(request.frame() === page.mainFrame(), 'font-main-frame');
      if (stream.font && proof.status === 304) {
        const prior = (await Promise.all(cached.get(proof.url) ?? [])).filter(row => row.nativeIdentity?.ownerId === ownerIdentity.ownerId && row.nativeIdentity.generation === ownerIdentity.generation && row.nativeIdentity.frameId === stream.frameId);
        requireProof(prior.length > 0, 'font-native-predecessor');
        expected.predecessorId = prior.at(-1).nativeIdentity.requestId;
        proof.nativeIdentity.predecessorId = expected.predecessorId;
      }
      expected.completion = new Promise((resolve, reject) => { expected.resolveCompletion = resolve; expected.rejectCompletion = reject; });
      expected.completion.catch(() => {});
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
    if (status !== 304 && !(status === 200 && proof && ((request.resourceType() === 'script' && /^\/_next\/static\/chunks\/[\w.-]+\.js$/.test(url.pathname) && !url.search) || (request.resourceType() === 'font' && isFontCachePath(url))))) return;
    if (status === 304 && (!proof || !['script', 'font'].includes(request.resourceType()))) fail();
    const page = request.frame().page(), state = pages.get(page);
    requireProof(state);
    const predecessors = [...(cached.get(request.url()) ?? [])];
    const expected = expectations.get(request);
    const progress = stage => { if (expected) expected.stage = stage; };
    const capture = (async () => {
      progress('response-finished');
      const finished = await response.finished();
      requireProof(finished === null, 'response-finished');
      // JS200 uses live CDP streaming; JS304 uses the browser's
      // native cached body. Fonts use native200/CDP predecessor bytes plus
      // current decoded-font rendering proof. All require terminal events and exact
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
      const matching = prior.filter(p => p.browserSHA256 === row.browserSHA256 && (request.resourceType() !== 'font' || p.nativeIdentity?.requestId === row.nativeIdentity.predecessorId));
      requireProof(matching.length > 0, 'missing-browser-cached-representation');
      // Every potentially corresponding representation must validate, rather
      // than picking a convenient matching entry from an ambiguous cache.
      const validated = matching.map(p => validateCachedResponse(p, row, override));
      const receipt = validated[0];
      if (request.resourceType() === 'font') {
        progress('font-render-proof');
        // DOM.getDocument resets this session's frontend node IDs. Serialize
        // rendering probes per page so concurrent font receipts cannot invalidate
        // one another. A failed probe remains a failure; no retry or fallback.
        if (row.nativeBodyProvenance === 'current-native-response-body') {
          // An unused preload is a non-executable data asset. Require its actual
          // current native cached body; never invent renderer/script execution.
          receipt.fontProof = { ...row.nativeIdentity, provenance: row.nativeBodyProvenance,
            nativeCachedBody: true, nativeBodyBytes: row.browserBytes, terminalDecodedBytes: expected.expectedBytes, rendered: false };
        } else {
          requireProof(row.nativeBodyProvenance === 'native-predecessor-body-and-current-decoded-font', 'font-native-provenance');
          const fontProof = state.fontProofQueue.then(() => proveCachedFont({ page, cdp: state.cdp, owner: state.owner, url: request.url(), bytes, identity: row.nativeIdentity, readCount: () => state.reads.get(request.url()) ?? 0 }));
          state.fontProofQueue = fontProof;
          receipt.fontProof = await fontProof;
        }
        receipt.fontProof.sha256 = receipt.sha256;
      }
      receipts.push(receipt); state.receipts.push({ url: request.url(), receipt, generation: proof.browserGeneration });
      progress('complete'); return row;
    })();
    if (status === 200) {
      const rows = cached.get(request.url()) ?? []; rows.push(capture); cached.set(request.url(), rows);
    }
    if (expected) capture.then(expected.resolveCompletion, expected.rejectCompletion);
    return capture;
  }
  async function checkpoint(page) {
    const state = pages.get(page);
    if (!state) return;
    await state.ready;
    const snapshot = await state.owner.collect('cache-gate');
    for (const { url, receipt, generation } of state.receipts) {
      if (receipt.representationKind === 'font') { requireProof(receipt.fontProof?.rendered || receipt.fontProof?.nativeCachedBody, 'font-native-proof'); continue; }
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
