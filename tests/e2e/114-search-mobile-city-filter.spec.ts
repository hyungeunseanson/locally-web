import { expect, test } from '@playwright/test';

async function dismissAnnouncementIfVisible(page: import('@playwright/test').Page) {
  const announcement = page.getByTestId('global-site-announcement-modal');
  if (await announcement.count()) {
    await page.getByTestId('global-site-announcement-primary').click();
    await expect(announcement).toHaveCount(0);
  }
}

function createExperienceFixture(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `도쿄 체험 ${id}`,
    title_en: `Tokyo Experience ${id}`,
    category: 'nightlife',
    category_en: 'Nightlife',
    city: '도쿄',
    country: 'Japan',
    location: `Tokyo Station Exit ${id}`,
    meeting_point: `도쿄 미팅 포인트 ${id}`,
    meeting_point_i18n: {
      en: `Tokyo Meeting Point ${id}`,
    },
    languages: ['English', 'Korean'],
    image_url: '/images/company/partnership-media-kit/1.png',
    rating: 4.8,
    review_count: 12,
    price: 85000,
    ...overrides,
  };
}

test.describe('Search mobile city filter', () => {
  test('shows city as the third chip and updates results from the city sheet', async ({ page }) => {
    await page.route('**/api/search/experiences?**', async (route) => {
      const url = new URL(route.request().url());
      const city = url.searchParams.get('city');

      const data =
        city === '오사카'
          ? [
              createExperienceFixture('9201', {
                title_en: 'Osaka Backstreet Dinner Walk',
                city: '오사카',
                location: 'Namba Station Exit 5',
                meeting_point: '난바역 5번 출구',
                meeting_point_i18n: { en: 'Namba Station Exit 5' },
              }),
              createExperienceFixture('9202', {
                title_en: 'Osaka Cafe Morning',
                category: 'cafe_dessert',
                category_en: 'Cafe & Dessert',
                city: '오사카',
                location: 'Umeda Station Central Gate',
                meeting_point: '우메다역 중앙 개찰구',
                meeting_point_i18n: { en: 'Umeda Station Central Gate' },
              }),
            ]
          : [
              createExperienceFixture('9200', {
                title_en: 'Tokyo Night Alley Walk',
                location: 'Shibuya Scramble Crossing',
              }),
              createExperienceFixture('9203', {
                title_en: 'Tokyo Morning Cafe Tour',
                category: 'cafe_dessert',
                category_en: 'Cafe & Dessert',
              }),
            ];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data }),
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/search?location=tokyo&language=en', { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);

    await expect(page.getByTestId('search-mobile-city-chip')).toBeVisible();
    await expect(page.getByTestId('search-mobile-city-chip')).toContainText('City');
    await expect(page.getByTestId('search-mobile-result-card-9200').first()).toBeVisible();

    await page.getByTestId('search-mobile-city-chip').click();
    await expect(page.getByTestId('search-mobile-city-sheet')).toBeVisible();
    await expect(page.getByTestId('search-mobile-city-option-all')).toContainText('All');
    await expect(page.getByTestId('search-mobile-city-option-도쿄')).toContainText('Tokyo');
    await expect(page.getByTestId('search-mobile-city-option-오사카')).toContainText('Osaka');

    await page.getByTestId('search-mobile-city-option-오사카').click();
    await expect(page).toHaveURL(/location=tokyo/);
    await expect(page).toHaveURL(/city=%EC%98%A4%EC%82%AC%EC%B9%B4/);
    await page.getByRole('button', { name: 'Show results' }).click();

    await expect(page.getByTestId('search-mobile-header-title')).toContainText('Tokyo');
    await expect(page.getByTestId('search-mobile-city-chip')).toContainText('Osaka');
    await expect(page.getByTestId('search-mobile-result-card-9201').first()).toBeVisible();
    await expect(page.getByTestId('search-mobile-result-card-9201').first()).toContainText('Osaka Backstreet Dinner Walk');
  });
});
