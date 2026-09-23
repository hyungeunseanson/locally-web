import { expect, test, type Page } from '@playwright/test';

async function dismissAnnouncementIfVisible(page: Page) {
  const announcement = page.getByTestId('global-site-announcement-modal');
  if (await announcement.count()) {
    await page.getByTestId('global-site-announcement-primary').click();
    await expect(announcement).toHaveCount(0);
  }
}

async function prepareLocale(page: Page, locale: 'ko' | 'en' | 'ja' | 'zh', path: string) {
  await page.route('**/api/home/experiences', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [{
        id: 1,
        title: '도쿄 로컬 투어',
        title_en: 'Tokyo local tour',
        city: '도쿄',
        country: '일본',
        languages: ['일본어', '영어'],
        created_at: '2026-09-01T00:00:00Z',
        available_dates: ['2026-10-10'],
      }] }),
    });
  });
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

  test('shows a two-field desktop search without a date control', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await prepareLocale(page, 'en', '/en');

    const location = page.getByTestId('home-desktop-search-location-field');
    const language = page.getByTestId('home-desktop-search-language-field');
    const submit = page.getByTestId('home-desktop-search-submit');
    await expect(location).toBeVisible();
    await expect(language).toBeVisible();
    await expect(submit).toBeVisible();
    await expect(page.getByTestId('home-desktop-search-date-field')).toHaveCount(0);
    await expect(page.getByTestId('date-picker-next-month')).toHaveCount(0);
    await expect(page.getByText('Anytime', { exact: true })).toHaveCount(0);

    const boxes = await Promise.all([location, language, submit].map((element) => element.boundingBox()));
    expect(boxes.every(Boolean)).toBeTruthy();
    expect(boxes[0]!.x + boxes[0]!.width).toBeLessThanOrEqual(boxes[1]!.x + 1);
    expect(boxes[1]!.x + boxes[1]!.width).toBeLessThanOrEqual(boxes[2]!.x + 1);

    await language.click();
    await expect(page.getByText('English', { exact: true }).last()).toBeVisible();
    await submit.click();
  });

  test('localizes the mobile search modal and keeps the search route actionable', async ({ page }) => {
    await stubSearchApi(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareLocale(page, 'ja', '/ja');
    await page.evaluate(() => window.localStorage.setItem('locally_recent_searches', JSON.stringify([
      { name: '도쿄', desc: 'Sep 10 - Sep 12' },
    ])));
    await page.reload({ waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);
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
    await expect(page.getByText('Sep 10 - Sep 12')).toHaveCount(0);
    await expect(page.getByTestId('home-mobile-collapsed-date')).toHaveCount(0);
    await expect(page.getByTestId('home-mobile-location-option-tokyo')).toContainText('東京');
    await expect(page.getByTestId('home-mobile-location-option-osaka')).toContainText('大阪');
    await expect(page.getByTestId('home-mobile-location-option-izakaya')).toContainText('居酒屋');
    await expect(page.getByTestId('home-mobile-location-option-seoul')).toContainText('ソウル');

    await page.getByTestId('home-mobile-location-option-tokyo').click();
    await expect(page.getByTestId('home-mobile-collapsed-location')).toContainText('東京');
    await expect(page.getByTestId('home-mobile-language-panel')).toBeVisible();
    await expect(page.getByTestId('home-mobile-collapsed-date')).toHaveCount(0);
    await expect(page.getByTestId('date-picker-next-month')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    await page.getByTestId('home-mobile-language-option-jp').click();

    await page.getByTestId('home-mobile-search-submit').click();
    await expect.poll(() => analyticsPayloads.length, { timeout: 15000 }).toBe(1);
    expect(analyticsPayloads[0]).toMatchObject({
      keyword: '도쿄',
      route: 'main',
    });
    await expect(page).toHaveURL(/\/search\?/);
    expect(new URL(page.url()).searchParams.has('startDate')).toBe(false);
    expect(new URL(page.url()).searchParams.has('endDate')).toBe(false);
    expect(new URL(page.url()).searchParams.get('language')).toBe('일본어');
    await expect(page.getByTestId('search-mobile-header-title')).toContainText('東京');
  });

  test('keeps an explicit legacy date URL visible and passed to search', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const requests: URL[] = [];
    await page.route('**/api/search/experiences?**', async (route) => {
      requests.push(new URL(route.request().url()));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    });
    await prepareLocale(page, 'en', '/en/search?startDate=2026-10-10&endDate=2026-10-12');

    await expect(page.getByTestId('search-summary-pill-date')).toBeVisible();
    await expect.poll(() => requests.some((url) =>
      url.searchParams.get('startDate') === '2026-10-10' && url.searchParams.get('endDate') === '2026-10-12'
    )).toBe(true);
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
