import { expect, test } from '@playwright/test';

import detailImageManifest from '../../app/data/publicExperienceDetailImages.generated.json';
import { getCloudflarePublicExperienceDetailImage } from '../../app/utils/cloudflarePublicExperienceDetailImages';

const PUBLIC_EXPERIENCE_IDS = [
  '3071', '3081', '3188', '3253', '3307', '3308', '3309', '3331', '3343', '3400',
  '3401', '3402', '3403', '3404', '3405', '3410', '3416', '3439', '3496', '3570',
  '3664', '3861', '3905', '4262', '4313', '4397', '4412', '4413', '4414', '4415',
  '4424', '4523', '4597', '4659',
];

test.describe('Cloudflare public experience detail image boundary', () => {
  test.beforeEach(() => {
    process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL =
      'https://media-canary.locally-travel.com';
  });

  test.afterEach(() => {
    delete process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL;
  });

  test('contains every approved public experience detail image with immutable unique keys', () => {
    expect(Object.keys(detailImageManifest).sort()).toEqual(PUBLIC_EXPERIENCE_IDS);

    const entries = Object.entries(detailImageManifest).flatMap(([experienceId, images]) =>
      Object.entries(images).map(([originUrl, image]) => ({ experienceId, originUrl, image }))
    );
    const keys = entries.flatMap(({ image }) => [image.smallKey, image.mediumKey, image.largeKey]);

    expect(entries).toHaveLength(268);
    expect(keys).toHaveLength(804);
    expect(new Set(keys).size).toBe(keys.length);

    for (const { experienceId, originUrl, image } of entries) {
      expect(originUrl).toMatch(
        /^https:\/\/uhinvcydgzqlpnvieyal\.supabase\.co\/storage\/v1\/object\/public\/experiences\/experience\/[^/]+\/(?:hero|itinerary)\/[A-Za-z0-9._-]+$/
      );
      expect(image.smallKey).toMatch(new RegExp(`^details/experience-${experienceId}-[a-f0-9]{12}-w480-q75\\.webp$`));
      expect(image.mediumKey).toMatch(new RegExp(`^details/experience-${experienceId}-[a-f0-9]{12}-w960-q75\\.webp$`));
      expect(image.largeKey).toMatch(new RegExp(`^details/experience-${experienceId}-[a-f0-9]{12}-w1440-q75\\.webp$`));

      expect(getCloudflarePublicExperienceDetailImage(experienceId, originUrl)).toEqual({
        smallUrl: `https://media-canary.locally-travel.com/${image.smallKey}`,
        mediumUrl: `https://media-canary.locally-travel.com/${image.mediumKey}`,
        largeUrl: `https://media-canary.locally-travel.com/${image.largeKey}`,
      });
    }
  });

  test('fails closed for changed, unknown, and unexpected experience images', () => {
    const [originUrl] = Object.keys(detailImageManifest['4523']);

    expect(getCloudflarePublicExperienceDetailImage(4523, `${originUrl}?changed=1`)).toBeNull();
    expect(getCloudflarePublicExperienceDetailImage(999999, originUrl)).toBeNull();
    expect(
      getCloudflarePublicExperienceDetailImage(
        4523,
        'https://example.com/private-or-unexpected-image.jpg'
      )
    ).toBeNull();
  });

  test('is disabled without the existing public Cloudflare base URL flag', () => {
    delete process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL;
    const [originUrl] = Object.keys(detailImageManifest['4523']);

    expect(getCloudflarePublicExperienceDetailImage(4523, originUrl)).toBeNull();
  });

  test('delivers the approved detail and itinerary images from Cloudflare', async ({ page }) => {
    test.skip(
      !process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL,
      'Detail canary browser contract requires the public build-time flag.'
    );

    await page.goto('/experiences/4523', { waitUntil: 'domcontentloaded' });

    const cloudflareImages = page.locator('[data-detail-image-delivery="cloudflare-r2"]:visible');
    await expect(cloudflareImages.first()).toBeVisible({ timeout: 15_000 });
    expect(await cloudflareImages.count()).toBeGreaterThanOrEqual(5);
    await expect(cloudflareImages.first()).toHaveAttribute(
      'src',
      /^https:\/\/media-canary\.locally-travel\.com\/details\//
    );
  });

  test('falls back to the unchanged Supabase path when Cloudflare detail delivery fails', async ({
    page,
  }) => {
    test.skip(
      !process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL,
      'Detail canary browser contract requires the public build-time flag.'
    );

    await page.route('https://media-canary.locally-travel.com/details/**', async (route) => {
      await route.fulfill({ status: 503, body: 'intentional detail canary failure' });
    });
    await page.goto('/experiences/4523', { waitUntil: 'domcontentloaded' });

    await expect(
      page.locator('[data-detail-image-delivery="supabase-fallback"]:visible').first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator('[data-detail-image-delivery="cloudflare-r2"]:visible')
    ).toHaveCount(0);
  });
});
