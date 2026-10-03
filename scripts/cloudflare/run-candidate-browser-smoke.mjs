import { runProductionBrowserSmoke } from './run-production-browser-smoke.mjs';
import { assertFullCandidateSmoke, assertOverrideIdentity, CandidateReleaseBlocked, versionOverrideHeader } from './candidate-release-contract.mjs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Execute existing client state handlers without saving Production data.
export async function verifyReadOnlyClientInteraction(page) {
  const deadline = Date.now() + 15000;
  const timeout = () => Math.max(1, deadline - Date.now());
  try {
    const pathname = new URL(page.url()).pathname;
    if (/^\/experiences\/\d+$/.test(pathname)) {
      const button = page.getByTestId('experience-summary-read-more-desktop');
      const description = page.getByTestId('experience-summary-description-desktop');
      await button.waitFor({ state: 'visible', timeout: timeout() });
      await description.waitFor({ state: 'visible', timeout: timeout() });
      await page.waitForFunction(() => {
        const button = document.querySelector('[data-testid="experience-summary-read-more-desktop"]');
        return button && (typeof button.onclick === 'function' || Object.keys(button).some(key =>
          key.startsWith('__reactProps$') && typeof button[key]?.onClick === 'function'));
      }, {}, { timeout: timeout() });
      await button.click({ timeout: timeout() });
      await button.waitFor({ state: 'hidden', timeout: timeout() });
      await description.waitFor({ state: 'visible', timeout: timeout() });
      return { pathname, interaction: 'experience-description-read-more', clicked: true, expanded: true, descriptionVisible: true };
    }
    // The existing Home notice makes the app shell inert. Use its real close
    // control first; dismissal is confined to this disposable browser context.
    const notice = page.getByTestId('legacy-experience-popup-close');
    const noticeDismissed = await notice.isVisible();
    if (noticeDismissed) {
      await notice.click({ timeout: timeout() });
      await page.getByTestId('legacy-experience-popup-overlay').waitFor({ state: 'hidden', timeout: timeout() });
    }
    await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(button =>
      button.querySelector('svg.lucide-globe') && button.getBoundingClientRect().width > 0
      && (typeof button.onclick === 'function' || Object.keys(button).some(key =>
        key.startsWith('__reactProps$') && typeof button[key]?.onClick === 'function'))), {}, { timeout: timeout() });
    const globe = page.locator('button:visible').filter({ has: page.locator('svg.lucide-globe') }).first();
    const menuItem = page.getByRole('button', { name: 'English', exact: true });
    await globe.click({ timeout: timeout() });
    await menuItem.waitFor({ state: 'visible', timeout: timeout() });
    await globe.click({ timeout: timeout() });
    await menuItem.waitFor({ state: 'hidden', timeout: timeout() });
    return { pathname, interaction: 'locale-menu-open-close', opened: true, closed: true, noticeDismissed };
  } catch { throw new CandidateReleaseBlocked('candidate_client_interaction_failed'); }
}

