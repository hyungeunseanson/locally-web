import { expect, test, type Page } from '@playwright/test';

async function dismissAnnouncementIfVisible(page: Page) {
  const announcement = page.getByTestId('global-site-announcement-modal');
  if (await announcement.count()) {
    await page.getByTestId('global-site-announcement-primary').click();
    await expect(announcement).toHaveCount(0);
  }
}

async function prepareLocale(page: Page, locale: 'ko' | 'en' | 'ja' | 'zh', path: string) {
  await page.context().clearCookies();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((nextLocale) => {
    window.localStorage.setItem('app_lang', nextLocale);
    document.cookie = `app_lang=${nextLocale}; path=/`;
  }, locale);
  await page.goto(path, { waitUntil: 'networkidle' });
  await dismissAnnouncementIfVisible(page);
}

async function stubHomeLoadFailure(page: Page) {
  await page.route('**/rest/v1/public_host_applications?*', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'forced home load failure' }),
    });
  });
}

test.describe('Home load error state', () => {
  test('shows a load error instead of the empty-state when the home fetch fails', async ({ page }) => {
    await stubHomeLoadFailure(page);
    await page.setViewportSize({ width: 1440, height: 960 });
    await prepareLocale(page, 'en', '/en');

    const loadErrorState = page.getByTestId('home-load-error-state');
    await expect(loadErrorState).toBeVisible();
    await expect(loadErrorState).toContainText("We couldn't load the home experiences");
    await expect(page.getByTestId('home-load-error-retry')).toBeVisible();
    await expect(loadErrorState.getByRole('link', { name: 'Browse all experiences' })).toHaveAttribute('href', '/search');
    await expect(page.getByText('No matching experiences are showing on the home feed yet')).toHaveCount(0);
  });
});
