import { expect, test, type Page } from '@playwright/test';

type StubExperience = {
  id: number;
  title: string;
  city: string;
  host_id: string;
  created_at: string;
  review_count: number;
  available_dates: string[];
};

const HOME_FIXTURES: StubExperience[] = [
  buildHomeExperience(9101, 'Seoul Snapshot Fallback', '서울', '2025-04-12T09:00:00.000Z', 120),
  buildHomeExperience(9102, 'Tokyo Snapshot Fallback', '도쿄', '2025-04-11T09:00:00.000Z', 20),
  buildHomeExperience(9103, 'Busan Snapshot Fallback', '부산', '2025-04-10T09:00:00.000Z', 5),
];

function buildHomeExperience(
  id: number,
  title: string,
  city: string,
  createdAt: string,
  reviewCount: number
): StubExperience {
  return {
    id,
    title,
    city,
    host_id: `host-${id}`,
    created_at: createdAt,
    review_count: reviewCount,
    available_dates: ['2025-05-01', '2025-05-02'],
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

async function stubHomeExperiencesWithSnapshotFailure(page: Page) {
  const publicHostApplications = HOME_FIXTURES.map((experience, index) => ({
    id: String(index + 1),
    user_id: experience.host_id,
    status: 'approved',
    created_at: experience.created_at,
  }));

  const experienceRows = HOME_FIXTURES.map((experience) => ({
    id: experience.id,
    title: experience.title,
    title_en: experience.title,
    title_ja: experience.title,
    title_zh: experience.title,
    city: experience.city,
    country: experience.city === '서울' || experience.city === '부산' ? 'Korea' : 'Japan',
    description: `${experience.title} description`,
    description_en: `${experience.title} description`,
    description_ja: `${experience.title} description`,
    description_zh: `${experience.title} description`,
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
    host_id: experience.host_id,
    meeting_point: `${experience.city} Station`,
    meeting_point_i18n: { en: `${experience.city} Station` },
    location: `${experience.city} Station`,
    status: 'active',
    created_at: experience.created_at,
    review_count: experience.review_count,
    rating: 4.8,
  }));

  const availabilityRows = HOME_FIXTURES.flatMap((experience) =>
    experience.available_dates.map((date) => ({
      experience_id: experience.id,
      date,
    }))
  );

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
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'forced popularity snapshot failure' }),
    });
  });
}

test.describe('Home popularity snapshot fail-open', () => {
  test('keeps rendering cards when only the popularity snapshot query fails', async ({ page }) => {
    await stubHomeExperiencesWithSnapshotFailure(page);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await prepareLocale(page, 'en', '/en');

    await expect(page.getByTestId('home-load-error-state')).toHaveCount(0);
    await expect(page.getByText('No matching experiences are showing on the home feed yet')).toHaveCount(0);

    const popularSection = page.getByTestId('home-desktop-popular-experiences-section');
    const allSection = page.getByTestId('home-desktop-all-experiences-section');
    await expect(popularSection).toBeVisible();
    await expect(allSection).toBeVisible();

    const popularCards = popularSection.locator('[data-testid^="home-popular-experience-card-"]');
    await expect(popularCards.nth(0)).toContainText('Seoul Snapshot Fallback');
    await expect(popularCards.nth(1)).toContainText('Tokyo Snapshot Fallback');
    await expect(popularCards.nth(2)).toContainText('Busan Snapshot Fallback');

    const allCards = allSection.locator('[data-testid^="home-all-experience-card-"]');
    await expect(allCards.nth(0)).toContainText('Seoul Snapshot Fallback');
    await expect(allCards.nth(1)).toContainText('Tokyo Snapshot Fallback');
    await expect(allCards.nth(2)).toContainText('Busan Snapshot Fallback');
  });
});
