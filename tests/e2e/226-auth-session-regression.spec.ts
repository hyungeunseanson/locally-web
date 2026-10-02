import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { waitForLoginHydration } from './helpers/loginHydration';

import {
  MOCK_AUTH_EMAIL,
  MOCK_AUTH_PASSWORD,
  startMockSupabaseAuthServer,
  type MockSupabaseAuthServer,
} from './helpers/mockSupabaseAuthServer';

const APP_ORIGIN = 'http://127.0.0.1:3000';

let mockSupabase: MockSupabaseAuthServer;

function isSupabaseSessionCookie(name: string) {
  return /-auth-token(?:\.\d+)?$/i.test(name) || /-refresh-token(?:\.\d+)?$/i.test(name);
}

async function setEnglishLocale(context: BrowserContext) {
  await context.addCookies([
    {
      name: 'app_lang',
      value: 'en',
      url: APP_ORIGIN,
    },
  ]);
}

async function dismissGlobalAnnouncement(page: Page) {
  await waitForLoginHydration(page);
  const dismissButton = page.getByTestId('global-site-announcement-dismiss');
  if (await dismissButton.isVisible().catch(() => false)) {
    await dismissButton.click();
  }
}

test.describe('Auth session regression gate', () => {
  test.beforeAll(async () => {
    mockSupabase = await startMockSupabaseAuthServer();
  });

  test.afterAll(async () => {
    await mockSupabase.close();
  });

  test.beforeEach(async ({ context }) => {
    mockSupabase.resetRequests();
    await setEnglishLocale(context);
  });

  for (const path of ['/login']) {
    test(`resolved no-session SSR exposes the form without JavaScript: ${path}`, async ({ browser }) => {
      const context = await browser.newContext({ javaScriptEnabled: false, baseURL: APP_ORIGIN });
      try {
        await setEnglishLocale(context);
        const page = await context.newPage();
        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
        await expect(page.locator('.animate-spin')).toHaveCount(0);
      } finally { await context.close(); }
    });
  }

  for (const path of ['/login?returnUrl=%2Faccount', '/en/login?returnUrl=%2Faccount']) {
    test(`login form precedes delayed static JavaScript hydration in cold Chromium: ${path}`, async ({ page }) => {
      let release!: () => void;
      const held = new Promise<void>(resolve => { release = resolve; });
      let pendingScripts = 0;
      await page.route('**/_next/static/**/*.js*', async route => {
        pendingScripts++;
        await held;
        await route.continue();
      });
      try {
        // DOMContentLoaded waits for deferred scripts; inspect SSR after commit instead.
        await page.goto(path, { waitUntil: 'commit' });
        await expect.poll(() => pendingScripts).toBeGreaterThan(0);
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
        await expect(page.locator('.animate-spin')).toHaveCount(0);
      } finally { release(); }
      await page.waitForLoadState('domcontentloaded');
      await dismissGlobalAnnouncement(page);
      await page.locator('input[type="email"]').fill(MOCK_AUTH_EMAIL);
      await page.locator('input[type="password"]').fill(MOCK_AUTH_PASSWORD);
      await page.getByRole('button', { name: 'Log in', exact: true }).click();
      await expect(page).toHaveURL(/\/account$/);
    });

  }

  for (const stale of [false, true]) {
    test(`server resolves ${stale ? 'stale' : 'valid'} session before login SSR`, async ({ page, context, browser }) => {
      await page.goto('/login?returnUrl=%2Faccount');
      await dismissGlobalAnnouncement(page);
      await page.locator('input[type="email"]').fill(MOCK_AUTH_EMAIL);
      await page.locator('input[type="password"]').fill(MOCK_AUTH_PASSWORD);
      await page.getByRole('button', { name: 'Log in', exact: true }).click();
      await expect(page).toHaveURL(/\/account$/);
      const state = await context.storageState();
      mockSupabase.resetRequests();
      if (stale) mockSupabase.setUserStatus(401);
      const noJs = await browser.newContext({ javaScriptEnabled: false, storageState: state, baseURL: APP_ORIGIN });
      try {
        const ssrPage = await noJs.newPage();
        await ssrPage.goto('/login');
        expect(mockSupabase.requests.some(({ method, url }) => method === 'GET' && new URL(url).pathname === '/auth/v1/user')).toBe(true);
        if (stale) {
          await expect(ssrPage.locator('input[type="email"]')).toBeVisible();
          await expect(ssrPage.locator('input[type="password"]')).toBeVisible();
          await expect(ssrPage.locator('.animate-spin')).toHaveCount(0);
        } else {
          await expect(ssrPage.locator('input[type="email"]')).toHaveCount(0);
          // Hydrated valid-session behavior remains the existing returnUrl redirect.
          await page.goto('/login?returnUrl=%2Faccount');
          await expect(page).toHaveURL(/\/account$/);
        }
      } finally {
        mockSupabase.setUserStatus(200);
        await noJs.close();
      }
    });
  }

  test('email login persists across reload and a new browser context, then logout clears the session', async ({
    browser,
    context,
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login?returnUrl=%2Faccount');
    await dismissGlobalAnnouncement(page);

    await page.locator('input[type="email"]').fill(MOCK_AUTH_EMAIL);
    await page.locator('input[type="password"]').fill(MOCK_AUTH_PASSWORD);
    await page.getByRole('button', { name: 'Log in', exact: true }).click();

    await expect(page).toHaveURL(/\/account$/);
    expect(mockSupabase.requests.some(({ method, url }) => {
      const requestUrl = new URL(url);
      return method === 'POST'
        && requestUrl.pathname === '/auth/v1/token'
        && requestUrl.searchParams.get('grant_type') === 'password';
    })).toBe(true);
    await expect.poll(async () => {
      const cookies = await context.cookies(APP_ORIGIN);
      return cookies.some(({ name }) => isSupabaseSessionCookie(name));
    }).toBe(true);

    await page.reload();
    await expect(page).toHaveURL(/\/account$/);

    await page.goto('/en/account');
    await expect(page).toHaveURL(/\/en\/account$/);
    await expect(page.getByRole('button', { name: 'Sign Out', exact: true })).toBeVisible();
    expect((await context.cookies(APP_ORIGIN)).some(({ name }) => isSupabaseSessionCookie(name))).toBe(true);

    const persistedState = await context.storageState();
    const restoredContext = await browser.newContext({
      baseURL: APP_ORIGIN,
      storageState: persistedState,
      viewport: { width: 390, height: 844 },
    });

    try {
      const restoredPage = await restoredContext.newPage();
      await restoredPage.goto('/account');
      await expect(restoredPage).toHaveURL(/\/account$/);
      await expect(restoredPage.getByRole('button', { name: 'Sign Out', exact: true })).toBeVisible();
    } finally {
      await restoredContext.close();
    }

    await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
    await expect(page).toHaveURL(`${APP_ORIGIN}/`);
    expect(mockSupabase.requests.some(({ method, url }) => {
      return method === 'POST' && new URL(url).pathname === '/auth/v1/logout';
    })).toBe(true);
    await expect.poll(async () => {
      const cookies = await context.cookies(APP_ORIGIN);
      return cookies.some(({ name }) => isSupabaseSessionCookie(name));
    }).toBe(false);

    await page.goto('/account');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Faccount$/);
  });

  test('locale-prefixed login keeps the return path and session', async ({ page, context }) => {
    const response = await page.goto('/en/login?returnUrl=%2Fen%2Faccount');
    expect(response?.status()).toBe(200);
    await dismissGlobalAnnouncement(page);
    await page.locator('input[type="email"]').fill(MOCK_AUTH_EMAIL);
    await page.locator('input[type="password"]').fill(MOCK_AUTH_PASSWORD);
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/account$/);
    await expect(page.getByRole('heading', { name: 'Profile & Account' })).toBeVisible();
    expect((await context.cookies(APP_ORIGIN)).some(({ name }) => isSupabaseSessionCookie(name))).toBe(true);
  });

  for (const provider of ['google', 'kakao'] as const) {
    test(`${provider} OAuth uses the active origin and preserves the internal return path`, async ({ page }) => {
      await page.goto('/login?returnUrl=%2Fguest%2Ftrips');
      await dismissGlobalAnnouncement(page);

      const authorizationRequest = page.waitForRequest((request) => {
        const url = new URL(request.url());
        return url.origin === mockSupabase.origin && url.pathname === '/auth/v1/authorize';
      });

      await page.getByRole('button', {
        name: provider === 'google' ? 'Continue with Google' : 'Continue with Kakao',
        exact: true,
      }).click();

      const request = await authorizationRequest;
      const authorizationUrl = new URL(request.url());
      const callbackUrl = new URL(authorizationUrl.searchParams.get('redirect_to') ?? '');

      expect(authorizationUrl.searchParams.get('provider')).toBe(provider);
      expect(callbackUrl.origin).toBe(APP_ORIGIN);
      expect(callbackUrl.pathname).toBe('/auth/callback');
      expect(callbackUrl.searchParams.get('next')).toBe('/guest/trips');
    });
  }
});
