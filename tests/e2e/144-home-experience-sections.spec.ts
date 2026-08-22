import { expect, test, type Page } from '@playwright/test';

type StubExperience = {
  id: number;
  title: string;
  title_en: string;
  title_ja: string;
  title_zh: string;
  city: string;
  country: string;
  description: string;
  description_en: string;
  description_ja: string;
  description_zh: string;
  category: string;
  category_en: string;
  category_ja: string;
  category_zh: string;
  tags: string[];
  languages: string[];
  photos: string[];
  image_url: string;
  price: number;
  duration: number;
  max_guests: number;
  host_id: string;
  meeting_point: string;
  meeting_point_i18n: { en: string };
  location: string;
  status: 'active';
  created_at: string;
  available_dates: string[];
  review_count: number;
  rating: number;
  wishlist_count: number;
  is_superhost: boolean;
};

const HOME_FIXTURES: StubExperience[] = [
  buildHomeExperience({
    id: 9001,
    title: 'Tokyo Alpha',
    city: '도쿄',
    createdAt: '2025-04-10T09:00:00.000Z',
    wishlistCount: 3,
    reviewCount: 10,
  }),
  buildHomeExperience({
    id: 9002,
    title: 'Tokyo Beta',
    city: '도쿄',
    createdAt: '2025-04-09T09:00:00.000Z',
    wishlistCount: 12,
    reviewCount: 5,
  }),
  buildHomeExperience({
    id: 9003,
    title: 'Seoul Gamma',
    city: '서울',
    createdAt: '2025-04-12T09:00:00.000Z',
    wishlistCount: 8,
    reviewCount: 100,
  }),
  buildHomeExperience({
    id: 9004,
    title: 'Busan Delta',
    city: '부산',
    createdAt: '2025-04-11T09:00:00.000Z',
    wishlistCount: 1,
    reviewCount: 2,
  }),
  buildHomeExperience({
    id: 9005,
    title: 'Tokyo Epsilon',
    city: '도쿄',
    createdAt: '2025-04-08T09:00:00.000Z',
    wishlistCount: 12,
    reviewCount: 20,
    isSuperhost: true,
  }),
  buildHomeExperience({
    id: 9006,
    title: 'Fukuoka Zeta',
    city: '후쿠오카',
    createdAt: '2025-04-07T09:00:00.000Z',
    wishlistCount: 5,
    reviewCount: 8,
  }),
  buildHomeExperience({
    id: 9007,
    title: 'Osaka Eta',
    city: '오사카',
    createdAt: '2025-04-06T09:00:00.000Z',
    wishlistCount: 4,
    reviewCount: 4,
  }),
  buildHomeExperience({
    id: 9008,
    title: 'Tokyo Theta',
    city: '도쿄',
    createdAt: '2025-04-05T09:00:00.000Z',
    wishlistCount: 0,
    reviewCount: 1,
  }),
];

const HOME_PAGINATION_FIXTURES = Array.from({ length: 35 }, (_, index) =>
  buildHomeExperience({
    id: 9100 + index,
    title: `Paged Experience ${index + 1}`,
    city: index < 30 ? '도쿄' : '오사카',
    createdAt: new Date(Date.UTC(2025, 4, 1, index)).toISOString(),
    wishlistCount: index,
    reviewCount: index,
  })
);

function buildHomeExperience(input: {
  id: number;
  title: string;
  city: string;
  createdAt: string;
  wishlistCount: number;
  reviewCount: number;
  isSuperhost?: boolean;
}): StubExperience {
  return {
    id: input.id,
    title: input.title,
    title_en: input.title,
    title_ja: input.title,
    title_zh: input.title,
    city: input.city,
    country: input.city === '서울' || input.city === '부산' ? 'Korea' : 'Japan',
    description: `${input.title} description`,
    description_en: `${input.title} description`,
    description_ja: `${input.title} description`,
    description_zh: `${input.title} description`,
    category: '맛집 탐방',
    category_en: 'Food Tour',
    category_ja: 'グルメツアー',
    category_zh: '美食之旅',
    tags: ['food', 'city'],
    languages: ['English', 'Korean'],
    photos: ['/images/company/partnership-media-kit/1.png'],
    image_url: '/images/company/partnership-media-kit/1.png',
    price: 89000,
    duration: 3,
    max_guests: 6,
    host_id: `host-${input.id}`,
    meeting_point: `${input.city} Station`,
    meeting_point_i18n: { en: `${input.city} Station` },
    location: `${input.city} Station`,
    status: 'active',
    created_at: input.createdAt,
    available_dates: ['2025-05-01', '2025-05-02'],
    review_count: input.reviewCount,
    rating: 4.8,
    wishlist_count: input.wishlistCount,
    is_superhost: input.isSuperhost === true,
  };
}

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

