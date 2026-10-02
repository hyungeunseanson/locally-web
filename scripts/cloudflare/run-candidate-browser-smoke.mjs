import { runProductionBrowserSmoke } from './run-production-browser-smoke.mjs';
import { CandidateReleaseBlocked, versionOverrideHeader } from './candidate-release-contract.mjs';

// Reuse PR #158's timeouts, fresh-Page retry and context mutation gate. Capture
// only pathname/status/Ray receipt data, never request or response bodies.
export async function runCandidateBrowserSmoke({ origin, mode, workerName, versionId }, { runSmoke = runProductionBrowserSmoke } = {}) {
  if (!['isolated', 'override'].includes(mode)) throw new CandidateReleaseBlocked('invalid_candidate_smoke_mode');
  const override = mode === 'override' ? versionOverrideHeader(workerName, versionId) : null;
  const assetRefs = new Set();
  const assetResponses = [];
  const workerReceipts = [];
  const pending = [];
  const coverage = { document: false, script: false, font: false, api: false };
  let hardErrors = 0;
  let fiveXX = 0;
  let asset404 = 0;
  let redirected = false;
  let overflow = false;
  const requests = new WeakMap();
  const observeContext = async context => {
    context.on('request', request => {
      const url = new URL(request.url());
      if (url.origin !== origin) return;
      requests.set(request, Date.now());
    });
    context.on('response', response => {
      const request = response.request();
      const url = new URL(request.url());
      if (url.origin !== origin) return;
      const pathname = url.pathname;
      const status = response.status();
      const api = pathname === '/api/proxy-bookings';
      if (request.isNavigationRequest() && status >= 300 && status < 400) redirected = true;
      if (status >= 400 && !(api && status === 401)) hardErrors += 1;
      if (status >= 500) fiveXX += 1;
      if (pathname.startsWith('/_next/static/') && status === 404) asset404 += 1;
      if (assetResponses.length + workerReceipts.length >= 1000) { overflow = true; return; }
      if (pathname.startsWith('/_next/static/')) assetResponses.push({ pathname, status });
      if (request.resourceType() === 'document' || api) {
        pending.push(response.headerValue('cf-ray').then(ray => {
          const rayId = ray?.split('-')[0]?.toLowerCase();
          if (rayId) workerReceipts.push({ pathname, rayId, startedAt: requests.get(request), finishedAt: Date.now() });
        }).catch(() => { overflow = true; }));
      }
    });
    context.on('page', page => {
      page.on('framenavigated', frame => {
        if (frame === page.mainFrame() && frame.url() !== 'about:blank' && new URL(frame.url()).origin !== origin) redirected = true;
      });
      page.on('domcontentloaded', () => {
        // The expected 401 API document is closed immediately by the existing
        // smoke; it has no HTML asset references to inspect.
        if (new URL(page.url()).pathname === '/api/proxy-bookings') return;
        pending.push(page.locator('script[src],link[href]').evaluateAll(elements => elements.map(e => {
          const u = new URL(e.src || e.href, location.href);
          return u.origin === location.origin && u.pathname.startsWith('/_next/static/') ? u.pathname : null;
        }).filter(Boolean)).then(paths => { for (const p of paths) assetRefs.add(p); }).catch(() => { overflow = true; }));
      });
    });
  };
  const checkSafety = () => {
    if (hardErrors || fiveXX || asset404 || overflow) throw new CandidateReleaseBlocked('candidate_http_or_asset_failure');
  };
  const result = await runSmoke(origin, {
    ...(override ? { versionOverride: { workerName, versionId, onApplied: ({ pathname, resourceType }) => {
      const type = pathname === '/api/proxy-bookings' ? 'api' : resourceType;
      if (Object.hasOwn(coverage, type)) coverage[type] = true;
    } } } : {}),
    observeContext,
    assertAdditionalSafety: checkSafety,
    log: () => {},
  });
  let timer;
  try {
    await Promise.race([Promise.all(pending), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new CandidateReleaseBlocked('candidate_capture_timeout')), 1000);
    })]);
  } finally { clearTimeout(timer); }
  checkSafety();
  return {
    origin, redirected, fullPass: result.status === 'LOCALLY_PRODUCTION_BROWSER_SMOKE_PASS',
    checks: { home: result.homepage === 'rendered', login: result.login === 'rendered', experience: Boolean(result.publicExperience), api401: result.unauthenticatedProxyBookings === 401 },
    httpHardErrors: hardErrors, fiveXX, asset404, genericError: false, pageErrors: 0, consoleErrors: 0,
    unexpectedWrites: result.blockedUnexpectedWrites.length + result.blockedUnexpectedExternalWrites.length,
    versionMismatch: false, assetRefs: [...assetRefs], assetResponses, workerReceipts,
    overrideCoverage: coverage,
    attempts: result.pageAttempts.map(a => ({ pathname: a.pathname, pass: a.outcome === 'pass', timeout: a.outcome === 'retry',
      pendingStaticAssets: a.pendingFirstPartyRequests.filter(r => r.pathname.startsWith('/_next/static/') && ['script', 'font'].includes(r.resourceType)).length,
      httpHardErrors: hardErrors, fiveXX, asset404, genericError: a.genericErrorPresent,
      pageErrors: 0, consoleErrors: 0, unexpectedWrites: 0, versionMismatch: false })),
  };
}
