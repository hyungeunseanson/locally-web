import { runProductionBrowserSmoke } from './run-production-browser-smoke.mjs';
import { assertFullCandidateSmoke, assertOverrideIdentity, CandidateReleaseBlocked, versionOverrideHeader } from './candidate-release-contract.mjs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// PR #158 owns retry/readiness policy. This wrapper only adds candidate gates;
// it records paths/status/public version identity, never body/cookie/query data.
export async function runCandidateBrowserSmoke({ origin, mode, workerName, versionId }, {
  runSmoke = runProductionBrowserSmoke, fetchImplementation = fetch,
  readAsset = pathname => readFile(new URL('../../.open-next/assets' + pathname, import.meta.url)),
} = {}) {
  if (mode !== 'override') throw new CandidateReleaseBlocked('invalid_candidate_smoke_mode');
  const override = versionOverrideHeader(workerName, versionId);
  const assetRefs = new Set();
  const assetResponses = [];
  const workerReceipts = [];
  let probeReceipt;
  const pending = new Set();
  const pageCaptures = new WeakMap();
  const pageRequests = new WeakMap();
  const pageSignals = new WeakMap();
  const resourceHintProofs = new Map();
  const signalPage = page => { for (const wake of pageSignals.get(page) ?? []) wake(); };
  const assetEvidence = [];
  let responseCount = 0;
  const coverage = { document: false, script: false, stylesheet: false, font: false, image: false, data: false, api: false };
  const applied = new Set();
  const pageAssets = new WeakMap();
  let allFirstPartyReadsOverridden = true;
  let assetSetMatches = true;
  let hardErrors = 0;
  let fiveXX = 0;
  let asset404 = 0;
  let redirected = false;
  let overflow = false;
  let identityFailure = false;
  const observeContext = async context => {
    context.on('request', request => {
      const url = new URL(request.url());
      if (url.origin !== origin || !url.pathname.startsWith('/_next/static/')) return;
      try {
        const page = request.frame().page();
        const paths = pageRequests.get(page) ?? new Set(); paths.add(url.pathname); pageRequests.set(page, paths);
        signalPage(page);
      } catch { overflow = true; }
    });
    context.on('response', response => {
      const request = response.request();
      const url = new URL(request.url());
      if (url.origin !== origin || !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return;
      const pathname = url.pathname;
      const status = response.status();
      const api = pathname.startsWith('/api/');
      const type = api ? 'api' : ['fetch', 'xhr'].includes(request.resourceType()) ? 'data' : request.resourceType();
      if (Object.hasOwn(coverage, type) && (status === 200 || (api && status === 401))) coverage[type] = true;
      const expected401 = pathname === '/api/proxy-bookings' && status === 401;
      if (status >= 300 && status < 400) redirected = true;
      if (status >= 400 && !expected401) hardErrors += 1;
      if (status >= 500) fiveXX += 1;
      const staticAsset = pathname.startsWith('/_next/static/');
      if (staticAsset && status === 404) asset404 += 1;
      if (++responseCount > 1000) { overflow = true; return; }
      // Associate the response with its page before the first async header read.
      // A response arriving during the DOM snapshot must enter that page's drain.
      let page;
      let captures;
      if (staticAsset) {
        try { page = request.frame().page(); } catch { overflow = true; return; }
        captures = pageCaptures.get(page) ?? new Set();
        pageCaptures.set(page, captures);
        if (request.redirectedFrom()) redirected = true;
      }
      const capture = (async () => {
        const overrideApplied = await request.headerValue('cloudflare-workers-version-overrides') === override;
        const probeApplied = await request.headerValue('x-locally-release-probe') === '1';
        if (!overrideApplied || (pathname === '/.well-known/locally-release' && !probeApplied)) allFirstPartyReadsOverridden = false;
        if (staticAsset) {
          // A 200 response header alone does not prove that its body completed.
          if (await response.finished()) { hardErrors += 1; return; }
          assetResponses.push({ pathname, status, overrideApplied, redirected: status >= 300 && status < 400 || Boolean(request.redirectedFrom()) });
          const paths = pageAssets.get(page) ?? new Set(); paths.add(pathname); pageAssets.set(page, paths);
        } else if (request.method() !== 'OPTIONS' && (request.resourceType() === 'document' || api || ['fetch', 'xhr'].includes(request.resourceType()))) {
          const observedVersion = await response.headerValue('X-Locally-Worker-Version');
          if (pathname === '/.well-known/locally-release') {
            if (observedVersion !== versionId || status !== 204) identityFailure = true;
            probeReceipt = { pathname, versionId: observedVersion === versionId ? versionId : null, status, overrideApplied, probeApplied };
          } else workerReceipts.push({ pathname, overrideApplied });
        }
      })().catch(() => { overflow = true; }).finally(() => { pending.delete(capture); captures?.delete(capture); if (page) signalPage(page); });
      pending.add(capture);
      captures?.add(capture);
    });
    // The same gated browser context performs a deterministic probe first.
    const probe = await context.newPage();
    try { await probe.goto(origin + '/.well-known/locally-release', { waitUntil: 'commit', timeout: 10000 }).catch(error => {
      // Chromium treats a bodyless 204 navigation as ERR_ABORTED; the response
      // listener still verifies status, override and identity. No page retry.
      if (!String(error.message).includes('net::ERR_ABORTED')) throw error;
    }); await drain(); checkSafety();
    if (!probeReceipt) throw new CandidateReleaseBlocked('candidate_identity_unverified');
    } finally { await probe.close(); }
    context.on('page', page => page.on('framenavigated', frame => {
      if (frame === page.mainFrame() && frame.url() !== 'about:blank' && new URL(frame.url()).origin !== origin) redirected = true;
    }));
  };
  const drain = async (captures = pending, page, required = []) => {
    let timer, wake, cancelled = false;
    const listeners = page ? pageSignals.get(page) ?? new Set() : new Set();
    if (page) pageSignals.set(page, listeners);
    try {
      // Repeat snapshots under one existing deadline: a callback can append
      // another capture while an earlier batch is being awaited.
      await Promise.race([(async () => {
        while (!cancelled) {
          if (captures.size) await Promise.all([...captures]);
          checkSafety();
          for (const pathname of pageRequests.get(page) ?? []) if (!required.includes(pathname)) required.push(pathname);
          if (!captures.size && required.every(pathname => pageAssets.get(page)?.has(pathname))) return;
          // Zero response-capture promises does not mean zero in-flight requests.
          // Wait for this page's response completion under the same 1s deadline.
          await new Promise(resolve => { wake = () => { listeners.delete(wake); resolve(); }; listeners.add(wake); });
        }
      })(), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new CandidateReleaseBlocked(captures.size ? 'candidate_capture_timeout' : 'candidate_asset_set_mismatch')), 1000);
      })]);
    } finally { cancelled = true; clearTimeout(timer); wake?.(); }
  };
  const checkSafety = () => {
    if (hardErrors || fiveXX || asset404 || overflow || redirected) throw new CandidateReleaseBlocked('candidate_http_or_asset_failure');
    if (identityFailure || !allFirstPartyReadsOverridden) throw new CandidateReleaseBlocked('candidate_identity_unverified');
  };
  const collectReadOnlyPageEvidence = async page => {
    if (page.isClosed()) throw new CandidateReleaseBlocked('candidate_capture_page_closed');
    await drain(pageCaptures.get(page) ?? new Set());
    const paths = await page.locator('script[src],link[rel="stylesheet"],link[rel="preload"],link[rel="modulepreload"],link[rel="prefetch"]').evaluateAll(elements => {
      const rows = elements.map(e => ({ url: new URL(e.src || e.href, location.href), required: e.tagName === 'SCRIPT' || e.rel === 'stylesheet' }))
        .filter(e => e.url.origin === location.origin && e.url.pathname.startsWith('/_next/static/'));
      const resources = performance.getEntriesByType('resource').map(r => new URL(r.name))
        .filter(u => u.origin === location.origin && u.pathname.startsWith('/_next/static/')).map(u => u.pathname);
      return { required: [...new Set([...rows.filter(e => e.required).map(e => e.url.pathname), ...resources])],
        hints: [...new Set(rows.filter(e => !e.required).map(e => e.url.pathname))] };
    });
    const required = [...new Set([...paths.required, ...(pageRequests.get(page) ?? [])])];
    const hints = paths.hints.filter(pathname => !required.includes(pathname));
    for (const pathname of hints) {
      if (resourceHintProofs.has(pathname)) continue;
      try {
        const response = await fetchImplementation(origin + pathname, { method: 'GET', redirect: 'error',
          signal: AbortSignal.timeout(10000), headers: { 'Cloudflare-Workers-Version-Overrides': override } });
        if (response.status !== 200 || response.redirected) throw new Error();
        const bytes = Buffer.from(await response.arrayBuffer()), local = await readAsset(pathname);
        const digest = value => createHash('sha256').update(value).digest('hex');
        if (digest(bytes) !== digest(local)) throw new Error();
        resourceHintProofs.set(pathname, { pathname, versionId, status: 200, bodyComplete: true,
          overrideApplied: true, redirected: false, sha256: digest(bytes), hashMatch: true });
      } catch { throw new CandidateReleaseBlocked('candidate_resource_hint_proof_failed'); }
    }
    // The browser round trip above can deliver additional response events.
    // Drain those page-scoped captures before comparing, without a sleep or
    // asset/status/override exception. Other pages cannot satisfy this set.
    const executed = [...new Set([...required, ...(pageRequests.get(page) ?? [])])];
    try { await drain(pageCaptures.get(page) ?? new Set(), page, executed); }
    catch (error) {
      error.assetEvidence = { pathname: new URL(page.url()).pathname, refs: executed, resourceHints: hints,
        completed: [...(pageAssets.get(page) ?? [])], missing: executed.filter(p => !pageAssets.get(page)?.has(p)),
        pendingCaptures: pageCaptures.get(page)?.size ?? 0 };
      throw error;
    }
    if (page.isClosed()) throw new CandidateReleaseBlocked('candidate_capture_page_closed');
    for (const p of executed) assetRefs.add(p);
    const received = pageAssets.get(page) ?? new Set();
    const missing = executed.filter(p => !received.has(p));
    const evidence = { pathname: new URL(page.url()).pathname, refs: executed, resourceHints: hints,
      completed: [...received], missing, pendingCaptures: pageCaptures.get(page)?.size ?? 0 };
    assetEvidence.push(evidence);
    if (!executed.length || missing.length) assetSetMatches = false;
    checkSafety();
    if (!assetSetMatches) {
      const error = new CandidateReleaseBlocked('candidate_asset_set_mismatch');
      error.assetEvidence = evidence;
      throw error;
    }
  };
  const result = await runSmoke(origin, {
    versionOverride: { workerName, versionId, onApplied: ({ pathname, resourceType, method }) => {
      applied.add(`${method}:${pathname}`);
      void resourceType;
    } }, observeContext, collectReadOnlyPageEvidence, assertAdditionalSafety: checkSafety, log: () => {},
  });
  await drain(); checkSafety();
  const smoke = {
    origin, redirected, fullPass: result.status === 'LOCALLY_PRODUCTION_BROWSER_SMOKE_PASS',
    checks: { home: result.homepage === 'rendered', login: result.login === 'rendered', experience: Boolean(result.publicExperience), api401: result.unauthenticatedProxyBookings === 401 },
    httpHardErrors: hardErrors, fiveXX, asset404, genericError: false, pageErrors: 0, consoleErrors: 0,
    unexpectedWrites: result.blockedUnexpectedWrites.length + result.blockedUnexpectedExternalWrites.length,
    versionMismatch: identityFailure, assetRefs: [...assetRefs], assetResponses, resourceHintProofs: [...resourceHintProofs.values()], assetSetMatches, assetEvidence, workerReceipts, probeReceipt,
    overrideCoverage: coverage, allFirstPartyReadsOverridden: allFirstPartyReadsOverridden && applied.size > 0,
    attempts: result.pageAttempts.map(a => ({ pathname: a.pathname, pass: a.outcome === 'pass', timeout: a.outcome === 'retry',
      pendingStaticAssets: a.pendingFirstPartyRequests.filter(r => r.pathname.startsWith('/_next/static/') && ['script', 'font'].includes(r.resourceType)).length,
      httpHardErrors: hardErrors, fiveXX, asset404, genericError: a.genericErrorPresent,
      pageErrors: 0, consoleErrors: 0, unexpectedWrites: 0, versionMismatch: identityFailure })),
  };
  assertFullCandidateSmoke(smoke);
  assertOverrideIdentity({ versionId, smoke, expectedOrigin: origin });
  return smoke;
}