async function stubHomeExperiences(page: Page, fixtures = HOME_FIXTURES, onRequest?: () => void) {
  await page.route('**/api/home/experiences', async (route) => {
    onRequest?.();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: fixtures }),
    });
  });
}

test.describe('Home experience sections', () => {
  test('desktop shows a single-row popular section and latest-first all experiences', async ({ page }) => {
    await stubHomeExperiences(page);
    await page.setViewportSize({ width: 1440, height: 1400 });
    await prepareLocale(page, 'en', '/en');

    const popularSection = page.getByTestId('home-desktop-popular-experiences-section');
    const allSection = page.getByTestId('home-desktop-all-experiences-section');

    await expect(popularSection).toBeVisible({ timeout: 10000 });
    await expect(popularSection).toContainText('Popular Experiences');
    await expect(popularSection).toContainText('Most saved');
    await expect(allSection).toBeVisible({ timeout: 10000 });
    await expect(allSection).toContainText('All Experiences');
    await expect(allSection).not.toContainText('Most saved');

    const popularCards = popularSection.locator('[data-testid^="home-popular-experience-card-"]');
    await expect(popularCards.nth(0)).toContainText('Tokyo Epsilon');
    await expect(popularCards.nth(1)).toContainText('Tokyo Beta');
    await expect(popularCards.nth(2)).toContainText('Seoul Gamma');
    await expect(popularCards.nth(3)).toContainText('Fukuoka Zeta');
    await expect(popularCards.nth(4)).toContainText('Osaka Eta');
    await expect(popularSection.getByTestId('home-popular-experience-card-9001')).toBeHidden();

    const allCards = allSection.locator('[data-testid^="home-all-experience-card-"]');
    await expect(allCards.nth(0)).toContainText('Seoul Gamma');
    await expect(allCards.nth(1)).toContainText('Busan Delta');
    await expect(allCards.nth(2)).toContainText('Tokyo Alpha');
    await expect(allCards.nth(3)).toContainText('Tokyo Beta');
  });

  test('mobile shows only popular and all sections without language or new sections', async ({ page }) => {
    await stubHomeExperiences(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareLocale(page, 'en', '/en');

    const popularSection = page.getByTestId('home-mobile-popular-experiences-section');
    const allSection = page.getByTestId('home-mobile-all-experiences-section');

    await expect(popularSection).toBeVisible({ timeout: 10000 });
    await expect(popularSection).toContainText('Most saved');
    await expect(allSection).toBeVisible({ timeout: 10000 });
    await expect(allSection).not.toContainText('Most saved');
    await expect(page.getByText('Newly Added Experiences')).toHaveCount(0);
    await expect(page.getByText('Experiences in Korean')).toHaveCount(0);
    await expect(page.getByText('Experiences in Japanese')).toHaveCount(0);
    await expect(page.getByText('Experiences in English')).toHaveCount(0);
    await expect(page.getByText('Experiences in Chinese')).toHaveCount(0);

    const popularCards = popularSection.locator('[data-testid^="home-popular-experience-card-"]');
    await expect(popularCards.nth(0)).toContainText('Tokyo Epsilon');
    await expect(popularCards.nth(1)).toContainText('Tokyo Beta');
    await expect(popularCards.nth(2)).toContainText('Seoul Gamma');

    const allCards = allSection.locator('[data-testid^="home-all-experience-card-"]');
    await expect(allCards.nth(0)).toContainText('Seoul Gamma');
    await expect(allCards.nth(1)).toContainText('Busan Delta');
    await expect(allCards.nth(2)).toContainText('Tokyo Alpha');
    await expect(page.getByTestId('home-experience-superhost-badge')).toHaveCount(0);
  });

  test('recomputes popular and all sections inside the filtered city result set', async ({ page }) => {
    await stubHomeExperiences(page);
    await page.setViewportSize({ width: 1440, height: 1400 });
    await prepareLocale(page, 'en', '/en');

    await page.getByTestId('home-desktop-category-tokyo').click();

    const popularSection = page.getByTestId('home-desktop-popular-experiences-section');
    const allSection = page.getByTestId('home-desktop-all-experiences-section');
    const popularCards = popularSection.locator('[data-testid^="home-popular-experience-card-"]');
    const allCards = allSection.locator('[data-testid^="home-all-experience-card-"]');

    await expect(popularCards).toHaveCount(4);
    await expect(popularCards.nth(0)).toContainText('Tokyo Epsilon');
    await expect(popularCards.nth(1)).toContainText('Tokyo Beta');
    await expect(popularCards.nth(2)).toContainText('Tokyo Alpha');
    await expect(popularCards.nth(3)).toContainText('Tokyo Theta');

    await expect(allCards).toHaveCount(4);
    await expect(allCards.nth(0)).toContainText('Tokyo Alpha');
    await expect(allCards.nth(1)).toContainText('Tokyo Beta');
    await expect(allCards.nth(2)).toContainText('Tokyo Epsilon');
    await expect(allCards.nth(3)).toContainText('Tokyo Theta');
  });

  test('desktop progressively reveals every all-experience card without another API request', async ({ page }) => {
    let homeExperienceRequestCount = 0;
    await stubHomeExperiences(page, HOME_PAGINATION_FIXTURES, () => {
      homeExperienceRequestCount += 1;
    });
    await page.setViewportSize({ width: 1440, height: 1400 });
    await prepareLocale(page, 'en', '/en');

    const allSection = page.getByTestId('home-desktop-all-experiences-section');
    const allCards = allSection.locator('[data-testid^="home-all-experience-card-"]');
    const loadMore = page.getByTestId('home-desktop-all-experiences-load-more');

    await expect(allCards).toHaveCount(24);
    const requestCountBeforeLoadMore = homeExperienceRequestCount;

    await loadMore.click();

    await expect(allCards).toHaveCount(35);
    await expect(loadMore).toHaveCount(0);
    await expect.poll(() => homeExperienceRequestCount).toBe(requestCountBeforeLoadMore);

    const cardIds = await allCards.evaluateAll((cards) => cards.map((card) => card.getAttribute('data-testid')));
    expect(new Set(cardIds).size).toBe(35);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileAllSection = page.getByTestId('home-mobile-all-experiences-section');
    const mobileAllCards = mobileAllSection.locator('[data-testid^="home-all-experience-card-"]');
    await expect(mobileAllCards).toHaveCount(35);
    await expect(page.getByTestId('home-mobile-all-experiences-load-more')).toHaveCount(0);

    await page.setViewportSize({ width: 1440, height: 1400 });
    await page.getByTestId('home-desktop-category-tokyo').click();

    await expect(allCards).toHaveCount(24);
    await expect(loadMore).toBeVisible();
    await loadMore.click();
    await expect(allCards).toHaveCount(30);
    await expect(loadMore).toHaveCount(0);
    await expect.poll(() => homeExperienceRequestCount).toBe(requestCountBeforeLoadMore);
  });

  test('mobile progressively reveals every all-experience card without another API request', async ({ page }) => {
    let homeExperienceRequestCount = 0;
    await stubHomeExperiences(page, HOME_PAGINATION_FIXTURES, () => {
      homeExperienceRequestCount += 1;
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareLocale(page, 'en', '/en');

    const allSection = page.getByTestId('home-mobile-all-experiences-section');
    const allCards = allSection.locator('[data-testid^="home-all-experience-card-"]');
    const loadMore = page.getByTestId('home-mobile-all-experiences-load-more');

    await expect(allCards).toHaveCount(12);
    const requestCountBeforeLoadMore = homeExperienceRequestCount;

    await loadMore.click();
    await expect(allCards).toHaveCount(24);
    await expect.poll(() => homeExperienceRequestCount).toBe(requestCountBeforeLoadMore);

    await loadMore.click();
    await expect(allCards).toHaveCount(35);
    await expect(loadMore).toHaveCount(0);
    await expect.poll(() => homeExperienceRequestCount).toBe(requestCountBeforeLoadMore);

    const cardIds = await allCards.evaluateAll((cards) => cards.map((card) => card.getAttribute('data-testid')));
    expect(new Set(cardIds).size).toBe(35);
  });
});
