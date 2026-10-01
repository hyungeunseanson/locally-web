import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

import { chromium } from '@playwright/test';

const DEFAULT_PRODUCTION_ORIGIN = 'https://www.locally-travel.com';
const GENERIC_ERROR_TEXT = /페이지를 불러오지 못했습니다|Something went wrong|An error occurred/i;
const MISSING_SUPABASE_ENV_TEXT = /\[Supabase\].*NEXT_PUBLIC_SUPABASE_URL.*NEXT_PUBLIC_SUPABASE_ANON_KEY/;
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const READINESS_TIMEOUT_MS = 15000;
const LOGIN_READINESS_TIMEOUT_MS = 45000;
const MAX_PENDING_REQUEST_DIAGNOSTICS = 10;
const EXPECTED_ANALYTICS_PATH = '/api/analytics/events';
const EXPECTED_CLOUDFLARE_RUM_PATH = '/cdn-cgi/rum';
const KNOWN_ANALYTICS_EVENT_TYPES = new Set(['view', 'click', 'payment_init', 'booking_confirmed']);
// The bounded Production diagnostic observed no external writes. Keep this empty
// until a specific host and path have been observed and reviewed.
const REVIEWED_EXTERNAL_TELEMETRY = Object.freeze([]);

// Smoke-only isolation: never execute loaders that generate provider telemetry.
// Query strings are ignored for matching and never included in diagnostics.
export const REVIEWED_EXTERNAL_SCRIPT_STUBS = Object.freeze([
  Object.freeze({
    origin: 'https://fundingchoicesmessages.google.com',
    pathnamePattern: /^\/i\/pub-\d+$/,
    diagnosticPathname: '/i/pub-[REDACTED]',
    method: 'GET',
    resourceType: 'script',
    kind: 'google_cmp_loader',
  }),
  Object.freeze({
    origin: 'https://www.googletagmanager.com',
    pathname: '/gtag/js',
    method: 'GET',
    resourceType: 'script',
    kind: 'google_analytics_loader',
  }),
  Object.freeze({
    origin: 'https://pagead2.googlesyndication.com',
    pathname: '/pagead/js/adsbygoogle.js',
    method: 'GET',
    resourceType: 'script',
    kind: 'google_adsense_loader',
  }),
]);

export async function installProductionMutationGate(context, origin, {
  reviewedExternalTelemetry = REVIEWED_EXTERNAL_TELEMETRY,
  reviewedExternalScriptStubs = REVIEWED_EXTERNAL_SCRIPT_STUBS,
} = {}) {
  const productionOrigin = new URL(origin).origin;
  const blockedExpectedWrites = [];
  const blockedUnexpectedWrites = [];
  const blockedExpectedExternalWrites = [];
  const blockedUnexpectedExternalWrites = [];
  const stubbedExternalScripts = [];

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();

    if (url.origin !== productionOrigin && method === 'GET' && request.resourceType() === 'script') {
      const stub = reviewedExternalScriptStubs.find((contract) =>
        contract.origin === url.origin
        && contract.method === method
        && contract.resourceType === request.resourceType()
        && (contract.pathname !== undefined
          ? contract.pathname === url.pathname
          : contract.pathnamePattern?.test(url.pathname))
      );
      if (stub) {
        stubbedExternalScripts.push({
          hostname: url.hostname,
          pathname: stub.diagnosticPathname ?? url.pathname,
          method,
          resourceType: request.resourceType(),
          kind: stub.kind,
        });
        await route.fulfill({ status: 200, contentType: 'application/javascript', body: ';' });
        return;
      }
    }

    if (READ_METHODS.has(method)) {
      await route.continue();
      return;
    }

    const blockedWrite = { method, pathname: url.pathname };
    if (url.origin !== productionOrigin) {
      const externalWrite = {
        ...blockedWrite,
        hostname: url.hostname,
        resourceType: request.resourceType(),
      };
      const reviewed = reviewedExternalTelemetry.find((contract) =>
        contract.origin === url.origin
        && contract.pathname === url.pathname
        && contract.method === method
      );
      if (reviewed) {
        blockedExpectedExternalWrites.push({ ...externalWrite, kind: reviewed.kind });
        await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' });
      } else {
        blockedUnexpectedExternalWrites.push(externalWrite);
        await route.abort('blockedbyclient');
      }
      return;
    }

    if (method === 'POST' && url.pathname === EXPECTED_CLOUDFLARE_RUM_PATH) {
      blockedExpectedWrites.push({ ...blockedWrite, kind: 'cloudflare_rum' });
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    if (method === 'POST' && url.pathname === EXPECTED_ANALYTICS_PATH) {
      let payload;
      try {
        payload = JSON.parse(request.postData() ?? '');
      } catch {
        // Malformed analytics is still a blocked write, never a request to Production.
      }
      if (payload?.event_type === 'view'
        && typeof payload.target_id === 'string'
        && payload.target_id.trim().length > 0) {
        blockedExpectedWrites.push({
          ...blockedWrite,
          eventType: 'view',
          targetId: payload.target_id,
        });
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, skipped: 'production_smoke' }),
        });
        return;
      }
      blockedWrite.eventType = KNOWN_ANALYTICS_EVENT_TYPES.has(payload?.event_type)
        ? payload.event_type
        : null;
    }

    blockedUnexpectedWrites.push(blockedWrite);
    await route.abort('blockedbyclient');
  });

  return {
    blockedExpectedWrites,
    blockedUnexpectedWrites,
    blockedExpectedExternalWrites,
    blockedUnexpectedExternalWrites,
    stubbedExternalScripts,
  };
}

