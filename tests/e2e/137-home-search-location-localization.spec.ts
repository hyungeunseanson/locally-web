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

async function stubSearchApi(page: Page) {
  await page.route('**/api/search/experiences?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
  });
}

function getNextMonthDateFixture() {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1, 1);

  const year = nextMonth.getFullYear();
  const month = nextMonth.getMonth() + 1;
  const startDate = new Date(year, month - 1, 10);
  const endDate = new Date(year, month - 1, 12);
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return {
    startTestId: `date-picker-day-${year}-${month}-10`,
    endTestId: `date-picker-day-${year}-${month}-12`,
    expectedValue: `${formatter.format(startDate)} - ${formatter.format(endDate)}`,
  };
}

test.describe('Home/search location localization', () => {
  test('localizes desktop home recommended places and preserves localized input display', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await prepareLocale(page, 'en', '/en');

    await page.getByTestId('home-desktop-search-location-field').click();
    await expect(page.getByTestId('home-desktop-location-popover')).toBeVisible();
    await expect(page.getByTestId('home-desktop-location-option-tokyo')).toContainText('Tokyo');
    await expect(page.getByTestId('home-desktop-location-option-tokyo')).toContainText('Where Tokyo Tower lights up the skyline');
    await expect(page.getByTestId('home-desktop-location-option-osaka')).toContainText('Osaka');
    await expect(page.getByTestId('home-desktop-location-option-izakaya')).toContainText('Izakaya');
    await expect(page.getByTestId('home-desktop-location-option-seoul')).toContainText('Seoul');

    await page.getByTestId('home-desktop-location-option-tokyo').click();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15000 })
      .toBe('/en');
    await expect(page.getByTestId('home-desktop-popular-experiences-section')).toBeVisible();
    await expect(page.getByTestId('home-desktop-all-experiences-section')).toBeVisible();
    await expect(page.getByTestId('home-desktop-search-location-field').locator('input')).toHaveValue('Tokyo');
  });

  test('formats desktop home dates with the active locale instead of Korean-only tokens', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await prepareLocale(page, 'en', '/en');

    const nextMonthDate = getNextMonthDateFixture();
    const dateInput = page.getByTestId('home-desktop-search-date-field').locator('input');

    await page.getByTestId('home-desktop-search-date-field').click();
    await page.getByTestId('date-picker-next-month').click();
    await page.getByTestId(nextMonthDate.startTestId).click();
    await page.getByTestId(nextMonthDate.endTestId).click();

    await expect(dateInput).toHaveValue(nextMonthDate.expectedValue);
    expect(await dateInput.inputValue()).not.toMatch(/[월일]/);
  });

  test('localizes the mobile search modal and keeps the search route actionable', async ({ page }) => {
    await stubSearchApi(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareLocale(page, 'ja', '/ja');
    const analyticsPayloads: Array<{ keyword?: string; route?: string }> = [];

    await page.route('**/api/analytics/search', async (route) => {
      analyticsPayloads.push((route.request().postDataJSON() as { keyword?: string; route?: string }) || {});
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.getByTestId('home-mobile-search-trigger').click();
    await expect(page.getByTestId('home-mobile-location-panel')).toBeVisible();
    await expect(page.getByTestId('home-mobile-location-option-tokyo')).toContainText('東京');
    await expect(page.getByTestId('home-mobile-location-option-osaka')).toContainText('大阪');
    await expect(page.getByTestId('home-mobile-location-option-izakaya')).toContainText('居酒屋');
    await expect(page.getByTestId('home-mobile-location-option-seoul')).toContainText('ソウル');

    await page.getByTestId('home-mobile-location-option-tokyo').click();
    await expect(page.getByTestId('home-mobile-collapsed-location')).toContainText('東京');

    await page.getByTestId('home-mobile-search-submit').click();
    await expect.poll(() => analyticsPayloads.length, { timeout: 15000 }).toBe(1);
    expect(analyticsPayloads[0]).toMatchObject({
      keyword: '도쿄',
      route: 'main',
    });
    await expect(page).toHaveURL(/\/search\?/);
    await expect(page.getByTestId('search-mobile-header-title')).toContainText('東京');
  });

  test('localizes search header labels for alias and non-preset city inputs', async ({ page }) => {
    await stubSearchApi(page);
    await page.setViewportSize({ width: 1440, height: 960 });

    const cases = [
      { locale: 'en' as const, path: '/en/search?location=후쿠오카', expected: 'Fukuoka' },
      { locale: 'zh' as const, path: '/zh/search?location=서울', expected: '首尔' },
      { locale: 'ja' as const, path: '/ja/search?location=Tokyo', expected: '東京' },
    ];

    for (const item of cases) {
      await prepareLocale(page, item.locale, item.path);
      await expect(page.getByTestId('search-summary-pill-location')).toContainText(item.expected);
    }
  });
});
