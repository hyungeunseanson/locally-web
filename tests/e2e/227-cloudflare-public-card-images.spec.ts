import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { PUBLIC_EXPERIENCE_CARD_IMAGES } from '../../app/data/publicExperienceCardImages';
import { getCloudflareExperienceCardImage } from '../../app/utils/cloudflareImageCanary';

test.describe('Cloudflare public experience card image manifest', () => {
  test.beforeEach(() => {
    process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL =
      'https://media-canary.locally-travel.com';
  });

  test.afterEach(() => {
    delete process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL;
  });

  test('contains public experiences with unique immutable object keys', () => {
    const entries = Object.entries(PUBLIC_EXPERIENCE_CARD_IMAGES);
    const keys = entries.flatMap(([, image]) => [image.smallKey, image.largeKey]);

    expect(entries.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);

    for (const [experienceId, image] of entries) {
      expect(experienceId).toMatch(/^\d+$/);
      expect(image.originUrl).toMatch(
        /^https:\/\/uhinvcydgzqlpnvieyal\.supabase\.co\/storage\/v1\/object\/public\/experiences\//
      );
      expect(image.smallKey).toMatch(/(?:^|\/)experience-\d+-primary-(?:[a-f0-9]{12}-)?w384-q65\.webp$/);
      expect(image.largeKey).toMatch(/(?:^|\/)experience-\d+-primary-(?:[a-f0-9]{12}-)?w640-q65\.webp$/);
    }
  });

  test('serves only exact manifest URL matches and fails closed on photo drift', () => {
    for (const [experienceId, image] of Object.entries(PUBLIC_EXPERIENCE_CARD_IMAGES)) {
      expect(getCloudflareExperienceCardImage(experienceId, image.originUrl)).toEqual({
        smallUrl: `https://media-canary.locally-travel.com/${image.smallKey}`,
        largeUrl: `https://media-canary.locally-travel.com/${image.largeKey}`,
      });

      expect(
        getCloudflareExperienceCardImage(experienceId, `${image.originUrl}?changed=1`)
      ).toBeNull();
    }
  });

  test('keeps unknown and newly changed experiences on the Supabase path', () => {
    expect(
      getCloudflareExperienceCardImage(
        999999,
        'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/experiences/unknown.jpg'
      )
    ).toBeNull();
  });

  test('bypasses Vercel optimization for the canonical Supabase fallback', () => {
    const componentSource = readFileSync(
      'app/components/PublicExperienceCardImage.tsx',
      'utf8'
    );
    const fallbackImage = componentSource.match(
      /<Image[\s\S]*?src=\{originImageUrl\}[\s\S]*?\/>/
    )?.[0];

    expect(fallbackImage).toBeTruthy();
    expect(fallbackImage).toMatch(/\bunoptimized\b/);
    expect(componentSource).toContain('data-image-delivery="cloudflare-r2"');
  });
});