function resolveProductionOrigin() {
  const configured = process.env.PLAYWRIGHT_LIVE_BASE_URL || DEFAULT_PRODUCTION_ORIGIN;
  const url = new URL(configured);
  assert.equal(
    url.origin,
    DEFAULT_PRODUCTION_ORIGIN,
    `Refusing Production browser smoke outside ${DEFAULT_PRODUCTION_ORIGIN}.`
  );
  return url.origin;
}

function createBrowserLaunchOptions() {
  return process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : {};
}

export function summarizePendingFirstPartyRequests(pendingRequests, now = Date.now()) {
  return [...pendingRequests.values()]
    .map(({ startedAt, ...request }) => ({
      ...request,
      elapsedMs: Math.max(0, now - startedAt),
    }))
    .sort((left, right) => right.elapsedMs - left.elapsedMs)
    .slice(0, MAX_PENDING_REQUEST_DIAGNOSTICS);
}

async function visitReadOnlyPage(context, origin, pathname, check) {
  const page = await context.newPage();
  const pageErrors = [];
  const firstPartyConsoleErrors = [];
  const pendingFirstPartyRequests = new Map();
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== origin) return;
    pendingFirstPartyRequests.set(request, {
      method: request.method(),
      pathname: url.pathname,
      resourceType: request.resourceType(),
      isNavigationRequest: request.isNavigationRequest(),
      startedAt: Date.now(),
    });
  });
  page.on('requestfinished', (request) => pendingFirstPartyRequests.delete(request));
  page.on('requestfailed', (request) => pendingFirstPartyRequests.delete(request));
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const location = message.location().url;
    const isFirstParty = !location || new URL(location).origin === origin;
    if (isFirstParty || MISSING_SUPABASE_ENV_TEXT.test(message.text())) {
      firstPartyConsoleErrors.push(message.text());
    }
  });

  try {
    const response = await page.goto(new URL(pathname, origin).href, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    assert.equal(response?.status(), 200, `${pathname} must return HTTP 200.`);
    await page.locator('body').waitFor({ state: 'visible', timeout: READINESS_TIMEOUT_MS });
    const result = await check(page, () => ({
      count: pendingFirstPartyRequests.size,
      requests: summarizePendingFirstPartyRequests(pendingFirstPartyRequests),
    }));
    await page.waitForTimeout(750);

    const bodyText = await page.locator('body').innerText();
    assert(!GENERIC_ERROR_TEXT.test(bodyText), `${pathname} rendered the generic error page.`);
    assert.deepEqual(pageErrors, [], `${pathname} raised an uncaught browser error: ${pageErrors.join(' | ')}`);
    assert.deepEqual(
      firstPartyConsoleErrors,
      [],
      `${pathname} emitted a first-party browser console error: ${firstPartyConsoleErrors.join(' | ')}`
    );
    return result;
  } finally {
    await page.close();
  }
}

