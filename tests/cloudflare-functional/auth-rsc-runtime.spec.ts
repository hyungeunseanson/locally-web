import { expect, test } from '@playwright/test';

import { isRscRequest, loginWithPassword } from './helpers';

test.describe.serial('Auth and Next.js RSC navigation regression', () => {
  test('persists and clears the Supabase session on the Worker origin', async ({ browser, context, page }) => {
    await loginWithPassword(page);
    const storageState = await context.storageState();
    expect(storageState.cookies.some(({ name }) => /-auth-token(?:\.\d+)?$/i.test(name))).toBe(true);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/account$/);

    const restored = await browser.newContext({ storageState });
    try {
      const restoredPage = await restored.newPage();
      await restoredPage.goto(`${process.env.CLOUDFLARE_CANARY_BASE_URL}/account`);
      await expect(restoredPage).toHaveURL(/\/account$/);
    } finally {
      await restored.close();
    }

    await page.getByRole('button', { name: /Sign Out|로그아웃/i }).click();
    await expect(page).toHaveURL(new RegExp(`${process.env.CLOUDFLARE_CANARY_BASE_URL}/?$`));
  });

  test('never returns 503 during Link prefetch, authenticated RSC, rapid, and history navigation', async ({ page }) => {
    const rscStatuses: number[] = [];
    const failures: string[] = [];
    page.on('response', (response) => {
      const request = response.request();
      if (!isRscRequest(request.url(), request.headers())) return;
      rscStatuses.push(response.status());
      if (response.status() >= 500) failures.push(`${response.status()} ${request.url()}`);
    });

    await loginWithPassword(page);
    await page.getByTestId('mobile-tab-guest-trips').click();
    await expect(page).toHaveURL(/\/guest\/trips/);

    const link = page.locator('a[href="/services/my"]').first();
    await link.hover();
    await page.waitForTimeout(1_000);
    await link.click();
    await expect(page).toHaveURL(/\/services\/my/);

    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('mobile-tab-guest-inbox').click();
    await expect(page).toHaveURL(/\/guest\/inbox/);
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.goForward({ waitUntil: 'domcontentloaded' });

    await page.evaluate(() => {
      const trips = document.querySelector<HTMLElement>('[data-testid="mobile-tab-guest-trips"]');
      const account = document.querySelector<HTMLElement>('[data-testid="mobile-tab-account"]');
      trips?.click();
      account?.click();
      trips?.click();
    });
    await page.waitForTimeout(2_000);

    expect(failures).toEqual([]);
    expect(rscStatuses.length).toBeGreaterThan(0);
  });

  for (const provider of ['google', 'kakao'] as const) {
    test(`${provider} OAuth starts with the Worker callback origin`, async ({ page }) => {
      await page.goto('/login?returnUrl=%2Fguest%2Ftrips', { waitUntil: 'domcontentloaded' });
      const authorization = page.waitForRequest((request) => {
        const url = new URL(request.url());
        return url.pathname.endsWith('/auth/v1/authorize') && url.searchParams.get('provider') === provider;
      });
      await page.getByRole('button', {
        name: provider === 'google' ? /Continue with Google|Google/i : /Continue with Kakao|Kakao/i,
      }).click();
      const request = await authorization;
      const callback = new URL(new URL(request.url()).searchParams.get('redirect_to') || '');
      expect(callback.origin).toBe(new URL(process.env.CLOUDFLARE_CANARY_BASE_URL!).origin);
      expect(callback.pathname).toBe('/auth/callback');
      expect(callback.searchParams.get('next')).toBe('/guest/trips');
    });
  }
});
