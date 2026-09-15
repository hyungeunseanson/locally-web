import { expect, test } from '@playwright/test';

import {
  buildExperienceMediaSourceKey,
  createExperienceMediaR2Source,
  experienceMediaSourceEnabled,
  EXPERIENCE_MEDIA_SOURCE_CACHE_CONTROL,
  resolveExperienceMediaUploadOwner,
  type ExperienceMediaSourceR2,
} from '../../app/utils/experienceMediaSource';
import { normalizePublicExperienceSourceUrl } from '../../app/utils/publicExperienceMediaKeys';

const OWNER = '11111111-1111-4111-8111-111111111111';
const ASSET = '22222222-2222-4222-8222-222222222222';

function jpeg() {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 1, 2, 3, 4]);
}

function fakeR2() {
  const objects = new Map<string, { bytes: Uint8Array; metadata: Record<string, string>; contentType: string; cacheControl: string }>();
  let putCount = 0;
  const binding: ExperienceMediaSourceR2 = {
    async head(key) {
      const object = objects.get(key);
      return object ? {
        size: object.bytes.byteLength,
        httpMetadata: { contentType: object.contentType, cacheControl: object.cacheControl },
        customMetadata: object.metadata,
      } : null;
    },
    async put(key, bytes, options) {
      putCount += 1;
      if (objects.has(key)) return null;
      objects.set(key, {
        bytes: new Uint8Array(bytes),
        metadata: options.customMetadata,
        contentType: options.httpMetadata.contentType,
        cacheControl: options.httpMetadata.cacheControl,
      });
      return this.head(key);
    },
  };
  return { binding, objects, get putCount() { return putCount; } };
}

test.describe('Experience media R2 source authority', () => {
  test('generates an immutable owner-bound key without trusting the filename', () => {
    const key = buildExperienceMediaSourceKey({
      ownerId: OWNER,
      assetId: ASSET,
      folder: 'hero',
      contentType: 'image/jpeg',
    });
    expect(key).toMatch(/^sources\/v1\/experience\/[0-9a-f]{64}\/22222222-2222-4222-8222-222222222222\/hero\.jpg$/);
    const locator = `https://media-canary.locally-travel.com/${key}`;
    expect(normalizePublicExperienceSourceUrl(locator)).toMatchObject({
      sourceKind: 'r2',
      sourceKey: key,
      r2Key: key,
    });
    expect(() => buildExperienceMediaSourceKey({ ownerId: '../victim', assetId: ASSET, folder: 'hero', contentType: 'image/jpeg' })).toThrow();
  });

  test('conditionally creates, verifies metadata, and fails closed on a same-key race', async () => {
    const r2 = fakeR2();
    const first = await createExperienceMediaR2Source({
      binding: r2.binding,
      ownerId: OWNER,
      assetId: ASSET,
      folder: 'hero',
      bytes: jpeg(),
      contentType: 'image/jpeg',
      now: () => new Date('2026-09-16T00:00:00Z'),
    });
    expect(first.publicUrl).toBe(`https://media-canary.locally-travel.com/${first.key}`);
    expect(r2.objects.get(first.key)?.cacheControl).toBe(EXPERIENCE_MEDIA_SOURCE_CACHE_CONTROL);
    await expect(createExperienceMediaR2Source({
      binding: r2.binding,
      ownerId: OWNER,
      assetId: ASSET,
      folder: 'hero',
      bytes: jpeg(),
      contentType: 'image/jpeg',
    })).rejects.toThrow('experience_media_source_conflict');
    expect(r2.putCount).toBe(2);
  });

  test('rejects unsupported, spoofed, empty, and oversized bodies before write', async () => {
    for (const input of [
      { bytes: new Uint8Array(), contentType: 'image/jpeg' },
      { bytes: new Uint8Array([1, 2, 3]), contentType: 'image/jpeg' },
      { bytes: jpeg(), contentType: 'text/plain' },
      { bytes: new Uint8Array(10 * 1024 * 1024 + 1), contentType: 'image/jpeg' },
    ]) {
      const r2 = fakeR2();
      await expect(createExperienceMediaR2Source({
        binding: r2.binding,
        ownerId: OWNER,
        assetId: ASSET,
        folder: 'hero',
        ...input,
      })).rejects.toThrow();
      expect(r2.putCount).toBe(0);
    }
  });

  test('enables only exact Production ON and stays fail-closed elsewhere', () => {
    expect(experienceMediaSourceEnabled({ CLOUDFLARE_DEPLOYMENT_ENV: 'production', EXPERIENCE_MEDIA_R2_SOURCE_ENABLED: 'true' })).toBe(true);
    expect(experienceMediaSourceEnabled({ CLOUDFLARE_DEPLOYMENT_ENV: 'canary', EXPERIENCE_MEDIA_R2_SOURCE_ENABLED: 'true' })).toBe(false);
    expect(experienceMediaSourceEnabled({ CLOUDFLARE_DEPLOYMENT_ENV: 'production', EXPERIENCE_MEDIA_R2_SOURCE_ENABLED: 'false' })).toBe(false);
  });

  test('binds uploads to the owner while preserving the current admin edit flow', () => {
    expect(resolveExperienceMediaUploadOwner({ actorId: OWNER, isAdmin: false })).toBe(OWNER);
    expect(resolveExperienceMediaUploadOwner({ actorId: OWNER, isAdmin: false, experienceHostId: OWNER })).toBe(OWNER);
    expect(() => resolveExperienceMediaUploadOwner({ actorId: OWNER, isAdmin: false, experienceHostId: ASSET })).toThrow('forbidden');
    expect(resolveExperienceMediaUploadOwner({ actorId: OWNER, isAdmin: true, experienceHostId: ASSET })).toBe(ASSET);
  });
});
