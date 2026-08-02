import { expect, test } from '@playwright/test';

const IOS_INSTAGRAM_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 392.0.0.0.1';
const ANDROID_INSTAGRAM_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36 Instagram 392.0.0.0.1';
const IOS_SAFARI_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';

test.describe('Linktree external browser handoff', () => {
  test('redirects normal browsers directly to the selected destination', async ({ browser }) => {
    const context = await browser.newContext({ userAgent: IOS_SAFARI_USER_AGENT });
    const page = await context.newPage();

    await page.goto('/open-browser/home');

    await expect(page).toHaveURL(/\/?utm_source=instagram&utm_medium=social&utm_campaign=linktree_home$/);
    await expect(page.getByTestId('external-browser-handoff')).toHaveCount(0);
    await context.close();
  });

  test('shows explicit iPhone instructions inside the Instagram browser', async ({ browser }) => {
    const context = await browser.newContext({
      locale: 'ko-KR',
      userAgent: IOS_INSTAGRAM_USER_AGENT,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    await page.goto('/open-browser/home');

    await expect(page).toHaveURL(/\/open-browser\/home$/);
    await expect(page.getByTestId('external-browser-handoff')).toBeVisible();
    await expect(page.getByTestId('external-browser-ios-instructions')).toBeVisible();
    await expect(page.getByTestId('external-browser-android-action')).toHaveCount(0);
    await expect(page.getByText('외부 브라우저에서 열어주세요')).toBeVisible();
    await expect(page.getByTestId('mobile-tab-home')).toHaveCount(0);
    await expect(page.getByTestId('desktop-footer-ad')).toHaveCount(0);
    await page.setViewportSize({ width: 834, height: 1112 });
    await expect(page.locator('footer')).toHaveCount(0);

    await context.close();
  });

  test('offers an Android Chrome intent with an HTTPS fallback', async ({ browser }) => {
    const context = await browser.newContext({
      locale: 'ko-KR',
      userAgent: ANDROID_INSTAGRAM_USER_AGENT,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    await page.goto('/open-browser/host');

    const action = page.getByTestId('external-browser-android-action');
    await expect(action).toBeVisible();
    await expect(action).toHaveAttribute(
      'href',
      /^intent:\/\/[^/]+\/become-a-host\?utm_source=instagram.*package=com\.android\.chrome;.*browser_fallback_url=/,
    );
    const continueHref = await page
      .getByRole('link', { name: '현재 창에서 계속하기' })
      .getAttribute('href');
    const continueUrl = new URL(continueHref || '');
    expect(continueUrl.pathname).toBe('/become-a-host');
    expect(continueUrl.searchParams.get('utm_source')).toBe('instagram');
    expect(continueUrl.searchParams.get('utm_medium')).toBe('social');
    expect(continueUrl.searchParams.get('utm_campaign')).toBe('linktree_host');

    await context.close();
  });

  test('rejects targets outside the fixed allowlist', async ({ request }) => {
    const response = await request.get('/open-browser/https:%2F%2Fevil.example', {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(404);
  });
});
