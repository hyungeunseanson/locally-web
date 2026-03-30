import { expect, test } from '@playwright/test';

async function dismissAnnouncementIfVisible(page: import('@playwright/test').Page) {
  const announcement = page.getByTestId('global-site-announcement-modal');
  if (await announcement.count()) {
    await page.getByTestId('global-site-announcement-primary').click();
    await expect(announcement).toHaveCount(0);
  }
}

test.describe('Search desktop map panel', () => {
  test('shows a Google Maps view for the active experience meeting point', async ({ page }) => {
    await page.route('**/api/search/experiences?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: '9001',
              title: '도쿄 밤 골목 산책',
              title_en: 'Tokyo Night Alley Walk',
              category: 'nightlife',
              category_en: 'Nightlife',
              city: 'Tokyo',
              country: 'Japan',
              location: 'Shibuya Scramble Crossing',
              meeting_point: '시부야 스크램블 스타벅스',
              meeting_point_i18n: {
                en: 'Starbucks Shibuya Scramble',
              },
              languages: ['English', 'Korean'],
              image_url: '/images/company/partnership-media-kit/1.png',
              rating: 4.8,
              review_count: 12,
              price: 85000,
            },
            {
              id: '9002',
              title: '도쿄 아침 카페 투어',
              title_en: 'Tokyo Morning Cafe Tour',
              category: 'cafe_dessert',
              category_en: 'Cafe & Dessert',
              city: 'Tokyo',
              country: 'Japan',
              location: 'Asakusa Culture Tourist Information Center',
              meeting_point: '아사쿠사 문화관 앞',
              meeting_point_i18n: {
                en: 'In front of Asakusa Culture Center',
              },
              languages: ['English'],
              image_url: '/images/company/partnership-media-kit/2.png',
              rating: 4.6,
              review_count: 7,
              price: 69000,
            },
          ],
        }),
      });
    });

    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto('/en/search?location=tokyo', { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);

    const mapPanel = page.getByTestId('search-map-panel');
    await expect(mapPanel).toBeVisible({ timeout: 15000 });
    await expect(mapPanel).not.toContainText('지도 뷰 준비 중입니다.');
    await expect(page.getByTestId('search-map-title')).toContainText('Tokyo Night Alley Walk');
    await expect(page.getByTestId('search-map-meeting-point')).toContainText('Starbucks Shibuya Scramble');
    await expect(page.getByTestId('search-map-external-link')).toHaveAttribute('href', /google\.com\/maps\/search/);

    const firstIframeSrc = await page.getByTestId('search-map-iframe').getAttribute('src');
    expect(firstIframeSrc).toContain(encodeURIComponent('Starbucks Shibuya Scramble'));
    expect(firstIframeSrc).toContain(encodeURIComponent('Tokyo'));

    await page.getByTestId('search-result-card-9002').hover();

    await expect(page.getByTestId('search-map-title')).toContainText('Tokyo Morning Cafe Tour');
    await expect(page.getByTestId('search-map-meeting-point')).toContainText('In front of Asakusa Culture Center');
    await expect(page.getByTestId('search-map-external-link')).toHaveAttribute(
      'href',
      new RegExp(encodeURIComponent('In front of Asakusa Culture Center'))
    );

    const secondIframeSrc = await page.getByTestId('search-map-iframe').getAttribute('src');
    expect(secondIframeSrc).toContain(encodeURIComponent('In front of Asakusa Culture Center'));
    expect(secondIframeSrc).toContain(encodeURIComponent('Tokyo'));
  });
});
