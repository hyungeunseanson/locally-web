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
    city: 'Tokyo',
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

test.describe('Search desktop map panel', () => {
  test('uses real desktop filters and keeps a square map with four cards on the first row', async ({ page }) => {
    await page.route('**/api/search/experiences?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            createExperienceFixture('9001', {
              title: '도쿄 밤 골목 산책',
              title_en: 'Tokyo Night Alley Walk',
              meeting_point: '시부야 스크램블 스타벅스',
              meeting_point_i18n: { en: 'Starbucks Shibuya Scramble' },
              location: 'Shibuya Scramble Crossing',
            }),
            createExperienceFixture('9002', {
              title: '도쿄 아침 카페 투어',
              title_en: 'Tokyo Morning Cafe Tour',
              category: 'cafe_dessert',
              category_en: 'Cafe & Dessert',
              meeting_point: '아사쿠사 문화관 앞',
              meeting_point_i18n: { en: 'In front of Asakusa Culture Center' },
              location: 'Asakusa Culture Tourist Information Center',
            }),
            createExperienceFixture('9003', { title_en: 'Tokyo Hidden Alley Walk', price: 72000 }),
            createExperienceFixture('9004', { title_en: 'Tokyo Jazz Night Crawl', price: 91000 }),
            createExperienceFixture('9005', { title_en: 'Tokyo Local Dinner Crawl', price: 98000 }),
            createExperienceFixture('9006', { title_en: 'Tokyo Sunset Photo Walk', price: 76000 }),
          ],
        }),
      });
    });

    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto('/en/search?location=tokyo&language=en&startDate=2025-05-12&endDate=2025-05-14', {
      waitUntil: 'networkidle',
    });
    await dismissAnnouncementIfVisible(page);

    await expect(page.getByTestId('search-desktop-toolbar')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('가격 범위')).toHaveCount(0);
    await expect(page.getByText('숙소 유형')).toHaveCount(0);
    await expect(page.getByTestId('search-summary-pill-location')).toContainText('Tokyo');
    await expect(page.getByTestId('search-summary-pill-date')).toContainText('May');
    await expect(page.getByTestId('search-summary-pill-language')).toContainText('English');
    await expect(page.getByTestId('search-desktop-type-chip')).toContainText('Experience type');
    await expect(page.getByTestId('search-desktop-time-chip')).toContainText('Time slot');

    const mapPanel = page.getByTestId('search-map-panel');
    await expect(mapPanel).toBeVisible();
    await expect(page.getByTestId('search-map-title')).toContainText('Tokyo Night Alley Walk');
    await expect(page.getByTestId('search-map-meeting-point')).toContainText('Starbucks Shibuya Scramble');
    await expect(page.getByTestId('search-map-external-link')).toHaveAttribute('href', /google\.com\/maps\/search/);

    const mapFrameBox = await page.getByTestId('search-map-frame').boundingBox();
    expect(mapFrameBox).not.toBeNull();
    if (mapFrameBox) {
      expect(Math.abs(mapFrameBox.width - mapFrameBox.height)).toBeLessThanOrEqual(24);
    }

    const firstIframeSrc = await page.getByTestId('search-map-iframe').getAttribute('src');
    expect(firstIframeSrc).toContain(encodeURIComponent('Starbucks Shibuya Scramble'));
    expect(firstIframeSrc).toContain(encodeURIComponent('Tokyo'));

    const cardBoxes = await Promise.all(
      ['9001', '9002', '9003', '9004', '9005'].map(async (id) => page.getByTestId(`search-result-card-${id}`).boundingBox())
    );
    for (const box of cardBoxes) {
      expect(box).not.toBeNull();
    }
    const [card1, card2, card3, card4, card5] = cardBoxes as NonNullable<(typeof cardBoxes)[number]>[];
    expect(Math.abs(card1.y - card2.y)).toBeLessThanOrEqual(8);
    expect(Math.abs(card1.y - card3.y)).toBeLessThanOrEqual(8);
    expect(Math.abs(card1.y - card4.y)).toBeLessThanOrEqual(8);
    expect(card5.y - card1.y).toBeGreaterThan(24);

    await page.getByTestId('search-result-card-9002').hover();

    await expect(page.getByTestId('search-map-title')).toContainText('Tokyo Morning Cafe Tour');
    await expect(page.getByTestId('search-map-meeting-point')).toContainText('In front of Asakusa Culture Center');

    const secondIframeSrc = await page.getByTestId('search-map-iframe').getAttribute('src');
    expect(secondIframeSrc).toContain(encodeURIComponent('In front of Asakusa Culture Center'));
    expect(secondIframeSrc).toContain(encodeURIComponent('Tokyo'));
  });
});
