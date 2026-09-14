import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { PUBLIC_EXPERIENCE_CARD_IMAGES } from '../../app/data/publicExperienceCardImages';
import detailImageManifest from '../../app/data/publicExperienceDetailImages.generated.json';
import {
  buildPublicExperienceCardKeys,
  buildPublicExperienceDetailKeys,
  buildPublicExperienceOriginalKey,
  isPublicExperienceR2Eligible,
  normalizePublicExperienceSourceUrl,
  sha256Hex,
} from '../../app/utils/publicExperienceMediaKeys';

const GOLDEN_SOURCE_URL =
  'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/experiences/experience/11111111-1111-4111-8111-111111111111/hero/sample.jpg';
const GOLDEN_SOURCE_KEY =
  'experience/11111111-1111-4111-8111-111111111111/hero/sample.jpg';
const GOLDEN_SOURCE_BYTE_SHA = 'a'.repeat(64);

test.describe('public experience deterministic media key contract', () => {
  test('matches Node SHA-256 and the fixed card/detail/original golden vectors', () => {
    expect(sha256Hex(GOLDEN_SOURCE_URL)).toBe(
      createHash('sha256').update(GOLDEN_SOURCE_URL).digest('hex')
    );
    expect(buildPublicExperienceCardKeys(42, GOLDEN_SOURCE_URL)).toEqual({
      smallKey: 'cards/experience-42-primary-39696081a432-w384-q65.webp',
      largeKey: 'cards/experience-42-primary-39696081a432-w640-q65.webp',
    });
    expect(buildPublicExperienceDetailKeys(42, GOLDEN_SOURCE_URL)).toEqual({
      smallKey: 'details/experience-42-39696081a432-w480-q75.webp',
      mediumKey: 'details/experience-42-39696081a432-w960-q75.webp',
      largeKey: 'details/experience-42-39696081a432-w1440-q75.webp',
    });
    expect(buildPublicExperienceOriginalKey(
      GOLDEN_SOURCE_KEY,
      GOLDEN_SOURCE_BYTE_SHA,
      'image/jpeg'
    )).toBe(
      `originals/v1/cb/cb826ca840e653408b27b0c585bd6ceb0c75aa2d0d1abd934b135ad636dc4178/${GOLDEN_SOURCE_BYTE_SHA}.jpg`
    );
  });

  test('matches every current static card and detail manifest key in shadow', () => {
    const cardEntries = Object.entries(PUBLIC_EXPERIENCE_CARD_IMAGES);
    const detailEntries = Object.entries(detailImageManifest).flatMap(([experienceId, images]) =>
      Object.entries(images).map(([sourceUrl, keys]) => ({ experienceId, sourceUrl, keys }))
    );

    expect(cardEntries).toHaveLength(33);
    expect(detailEntries).toHaveLength(263);
    for (const [experienceId, entry] of cardEntries) {
      expect(buildPublicExperienceCardKeys(experienceId, entry.originUrl)).toEqual({
        smallKey: entry.smallKey,
        largeKey: entry.largeKey,
      });
    }
    for (const entry of detailEntries) {
      expect(buildPublicExperienceDetailKeys(entry.experienceId, entry.sourceUrl)).toEqual(entry.keys);
    }
  });

  test('fails closed outside the exact public Production source namespace', () => {
    expect(normalizePublicExperienceSourceUrl(GOLDEN_SOURCE_URL)).toEqual({
      sourceUrl: GOLDEN_SOURCE_URL,
      sourceKey: GOLDEN_SOURCE_KEY,
    });
    for (const invalidUrl of [
      'https://example.com/storage/v1/object/public/experiences/experience/id/hero/a.jpg',
      `${GOLDEN_SOURCE_URL}?changed=1`,
      'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/avatars/avatar.jpg',
    ]) {
      expect(() => buildPublicExperienceCardKeys(42, invalidUrl)).toThrow();
    }
  });

  test('requires explicit approved and active eligibility without changing current readers', () => {
    expect(isPublicExperienceR2Eligible({ status: 'active', is_active: true })).toBe(true);
    expect(isPublicExperienceR2Eligible({ status: 'active', is_active: false })).toBe(false);
    expect(isPublicExperienceR2Eligible({ status: 'active', is_active: null })).toBe(false);
    expect(isPublicExperienceR2Eligible({ status: 'draft', is_active: true })).toBe(false);

    const homeRoute = readFileSync('app/api/home/experiences/route.ts', 'utf8');
    const searchRoute = readFileSync('app/api/search/experiences/route.ts', 'utf8');
    const detailData = readFileSync('app/experiences/[id]/publicDetailData.server.ts', 'utf8');
    const wishlistRoute = readFileSync('app/api/guest/wishlists/route.ts', 'utf8');
    for (const source of [homeRoute, searchRoute, detailData, wishlistRoute]) {
      expect(source).toMatch(/\bstatus\b/);
      expect(source).toMatch(/\bis_active\b/);
    }
  });

  test('keeps static manifests as the default runtime delivery authority', () => {
    const cardReader = readFileSync('app/utils/cloudflareImageCanary.ts', 'utf8');
    const detailReader = readFileSync('app/utils/cloudflarePublicExperienceDetailImages.ts', 'utf8');
    expect(cardReader).toContain('PUBLIC_EXPERIENCE_CARD_IMAGES');
    expect(detailReader).toContain('publicExperienceDetailImages.generated.json');
    expect(cardReader).toContain('isPublicExperienceDeterministicReaderTarget');
    expect(detailReader).toContain('isPublicExperienceDeterministicReaderTarget');
  });
});
