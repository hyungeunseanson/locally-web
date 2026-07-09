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

test.describe('Search desktop selection map panel', () => {
  test.setTimeout(60000);

  test('shows city chip, selection-based map updates, and CTA navigation', async ({ page }) => {
    await page.route('**/api/search/experiences?**', async (route) => {
      const url = new URL(route.request().url());
      const city = url.searchParams.get('city');

      const data =
        city === '오사카'
          ? [
              createExperienceFixture('9101', {
                title_en: 'Osaka Backstreet Dinner Walk',
                city: '오사카',
                location: 'Namba Station Exit 5',
                meeting_point: '난바역 5번 출구',
                meeting_point_i18n: { en: 'Namba Station Exit 5' },
              }),
              createExperienceFixture('9102', {
                title_en: 'Osaka Night Food Tour',
                city: '오사카',
                location: 'Dotonbori Glico Sign',
                meeting_point: '도톤보리 글리코상 앞',
                meeting_point_i18n: { en: 'In front of the Dotonbori Glico Sign' },
              }),
            ]
          : [
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
            ];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data }),
      });
    });

    await page.setViewportSize({ width: 1850, height: 867 });
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
    await expect(page.getByTestId('search-desktop-city-chip')).toContainText('City');
    await expect(page.getByTestId('search-desktop-type-chip')).toContainText('Experience type');
    await expect(page.getByTestId('search-desktop-time-chip')).toContainText('Time slot');

    const layoutMetrics = await page.evaluate(() => {
      const header = document.querySelector('header');
      const toolbar = document.querySelector('[data-testid="search-desktop-toolbar"]');
      const grid = toolbar?.nextElementSibling as HTMLElement | null;
      const mapState = document.querySelector('[data-testid="search-map-empty-state"]') as HTMLElement | null;
      const rect = (element: Element | null) => {
        if (!element) return null;
        const { top, bottom, left, right, width, height } = element.getBoundingClientRect();
        return { top, bottom, left, right, width, height };
      };

      return {
        header: rect(header),
        toolbar: rect(toolbar),
        toolbarPosition: toolbar ? getComputedStyle(toolbar).position : '',
        gridTemplateColumns: grid ? getComputedStyle(grid).gridTemplateColumns : '',
        mapPanel: rect(mapState?.parentElement || null),
        viewportRight: window.innerWidth,
      };
    });

    expect(layoutMetrics.header).not.toBeNull();
    expect(layoutMetrics.toolbar).not.toBeNull();
    if (layoutMetrics.header && layoutMetrics.toolbar) {
      expect(layoutMetrics.toolbar.top - layoutMetrics.header.bottom).toBeLessThanOrEqual(24);
    }
    expect(layoutMetrics.toolbarPosition).toBe('static');
    expect(layoutMetrics.gridTemplateColumns).toContain('700px');
    expect(layoutMetrics.mapPanel).not.toBeNull();
    if (layoutMetrics.mapPanel) {
      expect(layoutMetrics.viewportRight - layoutMetrics.mapPanel.right).toBeLessThanOrEqual(48);
    }

    await expect(page.getByTestId('search-map-empty-state')).toBeVisible();
    await expect(page.getByTestId('search-selected-experience-cta')).toBeDisabled();
    await expect(page.getByTestId('search-result-card-9002')).toHaveAttribute('data-selected', 'false');
    await expect(
      page.getByTestId('search-result-card-9002').getByTestId('experience-card-category-badge')
    ).toContainText('Cafe & Dessert');

    await page.getByTestId('search-desktop-city-chip').click();
    await expect(page.getByTestId('search-city-option-all')).toContainText('All');
    await expect(page.getByTestId('search-city-option-도쿄')).toContainText('Tokyo');
    await expect(page.getByTestId('search-city-option-오사카')).toContainText('Osaka');
    await page.getByTestId('search-desktop-city-chip').click();

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

    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(100);
    const scrolledToolbarBox = await page.getByTestId('search-desktop-toolbar').boundingBox();
    expect(scrolledToolbarBox).not.toBeNull();
    if (scrolledToolbarBox) {
      expect(scrolledToolbarBox.y).toBeLessThan(0);
    }
    await page.evaluate(() => window.scrollTo(0, 0));

    await page.getByTestId('search-result-card-9002').click();
    await expect(page.getByTestId('search-result-card-9002')).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId('search-selected-experience-cta')).toBeEnabled();
    await expect(page.getByTestId('search-map-title')).toContainText('Tokyo Morning Cafe Tour');
    await expect(page.getByTestId('search-map-meeting-point')).toContainText('In front of Asakusa Culture Center');

    const mapFrameBox = await page.getByTestId('search-map-frame').boundingBox();
    expect(mapFrameBox).not.toBeNull();
    if (mapFrameBox) {
      expect(Math.abs(mapFrameBox.width - mapFrameBox.height)).toBeLessThanOrEqual(24);
    }

    const secondIframeSrc = await page.getByTestId('search-map-iframe').getAttribute('src');
    expect(secondIframeSrc).toContain(encodeURIComponent('In front of Asakusa Culture Center'));

    await page.getByTestId('search-result-card-9002').click();
    await expect(page.getByTestId('search-result-card-9002')).toHaveAttribute('data-selected', 'false');
    await expect(page.getByTestId('search-map-empty-state')).toBeVisible();
    await expect(page.getByTestId('search-selected-experience-cta')).toBeDisabled();

    await page.getByTestId('search-desktop-city-chip').click();
    await page.getByTestId('search-city-option-오사카').evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    await expect(page).toHaveURL(/location=%EC%98%A4%EC%82%AC%EC%B9%B4/);
    await expect(page).toHaveURL(/city=%EC%98%A4%EC%82%AC%EC%B9%B4/);
    await expect(page.getByTestId('search-summary-pill-location')).toContainText('Osaka');
    await expect(page.getByTestId('search-desktop-city-chip')).toContainText('Osaka');
    await expect(page.getByTestId('search-result-card-9101')).toBeVisible();

    await page.getByTestId('search-result-card-9101').click();
    await expect(page.getByTestId('search-selected-experience-cta')).toBeEnabled();
    await Promise.all([
      page.waitForURL(/\/experiences\/9101$/),
      page.getByTestId('search-selected-experience-cta').click(),
    ]);
  });
});
