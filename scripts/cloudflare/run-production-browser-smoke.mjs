import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

import { chromium, errors } from '@playwright/test';
import { versionOverrideHeader } from './candidate-release-contract.mjs';

const DEFAULT_PRODUCTION_ORIGIN = 'https://www.locally-travel.com';
const GENERIC_ERROR_TEXT = /페이지를 불러오지 못했습니다|Something went wrong|An error occurred/i;
const MISSING_SUPABASE_ENV_TEXT = /\[Supabase\].*NEXT_PUBLIC_SUPABASE_URL.*NEXT_PUBLIC_SUPABASE_ANON_KEY/;
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const READINESS_TIMEOUT_MS = 15000;
const LOGIN_READINESS_TIMEOUT_MS = 45000;
const NAVIGATION_TIMEOUT_MS = 30000;
const READ_ONLY_MAX_ATTEMPTS = 2;
const READ_ONLY_RETRY_DELAY_MS = 1000;
const DIAGNOSTIC_TIMEOUT_MS = 1000;
// Only timeouts raised by the navigation/readiness operations below may retry.
const readOnlyTimeouts = new WeakMap();
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
  versionOverride,
  fetchImplementation = fetch,
} = {}) {
  const productionOrigin = new URL(origin).origin;
  const override = versionOverride === undefined ? null : versionOverrideHeader(versionOverride.workerName, versionOverride.versionId);
  const blockedExpectedWrites = [];
  const blockedUnexpectedWrites = [];
  const blockedExpectedExternalWrites = [];
  const blockedUnexpectedExternalWrites = [];
  const stubbedExternalScripts = [];
  const anonymousReadHeaders = { cookieHeadersStripped: 0, authorizationHeadersStripped: 0 };

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
      if (override && url.origin === productionOrigin) {
        const headers = { ...await request.allHeaders() };
        const hadCookie = Object.hasOwn(headers, 'cookie');
        if (hadCookie) anonymousReadHeaders.cookieHeadersStripped += 1;
        if (Object.hasOwn(headers, 'authorization')) anonymousReadHeaders.authorizationHeadersStripped += 1;
        delete headers.cookie;
        delete headers.authorization;
        delete headers['cloudflare-workers-version-overrides'];
        delete headers['x-locally-release-probe'];
        headers['Cloudflare-Workers-Version-Overrides'] = override;
        if (url.pathname === '/.well-known/locally-release' && ['GET', 'HEAD'].includes(method)) headers['X-Locally-Release-Probe'] = '1';
        const forwarding = hadCookie ? 'stateless-read' : 'browser-continue';
        // The optional second argument is an in-memory correlation only. The
        // serializable receipt deliberately contains no header or cookie values.
        versionOverride.onApplied?.({ pathname: url.pathname, resourceType: request.resourceType(), method, anonymous: true, forwarding }, request);
        if (hadCookie) {
          // Chromium ignores Cookie removal in route.continue, even after its
          // cookie jar is cleared. Forward only this read with a stateless fetch:
          // no cookie jar, credentials, redirects or retry. Preserve HTTP errors
          // and turn transport/body failures into real browser requestfailed.
          try {
            const response = await fetchImplementation(request.url(), { method, headers, redirect: 'manual', signal: AbortSignal.timeout(NAVIGATION_TIMEOUT_MS) });
            const responseHeaders = Object.fromEntries(response.headers);
            // Fetch decodes compression; let fulfill set the decoded body length.
            delete responseHeaders['content-encoding'];
            delete responseHeaders['content-length'];
            const cookies = response.headers.getSetCookie();
            if (cookies.length) responseHeaders['set-cookie'] = cookies.join('\n');
            await route.fulfill({ status: response.status, headers: responseHeaders, body: Buffer.from(await response.arrayBuffer()) });
          } catch { await route.abort('failed').catch(() => {}); }
        } else await route.continue({ headers });
      } else {
        if (override && url.origin !== productionOrigin) {
          const headers = { ...request.headers() };
          delete headers['cloudflare-workers-version-overrides'];
          delete headers['x-locally-release-probe'];
          await route.continue({ headers });
        } else await route.continue();
      }
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
    anonymousReadHeaders,
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

async function waitForReadOnlyReadiness(locator, options, stage = 'readiness') {
  const startedAt = Date.now();
  try {
    await locator.waitFor(options);
  } catch (error) {
    if (error instanceof errors.TimeoutError) {
      readOnlyTimeouts.set(error, { stage, elapsedMs: Date.now() - startedAt });
    }
    throw error;
  }
}

async function readPageState(page) {
  let timer;
  try {
    return await Promise.race([
      page.evaluate((genericErrorPattern) => ({
        documentReadyState: document.readyState,
        bodyReady: Boolean(document.body),
        spinnerPresent: Boolean(document.querySelector('.animate-spin')),
        loginModalPresent: Boolean(document.querySelector('[data-testid="login-modal"]')),
        genericErrorPresent: new RegExp(genericErrorPattern, 'i').test(document.body?.innerText ?? ''),
      }), GENERIC_ERROR_TEXT.source),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Page diagnostics timed out.')), DIAGNOSTIC_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function assertNoUnexpectedWrites(mutationGate) {
  if (mutationGate.blockedUnexpectedWrites.length || mutationGate.blockedUnexpectedExternalWrites.length) {
    throw new Error(`Production smoke blocked unexpected writes: ${JSON.stringify({
      firstParty: mutationGate.blockedUnexpectedWrites,
      external: mutationGate.blockedUnexpectedExternalWrites,
    })}`);
  }
}

export async function visitReadOnlyPage(context, origin, pathname, check, {
  mutationGate,
  attemptDiagnostics = [],
  log = console.log,
  navigationTimeoutMs = NAVIGATION_TIMEOUT_MS,
  assertAdditionalSafety = () => {},
  collectReadOnlyPageEvidence = async () => {},
} = {}) {
  assert(mutationGate, 'Read-only pages require the context mutation gate.');
  assert(Number.isFinite(navigationTimeoutMs) && navigationTimeoutMs > 0 && navigationTimeoutMs <= NAVIGATION_TIMEOUT_MS);
  const diagnosticPathname = new URL(pathname, origin).pathname;
  for (let attempt = 1; attempt <= READ_ONLY_MAX_ATTEMPTS; attempt += 1) {
    assertNoUnexpectedWrites(mutationGate);
    const page = await context.newPage();
    const pageErrors = [];
    const firstPartyConsoleErrors = [];
    const pendingFirstPartyRequests = new Map();
    let navigationStatus;
    page.on('response', (response) => {
      const request = response.request();
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        const status = response.status();
        if (status < 300 || status >= 400) navigationStatus = status;
      }
    });
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

    const navigationStartedAt = Date.now();
    let navigationElapsedMs = 0;
    let readinessStartedAt;
    let readinessElapsedMs = 0;
    let result;
    let failure;
    let state;
    try {
      let response;
      try {
        response = await page.goto(new URL(pathname, origin).href, {
          waitUntil: 'domcontentloaded',
          timeout: navigationTimeoutMs,
        });
      } catch (error) {
        if (error instanceof errors.TimeoutError) {
          readOnlyTimeouts.set(error, { stage: 'navigation', elapsedMs: Date.now() - navigationStartedAt });
        }
        throw error;
      } finally {
        navigationElapsedMs = Date.now() - navigationStartedAt;
      }
      assert.equal(response?.status(), 200, `${diagnosticPathname} must return HTTP 200.`);
      readinessStartedAt = Date.now();
      await waitForReadOnlyReadiness(page.locator('body'), { state: 'visible', timeout: READINESS_TIMEOUT_MS });
      result = await check(page, () => ({
        count: pendingFirstPartyRequests.size,
        requests: summarizePendingFirstPartyRequests(pendingFirstPartyRequests),
      }), waitForReadOnlyReadiness);
      readinessElapsedMs = Date.now() - readinessStartedAt;
      await page.waitForTimeout(750);
    } catch (error) {
      failure = error;
      if (readinessStartedAt !== undefined && !readinessElapsedMs) readinessElapsedMs = Date.now() - readinessStartedAt;
    }
    const timeout = readOnlyTimeouts.get(failure);
    const assertSafety = () => {
      assertAdditionalSafety();
      assertNoUnexpectedWrites(mutationGate);
      if (navigationStatus !== undefined) assert.equal(navigationStatus, 200, `${diagnosticPathname} must return HTTP 200.`);
      if (state?.genericErrorPresent) {
        const prefix = timeout?.stage === 'login_input_readiness'
          ? '/login rendered a generic error before input readiness'
          : `${diagnosticPathname} rendered the generic error page.`;
        throw new Error(`${prefix}: ${JSON.stringify(state)}`);
      }
      assert.deepEqual(pageErrors, [], `${diagnosticPathname} raised an uncaught browser error: ${pageErrors.join(' | ')}`);
      assert.deepEqual(
        firstPartyConsoleErrors,
        [],
        `${diagnosticPathname} emitted a first-party browser console error: ${firstPartyConsoleErrors.join(' | ')}`
      );
    };
    let safetyFailure;
    let pendingSummary;
    try {
      state = await readPageState(page);
      assertSafety();
      if (!failure) await collectReadOnlyPageEvidence(page);
    } catch (error) {
      safetyFailure = error;
    } finally {
      pendingSummary = {
        count: pendingFirstPartyRequests.size,
        requests: summarizePendingFirstPartyRequests(pendingFirstPartyRequests),
      };
      try {
        await page.close();
      } catch (error) {
        safetyFailure ??= error;
      }
    }
    // Closing a timed-out page must not erase errors or writes from that attempt.
    try {
      assertSafety();
    } catch (error) {
      safetyFailure ??= error;
    }
    const retry = Boolean(timeout && !safetyFailure && attempt < READ_ONLY_MAX_ATTEMPTS);
    const diagnostic = {
      pathname: diagnosticPathname,
      attempt,
      navigationElapsedMs,
      readinessElapsedMs,
      timeoutStage: timeout?.stage ?? null,
      elapsedMs: timeout?.elapsedMs ?? navigationElapsedMs + readinessElapsedMs,
      documentReadyState: state?.documentReadyState ?? null,
      bodyReady: state?.bodyReady ?? null,
      spinnerPresent: state?.spinnerPresent ?? null,
      loginModalPresent: state?.loginModalPresent ?? null,
      genericErrorPresent: state?.genericErrorPresent ?? null,
      pendingFirstPartyRequestCount: pendingSummary.count,
      pendingFirstPartyRequests: pendingSummary.requests,
      outcome: retry ? 'retry' : failure || safetyFailure ? 'fail' : 'pass',
    };
    attemptDiagnostics.push(diagnostic);
    log(JSON.stringify({ status: 'PRODUCTION_BROWSER_SMOKE_PAGE_ATTEMPT', ...diagnostic }));
    if (safetyFailure) throw safetyFailure;
    if (!failure) return result;
    if (retry) {
      await new Promise((resolve) => setTimeout(resolve, READ_ONLY_RETRY_DELAY_MS));
      assertNoUnexpectedWrites(mutationGate);
      continue;
    }
    if (timeout) {
      const prefix = timeout.stage === 'login_input_readiness'
        ? '/login input readiness timed out: '
        : `${diagnosticPathname} ${timeout.stage} timed out: `;
      // Do not retain Playwright's raw URL/query-bearing timeout message.
      throw new errors.TimeoutError(prefix + JSON.stringify(diagnostic));
    }
    throw failure;
  }
}

async function waitForLoginInput(page, timeoutMs) {
  await waitForReadOnlyReadiness(page.locator('[data-testid="login-modal"] input:visible').first(), {
    state: 'visible', timeout: timeoutMs,
  }, 'login_input_readiness');
}

export async function runProductionBrowserSmoke(
  origin = resolveProductionOrigin(),
  {
    loginReadinessTimeoutMs = LOGIN_READINESS_TIMEOUT_MS,
    reviewedExternalTelemetry = REVIEWED_EXTERNAL_TELEMETRY,
    reviewedExternalScriptStubs = REVIEWED_EXTERNAL_SCRIPT_STUBS,
    log = console.log,
    versionOverride,
    observeContext = async () => {},
    assertAdditionalSafety = () => {},
    collectReadOnlyPageEvidence = async () => {},
  } = {}
) {
  assert(Number.isFinite(loginReadinessTimeoutMs) && loginReadinessTimeoutMs > 0);
  if (versionOverride) versionOverrideHeader(versionOverride.workerName, versionOverride.versionId);
  const browser = await chromium.launch({ headless: true, ...createBrowserLaunchOptions() });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  let mutationGate;
  try {
    mutationGate = await installProductionMutationGate(context, origin, { reviewedExternalTelemetry, reviewedExternalScriptStubs, versionOverride });
    await observeContext(context);
  } catch (error) {
    await browser.close();
    throw error;
  }
  const {
    blockedExpectedWrites,
    blockedUnexpectedWrites,
    blockedExpectedExternalWrites,
    blockedUnexpectedExternalWrites,
    stubbedExternalScripts,
  } = mutationGate;
  const pageAttempts = [];
  const visitOptions = { mutationGate, attemptDiagnostics: pageAttempts, log, assertAdditionalSafety, collectReadOnlyPageEvidence };
  let result;
  let smokeError;

  try {
    const home = await visitReadOnlyPage(context, origin, '/', async (page, _pending, waitForReadiness) => {
      const bodyText = await page.locator('body').innerText();
      assert(bodyText.trim().length > 0, 'Production homepage rendered an empty body.');
      assert((await page.title()).trim().length > 0, 'Production homepage has no document title.');
      await waitForReadiness(page.locator('a[href^="/experiences/"]').first(), {
        state: 'attached', timeout: READINESS_TIMEOUT_MS,
      });
      const hrefs = await page.locator('a[href^="/experiences/"]').evaluateAll((links) =>
        [...new Set(links.map((link) => link.getAttribute('href')).filter(Boolean))]
      );
      assert(hrefs.length > 0, 'Production homepage exposed no public experience link.');
      return { experiencePath: hrefs[0] };
    }, visitOptions);

    await visitReadOnlyPage(context, origin, home.experiencePath, async (page, _pending, waitForReadiness) => {
      await waitForReadiness(page.locator('h1:visible').first(), {
        state: 'visible', timeout: READINESS_TIMEOUT_MS,
      });
      return null;
    }, visitOptions);

    await visitReadOnlyPage(context, origin, '/login', async (page) => {
      await waitForLoginInput(page, loginReadinessTimeoutMs);
      return null;
    }, visitOptions);

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
      pageAttempts,
      blockedExpectedWrites,
      blockedUnexpectedWrites,
      blockedExpectedExternalWrites,
      blockedUnexpectedExternalWrites,
      stubbedExternalScripts,
      anonymousReadHeaders: mutationGate.anonymousReadHeaders,
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
  assertAdditionalSafety();
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  console.log(JSON.stringify(await runProductionBrowserSmoke(), null, 2));
}
