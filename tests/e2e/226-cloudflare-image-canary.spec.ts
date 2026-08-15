import { expect, test } from '@playwright/test';

import { getCloudflareImageCanary } from '../../app/utils/cloudflareImageCanary';

const originImageUrl =
  'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/experiences/experience/0288da66-8322-447c-bf80-bff314ee7299/hero/1786530514581_1786530514581-xj0z0lli.png';

const canaryExperience = {
  id: 4523,
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
    expect(getCloudflareImageCanary(4523, originImageUrl)).toEqual({
      smallUrl:
        'https://media-canary.locally-travel.com/experience-4523-primary-w384-q65.webp',
      largeUrl:
        'https://media-canary.locally-travel.com/experience-4523-primary-w640-q65.webp',
    });

    expect(getCloudflareImageCanary(4524, originImageUrl)).toBeNull();
    expect(getCloudflareImageCanary(4523, `${originImageUrl}?changed=1`)).toBeNull();
  });

  test('is disabled by removing the public environment flag', () => {
    delete process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL;

    expect(getCloudflareImageCanary(4523, originImageUrl)).toBeNull();
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

    const card = page.locator('a[href="/experiences/4523"]:visible').first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card.locator('[data-image-canary="supabase-fallback"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(card.locator('[data-image-canary="cloudflare-r2"]')).toHaveCount(0);
  });
});