// PR #158 owns retry/navigation/readiness policy. The 1s diagnostic drain below
// covers header/identity bookkeeping only. Browser body completion is diagnostic;
// every referenced/requested static asset instead needs an exact candidate GET
// with a complete body and byte hash matching the existing candidate artifact.
export async function runCandidateBrowserSmoke({ origin, mode, workerName, versionId }, {
  runSmoke = runProductionBrowserSmoke, fetchImplementation = fetch,
  readAsset = pathname => readFile(new URL('../../.open-next/assets' + pathname, import.meta.url)),
  verifyInteraction = verifyReadOnlyClientInteraction,
} = {}) {
  if (mode !== 'override') throw new CandidateReleaseBlocked('invalid_candidate_smoke_mode');
  const override = versionOverrideHeader(workerName, versionId);
  const assetRefs = new Set(), hints = new Set(), browserAssetResponses = [], workerReceipts = [], assetEvidence = [], clientInteractions = [];
  const pending = new Set(), pageRequests = new WeakMap(), pageAssets = new WeakMap(), pendingRequests = new Map(), responseRows = new Map();
  const closingPages = new WeakSet(), observedPages = new Set(), requestFailures = [];
  let probeReceipt, responseCount = 0, allFirstPartyReadsOverridden = true, allFirstPartyReadsAnonymous = true;
  let hardErrors = 0, fiveXX = 0, asset404 = 0, redirected = false, overflow = false, identityFailure = false;
  const coverage = { document: false, script: false, stylesheet: false, font: false, image: false, data: false, api: false };
  const applied = new Set(), forwardingProofs = new WeakMap();
  const trackPage = page => {
    if (observedPages.has(page)) return;
    observedPages.add(page);
    // Observe the explicit caller teardown before Chromium cancels in-flight
    // reads. A real failure before close, including ERR_BLOCKED_BY_CLIENT, fails.
    if (typeof page.close === 'function') {
      const close = page.close.bind(page);
      page.close = (...args) => { closingPages.add(page); return close(...args); };
    }
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame() && frame.url() !== 'about:blank' && new URL(frame.url()).origin !== origin) redirected = true;
    });
  };
  const checkSafety = () => {
    const realFailures = requestFailures.filter(row => !row.intentionalTeardown
      && !(row.pathname === '/.well-known/locally-release' && row.aborted
        && probeReceipt?.status === 204 && probeReceipt.versionId === versionId));
    if (realFailures.length) { const error = new CandidateReleaseBlocked('candidate_request_failure'); error.requestFailures = realFailures; throw error; }
    if (hardErrors || fiveXX || asset404 || overflow || redirected) throw new CandidateReleaseBlocked('candidate_http_or_asset_failure');
    if (identityFailure || !allFirstPartyReadsOverridden) throw new CandidateReleaseBlocked('candidate_identity_unverified');
    if (!allFirstPartyReadsAnonymous) throw new CandidateReleaseBlocked('candidate_read_not_anonymous');
  };
  const drain = async () => {
    let timer;
    try {
      await Promise.race([(async () => { while (pending.size) await Promise.all([...pending]); })(),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new CandidateReleaseBlocked('candidate_capture_timeout')), 1000); })]);
    } finally { clearTimeout(timer); }
    checkSafety();
  };
  const observeContext = async context => {
    context.on('page', trackPage);
    if (typeof context.close === 'function') {
      const close = context.close.bind(context);
      context.close = (...args) => { for (const page of observedPages) closingPages.add(page); return close(...args); };
    }
    context.on('request', request => {
      const url = new URL(request.url());
      if (url.origin !== origin) return;
      try {
        const page = request.frame().page(); trackPage(page);
        pendingRequests.set(request, { pathname: url.pathname, page, type: request.resourceType() });
        if (url.pathname.startsWith('/_next/static/')) {
          assetRefs.add(url.pathname);
          const paths = pageRequests.get(page) ?? new Set(); paths.add(url.pathname); pageRequests.set(page, paths);
        }
      } catch { overflow = true; }
    });
    context.on('requestfinished', request => {
      const row = pendingRequests.get(request);
      if (row?.pathname.startsWith('/_next/static/')) {
        const paths = pageAssets.get(row.page) ?? new Set(); paths.add(row.pathname); pageAssets.set(row.page, paths);
        if (responseRows.has(request)) responseRows.get(request).bodyComplete = true;
      }
      pendingRequests.delete(request);
    });
    context.on('requestfailed', request => {
      const row = pendingRequests.get(request), url = new URL(request.url());
      if (url.origin !== origin) return;
      // Non-read traffic is never forwarded by the unchanged mutation gate.
      // Its local telemetry fulfill/abort is not a Production transport failure;
      // any unexpected business write still throws in the browser safety layer.
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) { pendingRequests.delete(request); return; }
      const failure = request.failure()?.errorText;
      const aborted = failure === 'net::ERR_ABORTED';
      requestFailures.push({ pathname: url.pathname, failureCategory: /^net::ERR_[A-Z_]+$/.test(failure ?? '') ? failure : 'NETWORK_FAILURE', aborted, intentionalTeardown: Boolean(aborted && row && closingPages.has(row.page)) });
      pendingRequests.delete(request);
    });
    context.on('response', response => {
      const request = response.request(), url = new URL(request.url());
      if (url.origin !== origin || !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return;
      const pathname = url.pathname, status = response.status(), api = pathname.startsWith('/api/');
      const type = api ? 'api' : ['fetch', 'xhr'].includes(request.resourceType()) ? 'data' : request.resourceType();
      if (Object.hasOwn(coverage, type) && (status === 200 || (api && status === 401))) coverage[type] = true;
      if (status >= 300 && status < 400) redirected = true;
      if (status >= 400 && !(pathname === '/api/proxy-bookings' && status === 401)) hardErrors += 1;
      if (status >= 500) fiveXX += 1;
      const staticAsset = pathname.startsWith('/_next/static/');
      if (staticAsset && status === 404) asset404 += 1;
      if (++responseCount > 1000) { overflow = true; return; }
      if (request.redirectedFrom()) redirected = true;
      const observedPage = pendingRequests.get(request)?.page;
      const capture = (async () => {
        const forwarded = forwardingProofs.get(request);
        const stateless = forwarded?.forwarding === 'stateless-read' && forwarded.anonymous === true;
        const overrideApplied = stateless || await request.headerValue('cloudflare-workers-version-overrides') === override;
        const probeApplied = stateless && pathname === '/.well-known/locally-release' || await request.headerValue('x-locally-release-probe') === '1';
        if (!stateless && (await request.headerValue('cookie') !== null || await request.headerValue('authorization') !== null)) allFirstPartyReadsAnonymous = false;
        if (!overrideApplied || (pathname === '/.well-known/locally-release' && !probeApplied)) allFirstPartyReadsOverridden = false;
        if (staticAsset) {
          const row = { pathname, status, overrideApplied, redirected: Boolean(request.redirectedFrom()) || status >= 300 && status < 400,
            bodyComplete: Boolean(pageAssets.get(observedPage)?.has(pathname)) };
          browserAssetResponses.push(row); responseRows.set(request, row);
        } else if (request.method() !== 'OPTIONS' && (request.resourceType() === 'document' || api || ['fetch', 'xhr'].includes(request.resourceType()))) {
          if (pathname === '/.well-known/locally-release') {
            const observedVersion = await response.headerValue('X-Locally-Worker-Version');
            if (observedVersion !== versionId || status !== 204) identityFailure = true;
            probeReceipt = { pathname, versionId: observedVersion === versionId ? versionId : null, status, overrideApplied, probeApplied };
          } else workerReceipts.push({ pathname, overrideApplied });
        }
      })().catch(() => { overflow = true; }).finally(() => pending.delete(capture));
      pending.add(capture);
    });
    const probe = await context.newPage(); trackPage(probe);
    try {
      await probe.goto(origin + '/.well-known/locally-release', { waitUntil: 'commit', timeout: 10000 }).catch(error => {
        if (!String(error.message).includes('net::ERR_ABORTED')) throw error;
      });
      await drain();
      if (!probeReceipt) throw new CandidateReleaseBlocked('candidate_identity_unverified');
    } finally { await probe.close(); }
  };
  const collectReadOnlyPageEvidence = async page => {
    if (page.isClosed()) throw new CandidateReleaseBlocked('candidate_capture_page_closed');
    const pathname = new URL(page.url()).pathname;
    if (pathname === '/' || /^\/experiences\/\d+$/.test(pathname)) {
      const receipt = await verifyInteraction(page);
      const validInteraction = pathname === '/'
        ? receipt?.interaction === 'locale-menu-open-close' && receipt.opened === true && receipt.closed === true
        : receipt?.interaction === 'experience-description-read-more' && receipt.clicked === true && receipt.expanded === true && receipt.descriptionVisible === true;
      if (receipt?.pathname !== pathname || !validInteraction) throw new CandidateReleaseBlocked('candidate_client_interaction_failed');
      clientInteractions.push(receipt);
    }
    const paths = await page.locator('script[src],link[rel="stylesheet"],link[rel="preload"],link[rel="modulepreload"],link[rel="prefetch"]').evaluateAll(elements => {
      const rows = elements.map(e => ({ url: new URL(e.src || e.href, location.href), hint: e.tagName !== 'SCRIPT' && e.rel !== 'stylesheet' }))
        .filter(e => e.url.origin === location.origin && e.url.pathname.startsWith('/_next/static/'));
      const resources = performance.getEntriesByType('resource').map(r => new URL(r.name))
        .filter(u => u.origin === location.origin && u.pathname.startsWith('/_next/static/')).map(u => u.pathname);
      return { refs: [...new Set([...rows.map(e => e.url.pathname), ...resources])], hints: [...new Set(rows.filter(e => e.hint).map(e => e.url.pathname))] };
    });
    for (const path of [...paths.refs, ...(pageRequests.get(page) ?? [])]) assetRefs.add(path);
    for (const path of paths.hints) hints.add(path);
    await drain();
    if (page.isClosed()) throw new CandidateReleaseBlocked('candidate_capture_page_closed');
    assetEvidence.push({ pathname, refs: [...new Set([...paths.refs, ...(pageRequests.get(page) ?? [])])],
      browserCompleted: [...(pageAssets.get(page) ?? [])],
      browserPending: [...pendingRequests.values()].filter(row => row.page === page).map(row => ({ pathname: row.pathname, type: row.type })) });
  };
  const result = await runSmoke(origin, {
    versionOverride: { workerName, versionId, onApplied: ({ pathname, resourceType, method, anonymous, forwarding }, request) => {
      applied.add(`${method}:${pathname}`);
      if (request) forwardingProofs.set(request, { anonymous, forwarding });
      if (pathname.startsWith('/_next/static/')) {
        assetRefs.add(pathname);
        // Actual browser requests are overridden by the unchanged write gate;
        // these static categories also require a matching complete direct proof.
        if (Object.hasOwn(coverage, resourceType)) coverage[resourceType] = true;
      }
    } }, observeContext, collectReadOnlyPageEvidence, assertAdditionalSafety: checkSafety, log: () => {},
  });
  await drain();
  if (!clientInteractions.some(r => r.pathname === '/') || !clientInteractions.some(r => /^\/experiences\/\d+$/.test(r.pathname))) throw new CandidateReleaseBlocked('candidate_client_interaction_failed');
  if (!assetRefs.size || assetRefs.size > 1000) throw new CandidateReleaseBlocked('candidate_asset_integrity_failed');
  const assetResponses = [], paths = [...assetRefs]; let index = 0;
  await Promise.all(Array.from({ length: Math.min(4, paths.length) }, async () => {
    while (index < paths.length) {
      const pathname = paths[index++];
      try {
        const response = await fetchImplementation(origin + pathname, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10000),
          headers: { 'Cloudflare-Workers-Version-Overrides': override } });
        if (response.status !== 200 || response.redirected) throw new Error();
        const bytes = Buffer.from(await response.arrayBuffer()), local = await readAsset(pathname);
        const digest = value => createHash('sha256').update(value).digest('hex');
        if (digest(bytes) !== digest(local)) throw new Error();
        assetResponses.push({ pathname, versionId, status: 200, bodyComplete: true, overrideApplied: true, redirected: false,
          sha256: digest(bytes), hashMatch: true, source: 'direct-candidate-get' });
      } catch { const error = new CandidateReleaseBlocked('candidate_asset_integrity_failed'); error.assetEvidence = { pathname }; throw error; }
    }
  }));
  checkSafety();
  const smoke = {
    origin, redirected, fullPass: result.status === 'LOCALLY_PRODUCTION_BROWSER_SMOKE_PASS',
    checks: { home: result.homepage === 'rendered', login: result.login === 'rendered', experience: Boolean(result.publicExperience), api401: result.unauthenticatedProxyBookings === 401 },
    httpHardErrors: hardErrors, fiveXX, asset404, genericError: result.pageAttempts.some(a => a.genericErrorPresent === true), pageErrors: 0, consoleErrors: 0,
    unexpectedWrites: result.blockedUnexpectedWrites.length + result.blockedUnexpectedExternalWrites.length,
    versionMismatch: identityFailure, assetRefs: paths, assetResponses, browserAssetResponses, assetSetMatches: assetResponses.length === paths.length,
    resourceHintProofs: assetResponses.filter(row => hints.has(row.pathname)), assetEvidence, clientInteractions,
    requestFailures: requestFailures.filter(row => !row.intentionalTeardown && !(row.pathname === '/.well-known/locally-release' && row.aborted && probeReceipt?.status === 204)),
    intentionalTeardownAborts: requestFailures.filter(row => row.intentionalTeardown).length,
    workerReceipts, probeReceipt, overrideCoverage: coverage, allFirstPartyReadsOverridden: allFirstPartyReadsOverridden && applied.size > 0,
    allFirstPartyReadsAnonymous, anonymousReadHeaders: result.anonymousReadHeaders,
    attempts: result.pageAttempts.map(a => ({ pathname: a.pathname, pass: a.outcome === 'pass', timeout: a.outcome === 'retry',
      pendingStaticAssets: a.pendingFirstPartyRequests.filter(r => r.pathname.startsWith('/_next/static/') && ['script', 'font'].includes(r.resourceType)).length,
      httpHardErrors: hardErrors, fiveXX, asset404, genericError: a.genericErrorPresent,
      pageErrors: 0, consoleErrors: 0, unexpectedWrites: 0, versionMismatch: identityFailure })),
  };
  assertFullCandidateSmoke(smoke);
  assertOverrideIdentity({ versionId, smoke, expectedOrigin: origin });
  return smoke;
}
