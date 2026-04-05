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
    const url = new URL(route.request().url());
    const city = url.searchParams.get('city') || '';

    const base = {
      category: 'nightlife',
      category_en: 'Nightlife',
      country: 'Japan',
      image_url: '/images/company/partnership-media-kit/1.png',
      languages: ['English', 'Korean'],
      rating: 4.8,
      review_count: 12,
      price: 85000,
    };

    const data = city === '오사카'
      ? [
          {
            ...base,
            id: '9501',
            title: '오사카 골목 산책',
            title_en: 'Osaka Backstreet Walk',
            city: '오사카',
            location: '난바역 5번 출구',
            meeting_point: '난바역 5번 출구',
            meeting_point_i18n: { en: 'Namba Station Exit 5' },
          },
        ]
      : city === '서울'
        ? [
            {
              ...base,
              id: '9502',
              title: '서울 야경 산책',
              title_en: 'Seoul Night Walk',
              city: '서울',
              country: 'Korea',
              location: '광화문역 7번 출구',
              meeting_point: '광화문역 7번 출구',
              meeting_point_i18n: { en: 'Gwanghwamun Station Exit 7' },
            },
          ]
        : [
            {
              ...base,
              id: '9500',
              title: '도쿄 이자카야 워크',
              title_en: 'Tokyo Izakaya Walk',
              city: '도쿄',
              location: '신주쿠역 동쪽 출구',
              meeting_point: '신주쿠역 동쪽 출구',
              meeting_point_i18n: { en: 'Shinjuku Station East Exit' },
            },
          ];

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data }),
    });
  });
}

test.describe('Search mobile header city picker', () => {
  test('opens the city sheet from the header and updates location plus city together', async ({ page }) => {
    await stubSearchApi(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareLocale(page, 'en', '/en/search?location=%EB%8F%84%EC%BF%84&city=%EB%8F%84%EC%BF%84');

    await expect(page.getByTestId('search-mobile-header-title')).toContainText('Tokyo');

    await page.getByTestId('search-mobile-header-trigger').click();
    await expect(page.getByTestId('search-mobile-city-sheet')).toBeVisible();
    await expect(page.getByTestId('search-mobile-city-option-all')).toContainText('All');
    await expect(page.getByTestId('search-mobile-city-option-도쿄')).toContainText('Tokyo');
    await expect(page.getByTestId('search-mobile-city-option-오사카')).toContainText('Osaka');
    await expect(page.getByTestId('search-mobile-city-option-서울')).toContainText('Seoul');

    await page.getByTestId('search-mobile-city-option-오사카').click();
    await expect(page).toHaveURL(/location=%EC%98%A4%EC%82%AC%EC%B9%B4/);
    await expect(page).toHaveURL(/city=%EC%98%A4%EC%82%AC%EC%B9%B4/);
    await expect(page.getByTestId('search-mobile-header-title')).toContainText('Osaka');

    await page.getByRole('button', { name: 'Show results' }).click();
    await expect(page.getByTestId('search-mobile-city-sheet')).toHaveCount(0);
    await expect(page.getByTestId('search-mobile-result-card-9501').first()).toBeVisible();
  });

  test('clears location and city together when selecting all from the header picker', async ({ page }) => {
    await stubSearchApi(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareLocale(page, 'ja', '/ja/search?location=%EC%84%9C%EC%9A%B8&city=%EC%84%9C%EC%9A%B8');

    await expect(page.getByTestId('search-mobile-header-title')).toContainText('ソウル');

    await page.getByTestId('search-mobile-header-trigger').click();
    await expect(page.getByTestId('search-mobile-city-sheet')).toBeVisible();

    await page.getByTestId('search-mobile-city-option-all').click();
    await page.getByRole('button', { name: '結果を見る' }).click();

    const url = new URL(page.url());
    expect(url.searchParams.get('location')).toBeNull();
    expect(url.searchParams.get('city')).toBeNull();
    await expect(page.getByTestId('search-mobile-header-title')).toContainText('体験を探す');
  });
});
