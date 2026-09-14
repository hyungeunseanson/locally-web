import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, test, type Page } from '@playwright/test';
import { build } from 'esbuild';

import { PUBLIC_EXPERIENCE_CARD_IMAGES } from '../../app/data/publicExperienceCardImages';
import detailImageManifest from '../../app/data/publicExperienceDetailImages.generated.json';
import { getCloudflareExperienceCardImage } from '../../app/utils/cloudflareImageCanary';
import { getCloudflarePublicExperienceDetailImage } from '../../app/utils/cloudflarePublicExperienceDetailImages';
import {
  buildPublicExperienceCardKeys,
  buildPublicExperienceDetailKeys,
  isPublicExperienceR2Eligible,
} from '../../app/utils/publicExperienceMediaKeys';
import {
  isPublicExperienceDeterministicReaderTarget,
  parsePublicExperienceMediaReaderAllowlist,
} from '../../app/utils/publicExperienceMediaReader';

const BASE_URL = 'https://media-canary.locally-travel.com';
const FIXTURE_ID = 999991;
const SECOND_FIXTURE_ID = 999992;
const FIXTURE_ORIGIN =
  'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/experiences/experience/11111111-1111-4111-8111-111111111111/hero/deterministic-reader.jpg';
const SECOND_FIXTURE_ORIGIN =
  'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/experiences/experience/11111111-1111-4111-8111-111111111111/hero/deterministic-reader-next.jpg';
const VALID_WEBP = Buffer.from(
  'UklGRjAAAABXRUJQVlA4ICQAAABQAQCdASoCAAIAAUAmJQBOgC6gAP77LkvF3YjjJ4dVU9ffoAA=',
  'base64'
);

const [manifestExperienceId, manifestCard] = Object.entries(PUBLIC_EXPERIENCE_CARD_IMAGES)[0]!;
const manifestDetailOrigin = Object.keys(detailImageManifest[manifestExperienceId as keyof typeof detailImageManifest])[0]!;
const manifestDetail = detailImageManifest[
  manifestExperienceId as keyof typeof detailImageManifest
][manifestDetailOrigin as keyof (typeof detailImageManifest)[keyof typeof detailImageManifest]];

type ReaderHarnessConfiguration = {
  kind: 'card' | 'detail';
  experienceId: number | string;
  originImageUrl: string;
  r2Eligible: boolean;
};

type ReaderHarnessArtifacts = {
  clientBundlePath: string;
  render(configuration: ReaderHarnessConfiguration): string;
};

const fixtureDirectory = path.resolve('tests/fixtures/public-experience-media-reader');
const fixtureArtifactsDirectory = mkdtempSync(path.join(os.tmpdir(), 'locally-reader-components-'));
const harnesses = new Map<'enabled' | 'disabled', ReaderHarnessArtifacts>();

async function buildReaderHarness(mode: 'enabled' | 'disabled') {
  const enabled = mode === 'enabled';
  const define = {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL': JSON.stringify(BASE_URL),
    'process.env.NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED': JSON.stringify(
      enabled ? 'true' : 'false'
    ),
    'process.env.NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_EXPERIENCE_IDS': JSON.stringify(
      enabled ? `${FIXTURE_ID},${SECOND_FIXTURE_ID}` : ''
    ),
  };
  const alias = {
    'next/image': path.join(fixtureDirectory, 'NextImageStub.tsx'),
  };
  const serverBundlePath = path.join(fixtureArtifactsDirectory, `${mode}-server.cjs`);
  const clientBundlePath = path.join(fixtureArtifactsDirectory, `${mode}-client.js`);

  await Promise.all([
    build({
      entryPoints: [path.join(fixtureDirectory, 'ReaderHarness.server.tsx')],
      outfile: serverBundlePath,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22',
      alias,
      define,
      logLevel: 'silent',
    }),
    build({
      entryPoints: [path.join(fixtureDirectory, 'ReaderHarness.client.tsx')],
      outfile: clientBundlePath,
      bundle: true,
      platform: 'browser',
      format: 'iife',
      target: 'chrome120',
      alias,
      define,
      logLevel: 'silent',
    }),
  ]);

  const server = await import(`${pathToFileURL(serverBundlePath).href}?mode=${mode}`) as {
    renderReaderHarness(configuration: ReaderHarnessConfiguration): string;
  };
  harnesses.set(mode, {
    clientBundlePath,
    render: server.renderReaderHarness,
  });
}