async function waitForLoginInput(page, timeoutMs, pendingFirstPartyRequestSummary) {
  const startedAt = Date.now();
  try {
    await page.locator('[data-testid="login-modal"] input:visible').first().waitFor({
      state: 'visible', timeout: timeoutMs,
    });
  } catch (error) {
    if (error?.name !== 'TimeoutError') throw error;
    const state = await page.evaluate(() => ({
      documentReadyState: document.readyState,
      bodyReady: Boolean(document.body),
      spinnerPresent: Boolean(document.querySelector('.animate-spin')),
      loginModalPresent: Boolean(document.querySelector('[data-testid="login-modal"]')),
      genericErrorPresent: /페이지를 불러오지 못했습니다|Something went wrong|An error occurred/i.test(document.body?.innerText ?? ''),
    }));
    const pendingRequests = pendingFirstPartyRequestSummary();
    const diagnostic = {
      elapsedMs: Date.now() - startedAt,
      ...state,
      pendingFirstPartyRequestCount: pendingRequests.count,
      pendingFirstPartyRequests: pendingRequests.requests,
    };
    if (state.genericErrorPresent) {
      throw new Error(`/login rendered a generic error before input readiness: ${JSON.stringify(diagnostic)}`, { cause: error });
    }
    throw new Error(`/login input readiness timed out: ${JSON.stringify(diagnostic)}`, { cause: error });
  }
}

export async function runProductionBrowserSmoke(
  origin = resolveProductionOrigin(),
  {
    loginReadinessTimeoutMs = LOGIN_READINESS_TIMEOUT_MS,
    reviewedExternalTelemetry = REVIEWED_EXTERNAL_TELEMETRY,
    reviewedExternalScriptStubs = REVIEWED_EXTERNAL_SCRIPT_STUBS,
  } = {}
) {
  assert(Number.isFinite(loginReadinessTimeoutMs) && loginReadinessTimeoutMs > 0);
  const browser = await chromium.launch({ headless: true, ...createBrowserLaunchOptions() });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const {
    blockedExpectedWrites,
    blockedUnexpectedWrites,
    blockedExpectedExternalWrites,
    blockedUnexpectedExternalWrites,
    stubbedExternalScripts,
  } = await installProductionMutationGate(context, origin, { reviewedExternalTelemetry, reviewedExternalScriptStubs });
  let result;
  let smokeError;

  try {
    const home = await visitReadOnlyPage(context, origin, '/', async (page) => {
      const bodyText = await page.locator('body').innerText();
      assert(bodyText.trim().length > 0, 'Production homepage rendered an empty body.');
      assert((await page.title()).trim().length > 0, 'Production homepage has no document title.');
      await page.locator('a[href^="/experiences/"]').first().waitFor({
        state: 'attached', timeout: READINESS_TIMEOUT_MS,
      });
      const hrefs = await page.locator('a[href^="/experiences/"]').evaluateAll((links) =>
        [...new Set(links.map((link) => link.getAttribute('href')).filter(Boolean))]
      );
      assert(hrefs.length > 0, 'Production homepage exposed no public experience link.');
      return { experiencePath: hrefs[0] };
    });

    await visitReadOnlyPage(context, origin, home.experiencePath, async (page) => {
      await page.locator('h1:visible').first().waitFor({
        state: 'visible', timeout: READINESS_TIMEOUT_MS,
      });
      return null;
    });

    await visitReadOnlyPage(context, origin, '/login', async (page, pendingFirstPartyRequestSummary) => {
      await waitForLoginInput(page, loginReadinessTimeoutMs, pendingFirstPartyRequestSummary);
      return null;
    });

    const apiPage = await context.newPage();
    let unauthenticatedStatus;
    try {
      const response = await apiPage.goto(new URL('/api/proxy-bookings', origin).href, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      unauthenticatedStatus = response?.status();
      assert.equal(unauthenticatedStatus, 401, 'Unauthenticated proxy booking API must return HTTP 401.');
    } finally {
      await apiPage.close();
    }

    result = {
      status: 'LOCALLY_PRODUCTION_BROWSER_SMOKE_PASS',
      origin,
      homepage: 'rendered',
      publicExperience: home.experiencePath,
      login: 'rendered',
      unauthenticatedProxyBookings: unauthenticatedStatus,
      blockedExpectedWrites,
      blockedUnexpectedWrites,
      blockedExpectedExternalWrites,
      blockedUnexpectedExternalWrites,
      stubbedExternalScripts,
    };
  } catch (error) {
    smokeError = error;
  } finally {
    await context.close();
    await browser.close();
  }

  if (blockedUnexpectedWrites.length > 0 || blockedUnexpectedExternalWrites.length > 0) {
    throw new Error(`Production smoke blocked unexpected writes: ${JSON.stringify({
      firstParty: blockedUnexpectedWrites,
      external: blockedUnexpectedExternalWrites,
    })}`, {
      cause: smokeError,
    });
  }
  if (smokeError) throw smokeError;
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  console.log(JSON.stringify(await runProductionBrowserSmoke(), null, 2));
}
