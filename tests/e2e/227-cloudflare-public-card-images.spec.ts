import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { PUBLIC_EXPERIENCE_CARD_IMAGES } from '../../app/data/publicExperienceCardImages';
import { getCloudflareExperienceCardImage } from '../../app/utils/cloudflareImageCanary';
import { normalizePublicExperienceSourceUrl } from '../../app/utils/publicExperienceMediaKeys';

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
      expect(normalizePublicExperienceSourceUrl(image.originUrl).sourceUrl).toBe(image.originUrl);
      expect(image.smallKey).toMatch(new RegExp(`(?:^|/)experience-${experienceId}-primary-(?:[a-f0-9]{12}-)?w384-q65\\.webp$`));
      expect(image.largeKey).toMatch(new RegExp(`(?:^|/)experience-${experienceId}-primary-(?:[a-f0-9]{12}-)?w640-q65\\.webp$`));
    }
  });

  test('serves only exact manifest URL matches and fails closed on photo drift', () => {
    for (const [experienceId, image] of Object.entries(PUBLIC_EXPERIENCE_CARD_IMAGES)) {
      expect(getCloudflareExperienceCardImage(experienceId, image.originUrl)).toEqual({
        smallUrl: `https://media-canary.locally-travel.com/${image.smallKey}`,
        largeUrl: `https://media-canary.locally-travel.com/${image.largeKey}`,
      });

      const changedOrigin = new URL(image.originUrl);
      changedOrigin.searchParams.set('changed', '1');
      expect(getCloudflareExperienceCardImage(experienceId, changedOrigin.toString())).toBeNull();
    }
  });

  test('does not select derivatives for an unknown experience', () => {
    expect(
      getCloudflareExperienceCardImage(999999, Object.values(PUBLIC_EXPERIENCE_CARD_IMAGES)[0]!.originUrl)
    ).toBeNull();
  });

  test('bypasses framework optimization for the current original fallback', () => {
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
