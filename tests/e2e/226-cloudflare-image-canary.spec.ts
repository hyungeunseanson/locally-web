import { expect, test } from '@playwright/test';

import { PUBLIC_EXPERIENCE_CARD_IMAGES } from '../../app/data/publicExperienceCardImages';
import { getCloudflareImageCanary } from '../../app/utils/cloudflareImageCanary';

const [canaryExperienceId, canaryImage] = Object.entries(PUBLIC_EXPERIENCE_CARD_IMAGES)[0]!;
const originImageUrl = canaryImage.originUrl;

const canaryExperience = {
  id: Number(canaryExperienceId),
  host_id: 'canary-host',
  title: 'Cloudflare Canary Experience',
  category: '투어',
  city: 'Tokyo',
  country: 'Japan',
  location: 'Tokyo',
  languages: ['Korean'],
  photos: [originImageUrl],
  image_url: originImageUrl,
  price: 10000,
  duration: 2,
  rating: 5,
  review_count: 1,
  wishlist_count: 1,
  available_dates: ['2026-08-16'],
  created_at: '2026-08-15T00:00:00.000Z',
};

test.describe('Cloudflare public image canary boundary', () => {
  test.beforeEach(() => {
    process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL =
      'https://media-canary.locally-travel.com/';
  });

  test.afterEach(() => {
    delete process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL;
  });

  test('selects only the allowlisted experience and exact public origin image', () => {
    expect(getCloudflareImageCanary(canaryExperienceId, originImageUrl)).toEqual({
      smallUrl: `https://media-canary.locally-travel.com/${canaryImage.smallKey}`,
      largeUrl: `https://media-canary.locally-travel.com/${canaryImage.largeKey}`,
    });

    expect(getCloudflareImageCanary('999999', originImageUrl)).toBeNull();
    expect(getCloudflareImageCanary(canaryExperienceId, `${originImageUrl}?changed=1`)).toBeNull();
  });

  test('is disabled by removing the public environment flag', () => {
    delete process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL;

    expect(getCloudflareImageCanary(canaryExperienceId, originImageUrl)).toBeNull();
  });

  test('falls back to the existing Supabase/Next Image path when R2 delivery fails', async ({
    page,
  }) => {
    test.skip(
      !process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL,
      'Canary browser contract requires the public build-time flag.'
    );

    await page.route('**/api/home/experiences', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [canaryExperience] }),
      });
    });
    await page.route('https://media-canary.locally-travel.com/**', async (route) => {
      await route.fulfill({ status: 503, body: 'intentional canary failure' });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const announcement = page.getByTestId('global-site-announcement-modal');
    if (await announcement.count()) {
      await page.getByTestId('global-site-announcement-primary').click();
    }

    const card = page.locator(`a[href="/experiences/${canaryExperienceId}"]:visible`).first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card.locator('[data-image-delivery="supabase-fallback"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(card.locator('[data-image-delivery="cloudflare-r2"]')).toHaveCount(0);
  });
});