async function openReaderHarness(
  page: Page,
  mode: 'enabled' | 'disabled',
  configuration: ReaderHarnessConfiguration,
  hydrationErrors?: string[]
) {
  const harness = harnesses.get(mode)!;
  if (hydrationErrors) {
    page.on('console', (message) => {
      if (message.type() === 'error' && /hydration/i.test(message.text())) {
        hydrationErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => {
      if (/hydration/i.test(error.message)) hydrationErrors.push(error.message);
    });
  }
  await page.setContent(`<main id="root">${harness.render(configuration)}</main>`);
  await page.addScriptTag({ path: harness.clientBundlePath });
  await page.evaluate((nextConfiguration) => {
    window.publicExperienceMediaReaderHarness.hydrate(nextConfiguration);
  }, configuration);
}

async function mountReaderHarness(
  page: Page,
  mode: 'enabled' | 'disabled',
  configuration: ReaderHarnessConfiguration
) {
  const harness = harnesses.get(mode)!;
  await page.setContent('<main id="root"></main>');
  await page.addScriptTag({ path: harness.clientBundlePath });
  await page.evaluate((nextConfiguration) => {
    window.publicExperienceMediaReaderHarness.mount(nextConfiguration);
  }, configuration);
}

async function updateReaderHarness(
  page: Page,
  configuration: ReaderHarnessConfiguration
) {
  await page.evaluate((nextConfiguration) => {
    window.publicExperienceMediaReaderHarness.update(nextConfiguration);
  }, configuration);
}

function enableFixtureReader(experienceIds = String(FIXTURE_ID)) {
  process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL = BASE_URL;
  process.env.NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED = 'true';
  process.env.NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_EXPERIENCE_IDS = experienceIds;
}

function buildFixtureExperience(originImageUrl = FIXTURE_ORIGIN) {
  return {
    id: FIXTURE_ID,
    title: 'Deterministic reader fixture',
    category: '투어',
    city: 'Seoul',
    country: 'Korea',
    location: 'Seoul',
    languages: ['Korean'],
    card_image_url: originImageUrl,
    photos: [originImageUrl],
    image_url: originImageUrl,
    rating: 5,
    review_count: 0,
    wishlist_count: 0,
    price: 10000,
    duration: 2,
    public_image_r2_eligible: true,
    available_dates: [],
    created_at: '2026-09-14T00:00:00.000Z',
  };
}

function buildDisplayedR2Url(
  kind: 'card' | 'detail',
  experienceId: number | string,
  originImageUrl: string
) {
  const key = kind === 'card'
    ? buildPublicExperienceCardKeys(experienceId, originImageUrl).largeKey
    : buildPublicExperienceDetailKeys(experienceId, originImageUrl).mediumKey;
  return `${BASE_URL}/${key}`;
}

test.describe('default-OFF deterministic public experience media reader', () => {
  test.beforeAll(async () => {
    await Promise.all([buildReaderHarness('enabled'), buildReaderHarness('disabled')]);
  });

  test.beforeEach(() => enableFixtureReader());

  test.afterEach(() => {
    delete process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL;
    delete process.env.NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED;
    delete process.env.NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_EXPERIENCE_IDS;
  });

  test.afterAll(() => {
    rmSync(fixtureArtifactsDirectory, { recursive: true, force: true });
  });

  test('requires an exact enabled flag and entirely valid numeric allowlist', () => {
    expect(parsePublicExperienceMediaReaderAllowlist({
      enabled: 'true',
      experienceIds: `${FIXTURE_ID},3309`,
    })).toEqual(new Set([String(FIXTURE_ID), '3309']));
    expect(parsePublicExperienceMediaReaderAllowlist({
      enabled: 'false',
      experienceIds: String(FIXTURE_ID),
    }).size).toBe(0);
    expect(parsePublicExperienceMediaReaderAllowlist({
      enabled: 'true',
      experienceIds: `${FIXTURE_ID},*`,
    }).size).toBe(0);
    expect(isPublicExperienceDeterministicReaderTarget(FIXTURE_ID)).toBe(true);
    expect(isPublicExperienceDeterministicReaderTarget('invalid')).toBe(false);
  });

  test('resolves manifest-missing card and detail keys from the current approved origin', () => {
    const cardKeys = buildPublicExperienceCardKeys(FIXTURE_ID, FIXTURE_ORIGIN);
    const detailKeys = buildPublicExperienceDetailKeys(FIXTURE_ID, FIXTURE_ORIGIN);

    expect(getCloudflareExperienceCardImage(FIXTURE_ID, FIXTURE_ORIGIN, true)).toEqual({
      smallUrl: `${BASE_URL}/${cardKeys.smallKey}`,
      largeUrl: `${BASE_URL}/${cardKeys.largeKey}`,
    });
    expect(getCloudflarePublicExperienceDetailImage(FIXTURE_ID, FIXTURE_ORIGIN, true)).toEqual({
      smallUrl: `${BASE_URL}/${detailKeys.smallKey}`,
      mediumUrl: `${BASE_URL}/${detailKeys.mediumKey}`,
      largeUrl: `${BASE_URL}/${detailKeys.largeKey}`,
    });
  });

  test('uses the current origin instead of a stale manifest origin for an allowlisted target', () => {
    enableFixtureReader(manifestExperienceId);
    expect(SECOND_FIXTURE_ORIGIN).not.toBe(manifestCard.originUrl);
    const cardKeys = buildPublicExperienceCardKeys(manifestExperienceId, SECOND_FIXTURE_ORIGIN);
    const detailKeys = buildPublicExperienceDetailKeys(manifestExperienceId, SECOND_FIXTURE_ORIGIN);

    expect(getCloudflareExperienceCardImage(manifestExperienceId, SECOND_FIXTURE_ORIGIN, true)).toEqual({
      smallUrl: `${BASE_URL}/${cardKeys.smallKey}`,
      largeUrl: `${BASE_URL}/${cardKeys.largeKey}`,
    });
    expect(
      getCloudflarePublicExperienceDetailImage(manifestExperienceId, SECOND_FIXTURE_ORIGIN, true)
    ).toEqual({
      smallUrl: `${BASE_URL}/${detailKeys.smallKey}`,
      mediumUrl: `${BASE_URL}/${detailKeys.mediumKey}`,
      largeUrl: `${BASE_URL}/${detailKeys.largeKey}`,
    });
  });

  test('fails closed for ineligible state, invalid source, and invalid ID', () => {
    for (const eligibility of [
      { status: 'inactive', is_active: true },
      { status: 'pending', is_active: true },
      { status: 'rejected', is_active: true },
      { status: 'approved', is_active: true },
      { status: 'active', is_active: false },
      { status: 'active', is_active: null },
      null,
    ]) {
      const eligible = isPublicExperienceR2Eligible(eligibility);
      expect(eligible).toBe(false);
      expect(getCloudflareExperienceCardImage(FIXTURE_ID, FIXTURE_ORIGIN, eligible)).toBeNull();
      expect(getCloudflarePublicExperienceDetailImage(FIXTURE_ID, FIXTURE_ORIGIN, eligible)).toBeNull();
    }

    for (const invalidOrigin of [
      `${FIXTURE_ORIGIN}?changed=1`,
      `${FIXTURE_ORIGIN}#changed`,
      FIXTURE_ORIGIN.replace('/experiences/', '/avatars/'),
      FIXTURE_ORIGIN.replace('uhinvcydgzqlpnvieyal.supabase.co', 'example.com'),
      'https://example.com/private.jpg',
    ]) {
      expect(getCloudflareExperienceCardImage(FIXTURE_ID, invalidOrigin, true)).toBeNull();
      expect(getCloudflarePublicExperienceDetailImage(FIXTURE_ID, invalidOrigin, true)).toBeNull();
    }
    expect(getCloudflareExperienceCardImage('invalid', FIXTURE_ORIGIN, true)).toBeNull();
  });

  test('preserves manifest behavior when OFF, malformed, or outside the rollout', () => {
    process.env.NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED = 'false';
    process.env.NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_EXPERIENCE_IDS = '';
    expect(getCloudflareExperienceCardImage(manifestExperienceId, manifestCard.originUrl)).toEqual({
      smallUrl: `${BASE_URL}/${manifestCard.smallKey}`,
      largeUrl: `${BASE_URL}/${manifestCard.largeKey}`,
    });

    process.env.NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED = 'true';
    process.env.NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_EXPERIENCE_IDS = `${FIXTURE_ID},invalid`;
    expect(getCloudflarePublicExperienceDetailImage(manifestExperienceId, manifestDetailOrigin)).not.toBeNull();

    enableFixtureReader();
    expect(getCloudflareExperienceCardImage(manifestExperienceId, manifestCard.originUrl)).not.toBeNull();
  });

  test('threads strict eligibility through every public card/detail callsite without touching host avatars', () => {
    const sources = [
      'app/components/HomeExperienceCard.tsx',
      'app/components/ExperienceCard.tsx',
      'app/search/page.tsx',
      'app/guest/wishlists/page.tsx',
      'app/experiences/[id]/ExperienceClient.tsx',
      'app/experiences/[id]/components/ExpMainContent.tsx',
    ].map((path) => readFileSync(path, 'utf8'));
    for (const source of sources) expect(source).toContain('r2Eligible=');

    const homeRoute = readFileSync('app/api/home/experiences/route.ts', 'utf8');
    const searchRoute = readFileSync('app/api/search/experiences/route.ts', 'utf8');
    const hostProfile = readFileSync('app/users/[id]/page.tsx', 'utf8');
    expect(homeRoute).toContain('public_image_r2_eligible: isPublicExperienceR2Eligible(experience)');
    expect(searchRoute).toContain('publicItem.public_image_r2_eligible = publicImageR2Eligible');
    expect(hostProfile).toContain("'status'");
    expect(hostProfile).toContain("'is_active'");
    expect(readFileSync('app/components/PublicHostProfileImage.tsx', 'utf8')).not.toContain(
      'publicExperienceMediaReader'
    );
  });

  test('keeps failure state target-scoped and has no mutation dependency', () => {
    for (const componentPath of [
      'app/components/PublicExperienceCardImage.tsx',
      'app/components/PublicExperienceDetailImage.tsx',
    ]) {
      const source = readFileSync(componentPath, 'utf8');
      expect(source).toContain('targetIdentity');
      expect(source).toContain('failedCloudflareTarget?.identity === targetIdentity');
    }
    const readerSource = readFileSync('app/utils/publicExperienceMediaReader.ts', 'utf8');
    expect(readerSource).not.toMatch(/Queue|\.put\(|\.send\(|transform\(|CopyObject|DeleteObject/);
  });

  test('renders a manifest-missing card from deterministic R2 without hydration errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.route('**/api/home/experiences', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [buildFixtureExperience()] }),
    }));
    await page.route(`${BASE_URL}/**`, (route) => route.fulfill({
      status: 200,
      contentType: 'image/webp',
      headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
      body: VALID_WEBP,
    }));

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const card = page.locator(`a[href="/experiences/${FIXTURE_ID}"]:visible`).first();
    const image = card.locator('[data-image-delivery="cloudflare-r2"]');
    await expect(image).toBeVisible({ timeout: 15_000 });
    await expect(image).toHaveJSProperty('complete', true);
    expect(await image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
    await expect(image).toHaveAttribute(
      'src',
      `${BASE_URL}/${buildPublicExperienceCardKeys(FIXTURE_ID, FIXTURE_ORIGIN).largeKey}`
    );
    expect(errors.filter((message) => /hydration/i.test(message))).toEqual([]);
  });

  test('removes every failed R2 candidate and falls back once to the current Supabase origin', async ({ page }) => {
    let r2Requests = 0;
    await page.route('**/api/home/experiences', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [buildFixtureExperience()] }),
    }));
    await page.route(`${BASE_URL}/**`, (route) => {
      r2Requests += 1;
      return route.fulfill({ status: 404, body: 'missing fixture' });
    });
    await page.route(FIXTURE_ORIGIN, (route) => route.fulfill({
      status: 200,
      contentType: 'image/webp',
      body: VALID_WEBP,
    }));

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const card = page.locator(`a[href="/experiences/${FIXTURE_ID}"]:visible`).first();
    const fallback = card.locator('[data-image-delivery="supabase-fallback"]');
    await expect(fallback).toBeVisible({ timeout: 15_000 });
    await expect(fallback).toHaveAttribute('src', FIXTURE_ORIGIN);
    await expect(card.locator('source')).toHaveCount(0);
    await expect(card.locator(`[src^="${BASE_URL}"]`)).toHaveCount(0);
    const settledRequestCount = r2Requests;
    await page.waitForTimeout(500);
    expect(r2Requests).toBe(settledRequestCount);
  });

  for (const kind of ['card', 'detail'] as const) {
    test(`${kind} component hydrates with the same compiled reader configuration and loads deterministic R2`, async ({ page }) => {
      const hydrationErrors: string[] = [];
      await page.route(`${BASE_URL}/**`, (route) => route.fulfill({
        status: 200,
        contentType: 'image/webp',
        body: VALID_WEBP,
      }));

      await openReaderHarness(page, 'enabled', {
        kind,
        experienceId: FIXTURE_ID,
        originImageUrl: FIXTURE_ORIGIN,
        r2Eligible: true,
      }, hydrationErrors);

      const attribute = kind === 'card' ? 'data-image-delivery' : 'data-detail-image-delivery';
      const image = page.locator(`img[${attribute}="cloudflare-r2"]`);
      await expect(image).toHaveCount(1);
      await expect(image).toHaveJSProperty('complete', true);
      expect(await image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
      expect(hydrationErrors).toEqual([]);
    });

    for (const failure of ['404', 'network'] as const) {
      test(`${kind} component falls back after an R2 ${failure} without retrying the failed target`, async ({ page }) => {
        let r2Requests = 0;
        let originRequests = 0;
        await page.route(`${BASE_URL}/**`, (route) => {
          r2Requests += 1;
          return failure === '404'
            ? route.fulfill({ status: 404, body: 'not found' })
            : route.abort('failed');
        });
        await page.route(FIXTURE_ORIGIN, (route) => {
          originRequests += 1;
          return route.fulfill({ status: 200, contentType: 'image/webp', body: VALID_WEBP });
        });

        await mountReaderHarness(page, 'enabled', {
          kind,
          experienceId: FIXTURE_ID,
          originImageUrl: FIXTURE_ORIGIN,
          r2Eligible: true,
        });

        const attribute = kind === 'card' ? 'data-image-delivery' : 'data-detail-image-delivery';
        const fallback = page.locator(`img[${attribute}="supabase-fallback"]`);
        await expect(fallback).toHaveAttribute('src', FIXTURE_ORIGIN);
        await expect(fallback).toHaveJSProperty('complete', true);
        expect(await fallback.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
        await expect(page.locator('source')).toHaveCount(0);
        expect(r2Requests).toBeGreaterThan(0);
        expect(originRequests).toBeGreaterThan(0);
        const settledCounts = { r2Requests, originRequests };
        await page.waitForTimeout(300);
        expect({ r2Requests, originRequests }).toEqual(settledCounts);
      });
    }

    test(`${kind} component does not leak a failed target across origin and experience changes`, async ({ page }) => {
      const firstKeys = kind === 'card'
        ? buildPublicExperienceCardKeys(FIXTURE_ID, FIXTURE_ORIGIN)
        : buildPublicExperienceDetailKeys(FIXTURE_ID, FIXTURE_ORIGIN);
      const firstTargetKeys = new Set(Object.values(firstKeys));

      await page.route(`${BASE_URL}/**`, (route) => {
        const requestKey = new URL(route.request().url()).pathname.slice(1);
        return firstTargetKeys.has(requestKey)
          ? route.fulfill({ status: 404, body: 'first target missing' })
          : route.fulfill({ status: 200, contentType: 'image/webp', body: VALID_WEBP });
      });
      await page.route(FIXTURE_ORIGIN, (route) => route.fulfill({
        status: 200,
        contentType: 'image/webp',
        body: VALID_WEBP,
      }));

      await mountReaderHarness(page, 'enabled', {
        kind,
        experienceId: FIXTURE_ID,
        originImageUrl: FIXTURE_ORIGIN,
        r2Eligible: true,
      });
      const attribute = kind === 'card' ? 'data-image-delivery' : 'data-detail-image-delivery';
      await expect(page.locator(`img[${attribute}="supabase-fallback"]`)).toHaveCount(1);

      await updateReaderHarness(page, {
        kind,
        experienceId: FIXTURE_ID,
        originImageUrl: SECOND_FIXTURE_ORIGIN,
        r2Eligible: true,
      });
      const secondExpectedUrl = buildDisplayedR2Url(kind, FIXTURE_ID, SECOND_FIXTURE_ORIGIN);
      await expect(page.locator(`img[${attribute}="cloudflare-r2"]`)).toHaveAttribute('src', secondExpectedUrl);

      await updateReaderHarness(page, {
        kind,
        experienceId: FIXTURE_ID,
        originImageUrl: FIXTURE_ORIGIN,
        r2Eligible: true,
      });
      await expect(page.locator(`img[${attribute}="supabase-fallback"]`)).toHaveAttribute(
        'src',
        FIXTURE_ORIGIN
      );

      await updateReaderHarness(page, {
        kind,
        experienceId: SECOND_FIXTURE_ID,
        originImageUrl: FIXTURE_ORIGIN,
        r2Eligible: true,
      });
      const thirdExpectedUrl = buildDisplayedR2Url(kind, SECOND_FIXTURE_ID, FIXTURE_ORIGIN);
      await expect(page.locator(`img[${attribute}="cloudflare-r2"]`)).toHaveAttribute('src', thirdExpectedUrl);
    });

    test(`${kind} component stops after the Supabase fallback also fails`, async ({ page }) => {
      let r2Requests = 0;
      let originRequests = 0;
      await page.route(`${BASE_URL}/**`, (route) => {
        r2Requests += 1;
        return route.abort('failed');
      });
      await page.route(FIXTURE_ORIGIN, (route) => {
        originRequests += 1;
        return route.abort('failed');
      });

      await mountReaderHarness(page, 'enabled', {
        kind,
        experienceId: FIXTURE_ID,
        originImageUrl: FIXTURE_ORIGIN,
        r2Eligible: true,
      });
      const attribute = kind === 'card' ? 'data-image-delivery' : 'data-detail-image-delivery';
      await expect(page.locator(`img[${attribute}="supabase-fallback"]`)).toHaveCount(1);
      await page.waitForTimeout(300);
      expect(r2Requests).toBeGreaterThan(0);
      expect(originRequests).toBeGreaterThan(0);
      const settledCounts = { r2Requests, originRequests };
      await page.waitForTimeout(500);
      expect({ r2Requests, originRequests }).toEqual(settledCounts);
    });
  }

  for (const kind of ['card', 'detail'] as const) {
    test(`OFF ${kind} bundle hydrates and preserves the existing static manifest resolver`, async ({ page }) => {
      const hydrationErrors: string[] = [];
      await page.route(`${BASE_URL}/**`, (route) => route.fulfill({
        status: 200,
        contentType: 'image/webp',
        body: VALID_WEBP,
      }));
      const originImageUrl = kind === 'card' ? manifestCard.originUrl : manifestDetailOrigin;
      await openReaderHarness(page, 'disabled', {
        kind,
        experienceId: manifestExperienceId,
        originImageUrl,
        r2Eligible: true,
      }, hydrationErrors);

      const attribute = kind === 'card' ? 'data-image-delivery' : 'data-detail-image-delivery';
      await expect(page.locator(`img[${attribute}="cloudflare-r2"]`)).toHaveAttribute(
        'src',
        `${BASE_URL}/${kind === 'card' ? manifestCard.largeKey : manifestDetail.mediumKey}`
      );
      expect(hydrationErrors).toEqual([]);
    });
  }
});
