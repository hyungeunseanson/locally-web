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

    const data = city === '서울'
      ? [
          {
            id: '9401',
            title: '서울 야경 산책',
            title_en: 'Seoul Night Walk',
            category: 'nightlife',
            category_en: 'Nightlife',
            city: '서울',
            country: 'Korea',
            location: '광화문역 7번 출구',
            meeting_point: '광화문역 7번 출구',
            meeting_point_i18n: { en: 'Gwanghwamun Station Exit 7' },
            languages: ['English', 'Korean'],
            image_url: '/images/company/partnership-media-kit/1.png',
            rating: 4.8,
            review_count: 18,
            price: 79000,
          },
        ]
      : city === '제주'
        ? [
            {
              id: '9402',
              title: '제주 오름 산책',
              title_en: 'Jeju Oreum Walk',
              category: 'walking_healing',
              category_en: 'Walking & Healing',
              city: '제주',
              country: 'Korea',
              location: '성산일출봉 입구',
              meeting_point: '성산일출봉 입구',
              meeting_point_i18n: { en: 'Seongsan Ilchulbong Entrance' },
              languages: ['English', 'Korean'],
              image_url: '/images/company/partnership-media-kit/1.png',
              rating: 4.7,
              review_count: 15,
              price: 69000,
            },
          ]
      : [
          {
            id: '9400',
            title: '도쿄 이자카야 워크',
            title_en: 'Tokyo Izakaya Walk',
            category: 'food_tour',
            category_en: 'Food Tour',
            city: '도쿄',
            country: 'Japan',
            location: '신주쿠역 동쪽 출구',
            meeting_point: '신주쿠역 동쪽 출구',
            meeting_point_i18n: { en: 'Shinjuku Station East Exit' },
            languages: ['English', 'Korean'],
            image_url: '/images/company/partnership-media-kit/1.png',
            rating: 4.9,
            review_count: 28,
            price: 89000,
          },
        ];

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data }),
    });
  });
}

test.describe('Home mobile city shortcuts', () => {
  test('shows the shortcut row on experience and hides it on service', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareLocale(page, 'en', '/en');

    await expect(page.getByTestId('home-mobile-city-shortcuts')).toBeVisible();
    await expect(page.getByTestId('home-mobile-city-shortcut-all')).toContainText('All');
    await expect(page.getByTestId('home-mobile-city-shortcut-tokyo')).toContainText('Tokyo');
    await expect(page.getByTestId('home-mobile-city-shortcut-osaka')).toContainText('Osaka');
    await expect(page.getByTestId('home-mobile-city-shortcut-fukuoka')).toContainText('Fukuoka');
    await expect(page.getByTestId('home-mobile-city-shortcut-seoul')).toContainText('Seoul');
    await expect(page.getByTestId('home-mobile-city-shortcut-busan')).toContainText('Busan');
    await expect(page.getByTestId('home-mobile-city-shortcut-jeju')).toContainText('Jeju');
    await expect(page.getByTestId('home-mobile-city-shortcut-seoul-visual')).toBeVisible();
    await expect(page.getByTestId('home-mobile-city-shortcut-busan-visual')).toBeVisible();
    await expect(page.getByTestId('home-mobile-city-shortcut-jeju-visual')).toBeVisible();

    await page.locator('[data-testid="home-tab-service"]:visible').first().click();
    await expect(page.getByTestId('home-mobile-city-shortcuts')).toHaveCount(0);

    await page.locator('[data-testid="home-tab-experience"]:visible').first().click();
    await expect(page.getByTestId('home-mobile-city-shortcuts')).toBeVisible();
  });

  test('navigates to search from all and city shortcuts', async ({ page }) => {
    await stubSearchApi(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareLocale(page, 'en', '/en');

    await page.getByTestId('home-mobile-city-shortcut-all').click();
    await expect(page).toHaveURL(/\/search$/);
    await expect(page.getByTestId('search-mobile-header-title')).toContainText('Search experiences');

    await page.goto('/en', { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);

    await page.getByTestId('home-mobile-city-shortcut-seoul').click();
    await expect(page).toHaveURL(/location=%EC%84%9C%EC%9A%B8/);
    await expect(page).toHaveURL(/city=%EC%84%9C%EC%9A%B8/);
    await expect(page.getByTestId('search-mobile-header-title')).toContainText('Seoul');

    await page.goto('/en', { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);

    await page.getByTestId('home-mobile-city-shortcut-jeju').click();
    await expect(page).toHaveURL(/location=%EC%A0%9C%EC%A3%BC/);
    await expect(page).toHaveURL(/city=%EC%A0%9C%EC%A3%BC/);
    await expect(page.getByTestId('search-mobile-header-title')).toContainText('Jeju');
  });
});
