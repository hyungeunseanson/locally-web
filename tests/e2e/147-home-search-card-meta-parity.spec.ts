import { expect, test, type Locator, type Page } from '@playwright/test';

const FIXTURE = {
  id: 9901,
  host_id: 'host-9901',
  title: '도쿄 야시장 투어',
  title_en: 'Tokyo Night Market Tour',
  title_ja: '東京ナイトマーケットツアー',
  title_zh: '东京夜市之旅',
  category: '맛집 탐방',
  category_en: 'Food Tour',
  category_ja: 'グルメツアー',
  category_zh: '美食之旅',
  city: '도쿄',
  country: 'Japan',
  location: '시부야 스크램블',
  meeting_point: '시부야 스크램블 스타벅스',
  meeting_point_i18n: { en: 'Starbucks Shibuya Scramble' },
  languages: ['English', 'Korean'],
  photos: ['/images/company/partnership-media-kit/1.png'],
  image_url: '/images/company/partnership-media-kit/1.png',
  price: 89000,
  duration: 3,
  rating: 4.8,
  review_count: 12,
  created_at: '2025-05-01T09:00:00.000Z',
  status: 'active',
};

async function dismissAnnouncementIfVisible(page: Page) {
  const announcement = page.getByTestId('global-site-announcement-modal');
  if (await announcement.count()) {
    await page.getByTestId('global-site-announcement-primary').click();
    await expect(announcement).toHaveCount(0);
  }
}

async function stubHomeExperiences(page: Page) {
  await page.route('**/rest/v1/public_host_applications?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: '1',
          user_id: FIXTURE.host_id,
          status: 'approved',
          created_at: FIXTURE.created_at,
        },
      ]),
    });
  });

  await page.route('**/rest/v1/experiences?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          ...FIXTURE,
          tags: ['food', 'night'],
        },
      ]),
    });
  });

  await page.route('**/rest/v1/experience_availability?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          experience_id: FIXTURE.id,
          date: '2025-05-02',
        },
      ]),
    });
  });

  await page.route('**/rest/v1/experience_popularity_snapshot?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          experience_id: FIXTURE.id,
          wishlist_count: 9,
        },
      ]),
    });
  });
}

async function stubSearchExperiences(page: Page) {
  await page.route('**/api/search/experiences?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: String(FIXTURE.id),
            title: FIXTURE.title,
            title_en: FIXTURE.title_en,
            title_ja: FIXTURE.title_ja,
            title_zh: FIXTURE.title_zh,
            category: FIXTURE.category,
            category_en: FIXTURE.category_en,
            category_ja: FIXTURE.category_ja,
            category_zh: FIXTURE.category_zh,
            city: FIXTURE.city,
            country: FIXTURE.country,
            location: FIXTURE.location,
            meeting_point: FIXTURE.meeting_point,
            meeting_point_i18n: FIXTURE.meeting_point_i18n,
            languages: FIXTURE.languages,
            photos: FIXTURE.photos,
            image_url: FIXTURE.image_url,
            price: FIXTURE.price,
            duration: FIXTURE.duration,
            rating: FIXTURE.rating,
            review_count: FIXTURE.review_count,
          },
        ],
      }),
    });
  });
}

async function expectMetaHierarchy(card: Locator) {
  const title = card.getByTestId('experience-card-meta-title');
  const location = card.getByTestId('experience-card-meta-location');
  const priceRow = card.getByTestId('experience-card-meta-price-row');

  await expect(title).toBeVisible();
  await expect(location).toBeVisible();
  await expect(priceRow).toBeVisible();

  const [titleBox, locationBox, priceRowBox] = await Promise.all([
    title.boundingBox(),
    location.boundingBox(),
    priceRow.boundingBox(),
  ]);

  expect(titleBox).not.toBeNull();
  expect(locationBox).not.toBeNull();
  expect(priceRowBox).not.toBeNull();

  if (titleBox && locationBox && priceRowBox) {
    expect(titleBox.y).toBeLessThan(locationBox.y);
    expect(locationBox.y).toBeLessThan(priceRowBox.y);
  }
}

async function expectCompactPrice(locator: Locator) {
  await expect(locator).toContainText('₩89,000');
  await expect(locator).not.toContainText('1인당');
  await expect(locator).not.toContainText('/ guest');
  await expect(locator).not.toContainText('から / 人');
  await expect(locator).not.toContainText('起 / 人');
}

test.describe('Home/search card meta parity', () => {
  test('keeps home meta layout and applies the same hierarchy to search results', async ({ page }) => {
    await stubHomeExperiences(page);
    await stubSearchExperiences(page);

    await page.setViewportSize({ width: 1440, height: 1200 });

    await page.goto('/', { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);

    const homeCard = page.locator(`a[href="/experiences/${FIXTURE.id}"]:visible`).first();
    await expect(homeCard).toBeVisible({ timeout: 15000 });
    await expectMetaHierarchy(homeCard);
    await expectCompactPrice(homeCard.getByTestId('experience-card-meta-price'));
    await expect(homeCard.getByTestId('experience-card-duration')).toContainText('3');
    await expect(homeCard.getByTestId('experience-card-meta-rating')).toContainText('★4.8');
    const homeLocationText = await homeCard.getByTestId('experience-card-meta-location').textContent();
    expect(homeLocationText?.trim()).toBeTruthy();

    await page.goto(`/search?location=${encodeURIComponent(FIXTURE.title)}`, { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);

    const searchCard = page.getByTestId(`search-result-card-${FIXTURE.id}`).first();
    await expect(searchCard).toBeVisible({ timeout: 15000 });
    await expectMetaHierarchy(searchCard);
    await expectCompactPrice(searchCard.getByTestId('experience-card-meta-price'));
    await expect(searchCard.getByTestId('experience-card-duration')).toContainText('3');
    await expect(searchCard.getByTestId('experience-card-meta-rating')).toContainText('★4.8');
    await expect(searchCard.getByTestId('experience-card-meta-rating')).toContainText('(12)');
    await expect(searchCard.getByTestId('experience-card-meta-location')).toHaveText(homeLocationText || '');
  });

  test('keeps mobile search result prices compact without locale suffixes', async ({ page }) => {
    await stubSearchExperiences(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(`/search?location=${encodeURIComponent(FIXTURE.title)}`, { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);

    const mobileCard = page.getByTestId(`search-mobile-result-card-${FIXTURE.id}`).first();
    await expect(mobileCard).toBeVisible({ timeout: 15000 });
    await expect(mobileCard).toContainText(/도쿄 야시장 투어|Tokyo Night Market Tour/);
    await expectCompactPrice(mobileCard.getByTestId(`search-mobile-result-card-price-${FIXTURE.id}`));
    await expect(mobileCard).toContainText('★ 4.80');
  });

  test('shows a localized login-required toast when logged-out users tap wishlist on home cards', async ({ page }) => {
    await stubHomeExperiences(page);
    await page.setViewportSize({ width: 1440, height: 1200 });

    await page.goto('/en', { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);

    const wishlistButton = page.locator('button[aria-label="Save to wishlist"]:visible').first();
    await expect(wishlistButton).toBeVisible({ timeout: 15000 });

    await wishlistButton.click();

    await expect(page.getByText('Login required.')).toBeVisible();
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe('/en');
  });
});
