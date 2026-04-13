import { expect, test } from '@playwright/test';
type PublicExperience = {
  id: number;
  title: string;
  city: string | null;
  duration: number;
  searchTerm: string;
};

function formatDurationLabel(duration: number) {
  return Number.isInteger(duration) ? String(duration) : duration.toString();
}

function getDurationPattern(duration: number) {
  const hours = formatDurationLabel(duration).replace('.', '\\.');
  return new RegExp(`${hours}\\s?(hours?|시간|時間|小时)`);
}

async function dismissAnnouncementIfVisible(page: import('@playwright/test').Page) {
  const announcement = page.getByTestId('global-site-announcement-modal');
  if (await announcement.count()) {
    await page.getByTestId('global-site-announcement-primary').click();
    await expect(announcement).toHaveCount(0);
  }
}

function parseExperienceIdFromHref(href: string | null) {
  const match = href?.match(/\/experiences\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

async function getPublicExperienceFixture(page: import('@playwright/test').Page): Promise<PublicExperience> {
  await page.goto('/', { waitUntil: 'networkidle' });
  await dismissAnnouncementIfVisible(page);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const homeAllSection = page.getByTestId('home-desktop-all-experiences-section');
    await expect(homeAllSection).toBeVisible({ timeout: 15000 });

    const experienceLink = homeAllSection.locator('a[href^="/experiences/"]:visible').nth(attempt);
    if (await experienceLink.count() === 0) {
      break;
    }

    const href = await experienceLink.getAttribute('href');
    const id = parseExperienceIdFromHref(href);
    const title = (await experienceLink.getByTestId('experience-card-meta-title').textContent())?.trim();
    const location = (await experienceLink.getByTestId('experience-card-meta-location').textContent())?.trim() || null;
    const durationText = (await experienceLink.getByTestId('experience-card-duration').textContent())?.trim() || '';
    const duration = Number(durationText.match(/\d+(?:\.\d+)?/)?.[0] || NaN);
    const searchTerm = location?.split(',')[0]?.trim() || title || '';

    if (!id || !title || !Number.isFinite(duration) || !searchTerm) {
      continue;
    }

    await experienceLink.click();
    await page.waitForURL(new RegExp(`/experiences/${id}$`), { timeout: 15000 });

    const detailHeading = page.locator('h1:visible').first();
    const notFoundHeading = page.getByRole('heading', {
      name: /페이지를 찾을 수 없습니다|Page not found|ページが見つかりません|页面未找到/,
    });

    const hasDetailHeading = await detailHeading
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    const hasNotFoundHeading = await notFoundHeading
      .waitFor({ state: 'visible', timeout: 1000 })
      .then(() => true)
      .catch(() => false);

    await page.goto('/', { waitUntil: 'networkidle' });
    await dismissAnnouncementIfVisible(page);

    if (hasDetailHeading && !hasNotFoundHeading) {
      return {
        id,
        title,
        city: location,
        duration,
        searchTerm,
      };
    }
  }

  throw new Error('No visible home experience fixture with a working public detail page was found.');
}

test.describe.serial('Guest search/detail ingress smoke', () => {
  test('filters on home and opens the matching experience detail', async ({ page }) => {
    const experience = await getPublicExperienceFixture(page);
    const durationPattern = getDurationPattern(experience.duration);

    const homeSearchInput = page.locator('input[type="text"]').first();
    await expect(homeSearchInput).toBeVisible({ timeout: 15000 });
    await homeSearchInput.fill(experience.searchTerm);
    await homeSearchInput.press('Enter');

    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15000 })
      .toMatch(/^\/(en|ja|zh)?$/);
    await expect(page.getByTestId('home-desktop-popular-experiences-section')).toBeVisible();
    await expect(page.getByTestId('home-desktop-all-experiences-section')).toBeVisible();

    const experienceLink = page.locator(`a[href="/experiences/${experience.id}"]:visible`).first();
    await expect(experienceLink).toBeVisible({ timeout: 15000 });
    await expect(experienceLink.getByTestId('experience-card-duration')).toHaveText(durationPattern);
    await experienceLink.click();

    await page.waitForURL(new RegExp(`/experiences/${experience.id}$`), { timeout: 15000 });
    await expect(page.locator('h1:visible').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('experience-duration-meta-desktop')).toContainText(durationPattern);

    const durationFacts = page.getByTestId('experience-duration-facts');
    await expect(durationFacts).toBeVisible();
    await expect(durationFacts).toContainText(durationPattern);
  });

  test('keeps desktop home search button submissions on home while filtering the feed', async ({ page }) => {
    const experience = await getPublicExperienceFixture(page);
    const durationPattern = getDurationPattern(experience.duration);

    const homeSearchInput = page.locator('input[type="text"]').first();
    await expect(homeSearchInput).toBeVisible({ timeout: 15000 });
    await homeSearchInput.fill(experience.searchTerm);
    await page.getByTestId('home-desktop-search-submit').click();

    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15000 })
      .toMatch(/^\/(en|ja|zh)?$/);
    await expect(page.getByTestId('home-desktop-popular-experiences-section')).toBeVisible();
    await expect(page.getByTestId('home-desktop-all-experiences-section')).toBeVisible();

    const experienceLink = page.locator(`a[href="/experiences/${experience.id}"]:visible`).first();
    await expect(experienceLink).toBeVisible({ timeout: 15000 });
    await expect(experienceLink.getByTestId('experience-card-duration')).toHaveText(durationPattern);
  });

  test('opens the same experience detail from search results', async ({ page }) => {
    const experience = await getPublicExperienceFixture(page);
    const durationPattern = getDurationPattern(experience.duration);

    await page.goto(`/search?location=${encodeURIComponent(experience.searchTerm)}`, {
      waitUntil: 'networkidle',
    });
    await dismissAnnouncementIfVisible(page);

    const experienceCard = page.getByTestId(`search-result-card-${experience.id}`).first();
    await expect(experienceCard).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('search-flow-hint')).toBeVisible({ timeout: 15000 });
    await expect(experienceCard.getByTestId('experience-card-duration')).toHaveText(durationPattern);
    await experienceCard.click();
    await expect(page.getByTestId('search-selected-experience-cta')).toBeEnabled();

    await page.getByTestId('search-selected-experience-cta').click();

    await page.waitForURL(new RegExp(`/experiences/${experience.id}$`), { timeout: 15000 });
    await expect(page.locator('h1:visible').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('experience-duration-meta-desktop')).toContainText(durationPattern);
  });

  test('shows actionable empty state when search has no results', async ({ page }) => {
    await page.goto(`/search?location=${encodeURIComponent('codex-no-search-result-zzzz')}`, {
      waitUntil: 'networkidle',
    });
    await dismissAnnouncementIfVisible(page);

    await expect(page.getByRole('heading', { name: /이 조건에 맞는 체험이 없어요|No experiences match these filters|この条件に合う体験がありません|没有符合这些条件的体验/ })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /필터 초기화|Clear filters|フィルターを解除|清除筛选/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /전체 체험 보기|Browse all experiences|すべての体験を見る|查看全部体验/ })).toBeVisible();
  });
});
