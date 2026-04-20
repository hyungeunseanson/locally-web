import { expect, test, type Page } from '@playwright/test';

async function setLocaleCookie(
  page: Page,
  locale: 'ko' | 'en' | 'ja' | 'zh',
  baseURL: string
) {
  await page.context().clearCookies();
  await page.context().addCookies([
    {
      name: 'app_lang',
      value: locale,
      url: baseURL,
      sameSite: 'Lax',
    },
  ]);
}

test.describe('About image landing locale gate', () => {
  test('shows the Korean image landing with a localized og:image', async ({ page }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? 'http://127.0.0.1:3000';

    await setLocaleCookie(page, 'ko', baseURL);
    await page.goto('/about', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('img[src*="/images/about/desktop/ko/1.png"]')).toBeVisible();
    await expect(page.locator('img[src*="images.unsplash.com"]')).toHaveCount(0);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      /\/images\/about\/desktop\/ko\/1\.png$/
    );
  });

  test('shows the Japanese image landing with a localized og:image', async ({ page }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? 'http://127.0.0.1:3000';

    await setLocaleCookie(page, 'ja', baseURL);
    await page.goto('/ja/about', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('img[src*="/images/about/desktop/ja/1.png"]')).toBeVisible();
    await expect(page.locator('img[src*="images.unsplash.com"]')).toHaveCount(0);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      /\/images\/about\/desktop\/ja\/1\.png$/
    );
  });

  test('keeps editorial about for locales without complete image sets', async ({ page }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? 'http://127.0.0.1:3000';
    const cases = [
      { locale: 'en' as const, pathname: '/en/about' },
      { locale: 'zh' as const, pathname: '/zh/about' },
    ];

    for (const item of cases) {
      await setLocaleCookie(page, item.locale, baseURL);
      await page.goto(item.pathname, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('img[src*="/images/about/desktop/"]')).toHaveCount(0);
      await expect(page.locator('img[src*="/images/about/mobile/"]')).toHaveCount(0);
      await expect(page.locator('img[src*="images.unsplash.com"]').first()).toBeVisible();
      await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);
    }
  });
});
