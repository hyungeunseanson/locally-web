import { runProductionBrowserSmoke } from './run-production-browser-smoke.mjs';
import { assertFullCandidateSmoke, assertOverrideIdentity, CandidateReleaseBlocked, versionOverrideHeader } from './candidate-release-contract.mjs';

// PR #158 owns retry/readiness policy. This wrapper only adds candidate gates;
// it records paths/status/public version identity, never body/cookie/query data.
export async function runCandidateBrowserSmoke({ origin, mode, workerName, versionId }, { runSmoke = runProductionBrowserSmoke } = {}) {
  if (mode !== 'override') throw new CandidateReleaseBlocked('invalid_candidate_smoke_mode');
  const override = versionOverrideHeader(workerName, versionId);
  const assetRefs = new Set();
  const assetResponses = [];
  const workerReceipts = [];
  const pending = [];
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
    context.on('response', response => {
      const request = response.request();
      const url = new URL(request.url());
      if (url.origin !== origin || !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return;
      const pathname = url.pathname;
      const status = response.status();
      const api = pathname.startsWith('/api/');
      const expected401 = pathname === '/api/proxy-bookings' && status === 401;
      if (status >= 300 && status < 400) redirected = true;
      if (status >= 400 && !expected401) hardErrors += 1;
      if (status >= 500) fiveXX += 1;
      const staticAsset = pathname.startsWith('/_next/static/');
      if (staticAsset && status === 404) asset404 += 1;
      if (assetResponses.length + workerReceipts.length + pending.length >= 1000) { overflow = true; return; }
      pending.push((async () => {
        const overrideApplied = await request.headerValue('cloudflare-workers-version-overrides') === override;
        const probeApplied = await request.headerValue('x-locally-release-probe') === '1';
        if (!overrideApplied || (request.method() !== 'OPTIONS' && !probeApplied)) allFirstPartyReadsOverridden = false;
        if (staticAsset) {
          assetResponses.push({ pathname, status, overrideApplied, redirected: status >= 300 && status < 400 || Boolean(request.redirectedFrom()) });
          const page = request.frame().page();
          const paths = pageAssets.get(page) ?? new Set(); paths.add(pathname); pageAssets.set(page, paths);
        } else if (request.method() !== 'OPTIONS' && (request.resourceType() === 'document' || api || ['fetch', 'xhr'].includes(request.resourceType()))) {
          const observedVersion = await response.headerValue('X-Locally-Worker-Version');
          // Never copy an unexpected header value into diagnostics.
          if (observedVersion !== versionId) identityFailure = true;
          workerReceipts.push({ pathname, versionId: observedVersion === versionId ? versionId : null, overrideApplied, probeApplied });
        }
      })().catch(() => { overflow = true; }));
    });
    context.on('page', page => page.on('framenavigated', frame => {
      if (frame === page.mainFrame() && frame.url() !== 'about:blank' && new URL(frame.url()).origin !== origin) redirected = true;
    }));
  };
  const drain = async () => {
    let timer;
    try {
      await Promise.race([Promise.all(pending), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new CandidateReleaseBlocked('candidate_capture_timeout')), 1000);
      })]);
    } finally { clearTimeout(timer); }
  };
  const checkSafety = () => {
    if (hardErrors || fiveXX || asset404 || overflow || redirected) throw new CandidateReleaseBlocked('candidate_http_or_asset_failure');
    if (identityFailure || !allFirstPartyReadsOverridden) throw new CandidateReleaseBlocked('candidate_identity_unverified');
  };
  const collectReadOnlyPageEvidence = async page => {
    await drain();
    const paths = await page.locator('script[src],link[rel="stylesheet"],link[rel="preload"]').evaluateAll(elements => {
      const paths = elements.map(e => new URL(e.src || e.href, location.href))
        .filter(u => u.origin === location.origin && u.pathname.startsWith('/_next/static/')).map(u => u.pathname);
      return [...new Set(paths)];
    });
    for (const p of paths) assetRefs.add(p);
    const received = pageAssets.get(page) ?? new Set();
    if (!paths.length || paths.length !== received.size || !paths.every(p => received.has(p))) assetSetMatches = false;
    checkSafety();
    if (!assetSetMatches) throw new CandidateReleaseBlocked('candidate_asset_set_mismatch');
  };
  const result = await runSmoke(origin, {
    versionOverride: { workerName, versionId, onApplied: ({ pathname, resourceType, method }) => {
      applied.add(`${method}:${pathname}`);
      const type = pathname.startsWith('/api/') ? 'api' : ['fetch', 'xhr'].includes(resourceType) ? 'data' : resourceType;
      if (Object.hasOwn(coverage, type)) coverage[type] = true;
    } }, observeContext, collectReadOnlyPageEvidence, assertAdditionalSafety: checkSafety, log: () => {},
  });
  await drain(); checkSafety();
  const smoke = {
    origin, redirected, fullPass: result.status === 'LOCALLY_PRODUCTION_BROWSER_SMOKE_PASS',
    checks: { home: result.homepage === 'rendered', login: result.login === 'rendered', experience: Boolean(result.publicExperience), api401: result.unauthenticatedProxyBookings === 401 },
    httpHardErrors: hardErrors, fiveXX, asset404, genericError: false, pageErrors: 0, consoleErrors: 0,
    unexpectedWrites: result.blockedUnexpectedWrites.length + result.blockedUnexpectedExternalWrites.length,
    versionMismatch: identityFailure, assetRefs: [...assetRefs], assetResponses, assetSetMatches, workerReceipts,
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
