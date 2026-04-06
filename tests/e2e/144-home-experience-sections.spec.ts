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

function buildHomeExperience(input: {
  id: number;
  title: string;
  city: string;
  createdAt: string;
  wishlistCount: number;
  reviewCount: number;
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

async function stubHomeExperiences(page: Page) {
  const publicHostApplications = HOME_FIXTURES.map((experience, index) => ({
    id: String(index + 1),
    user_id: experience.host_id,
    status: 'approved',
    created_at: experience.created_at,
  }));
  const experienceRows = HOME_FIXTURES.map((experience) => ({
    id: experience.id,
    title: experience.title,
    title_en: experience.title_en,
    title_ja: experience.title_ja,
    title_zh: experience.title_zh,
    city: experience.city,
    country: experience.country,
    description: experience.description,
    description_en: experience.description_en,
    description_ja: experience.description_ja,
    description_zh: experience.description_zh,
    category: experience.category,
    category_en: experience.category_en,
    category_ja: experience.category_ja,
    category_zh: experience.category_zh,
    tags: experience.tags,
    languages: experience.languages,
    photos: experience.photos,
    image_url: experience.image_url,
    price: experience.price,
    duration: experience.duration,
    max_guests: experience.max_guests,
    host_id: experience.host_id,
    meeting_point: experience.meeting_point,
    meeting_point_i18n: experience.meeting_point_i18n,
    location: experience.location,
    status: experience.status,
    created_at: experience.created_at,
    review_count: experience.review_count,
    rating: experience.rating,
  }));
  const availabilityRows = HOME_FIXTURES.flatMap((experience) =>
    experience.available_dates.map((date) => ({
      experience_id: experience.id,
      date,
    }))
  );
  const popularityRows = HOME_FIXTURES.filter((experience) => experience.wishlist_count > 0).map((experience) => ({
    experience_id: experience.id,
    wishlist_count: experience.wishlist_count,
  }));

  await page.route('**/rest/v1/public_host_applications?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(publicHostApplications),
    });
  });

  await page.route('**/rest/v1/experiences?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(experienceRows),
    });
  });

  await page.route('**/rest/v1/experience_availability?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(availabilityRows),
    });
  });

  await page.route('**/rest/v1/experience_popularity_snapshot?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(popularityRows),
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
    await expect(allSection).toBeVisible({ timeout: 10000 });
    await expect(allSection).toContainText('All Experiences');

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
    await expect(allSection).toBeVisible({ timeout: 10000 });
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
});
