import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

import { chromium } from '@playwright/test';

const DEFAULT_PRODUCTION_ORIGIN = 'https://www.locally-travel.com';
const GENERIC_ERROR_TEXT = /페이지를 불러오지 못했습니다|Something went wrong|An error occurred/i;
const MISSING_SUPABASE_ENV_TEXT = /\[Supabase\].*NEXT_PUBLIC_SUPABASE_URL.*NEXT_PUBLIC_SUPABASE_ANON_KEY/;

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

async function visitReadOnlyPage(context, origin, pathname, check) {
  const page = await context.newPage();
  const pageErrors = [];
  const firstPartyConsoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const location = message.location().url;
    const isFirstParty = !location || new URL(location).origin === origin;
    if (isFirstParty || MISSING_SUPABASE_ENV_TEXT.test(message.text())) {
      firstPartyConsoleErrors.push(message.text());
    }
  });

  const response = await page.goto(new URL(pathname, origin).href, {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  await page.waitForTimeout(750);

  assert.equal(response?.status(), 200, `${pathname} must return HTTP 200.`);
  const bodyText = await page.locator('body').innerText();
  assert(!GENERIC_ERROR_TEXT.test(bodyText), `${pathname} rendered the generic error page.`);
  assert.deepEqual(pageErrors, [], `${pathname} raised an uncaught browser error: ${pageErrors.join(' | ')}`);
  assert.deepEqual(
    firstPartyConsoleErrors,
    [],
    `${pathname} emitted a first-party browser console error: ${firstPartyConsoleErrors.join(' | ')}`
  );

  const result = await check(page, bodyText);
  await page.close();
  return result;
}

export async function runProductionBrowserSmoke(origin = resolveProductionOrigin()) {
  const browser = await chromium.launch({ headless: true, ...createBrowserLaunchOptions() });
  const context = await browser.newContext();

  try {
    const home = await visitReadOnlyPage(context, origin, '/', async (page, bodyText) => {
      assert(bodyText.trim().length > 0, 'Production homepage rendered an empty body.');
      assert((await page.title()).trim().length > 0, 'Production homepage has no document title.');
      const hrefs = await page.locator('a[href^="/experiences/"]').evaluateAll((links) =>
        [...new Set(links.map((link) => link.getAttribute('href')).filter(Boolean))]
      );
      assert(hrefs.length > 0, 'Production homepage exposed no public experience link.');
      return { experiencePath: hrefs[0] };
    });

    await visitReadOnlyPage(context, origin, home.experiencePath, async (page) => {
      assert(await page.locator('h1:visible').count() > 0, 'Public experience page has no visible heading.');
      return null;
    });

    await visitReadOnlyPage(context, origin, '/login', async (page) => {
      assert(await page.locator('input').count() > 0, 'Login page rendered no form inputs.');
      return null;
    });

    const unauthenticated = await context.request.get(new URL('/api/proxy-bookings', origin).href);
    assert.equal(unauthenticated.status(), 401, 'Unauthenticated proxy booking API must return HTTP 401.');

    return {
      status: 'LOCALLY_PRODUCTION_BROWSER_SMOKE_PASS',
      origin,
      homepage: 'rendered',
      publicExperience: home.experiencePath,
      login: 'rendered',
      unauthenticatedProxyBookings: unauthenticated.status(),
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  console.log(JSON.stringify(await runProductionBrowserSmoke(), null, 2));
}
