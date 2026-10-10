import path from 'node:path';

import { expect, test } from '@playwright/test';

import { PUBLIC_EXPERIENCE_CARD_IMAGES } from '../../app/data/publicExperienceCardImages';
import { getCloudflareImageCanary } from '../../app/utils/cloudflareImageCanary';

const [canaryExperienceId, canaryImage] = Object.entries(PUBLIC_EXPERIENCE_CARD_IMAGES)[0]!;
const originImageUrl = canaryImage.originUrl;

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

  for (const timing of ['before-hydration', 'after-hydration', 'fallback-also-fails']) {
  test(`falls back to the exact Next Image source when R2 fails: ${timing}`, async ({
    page,
  }) => {
    expect(new URL(test.info().project.use.baseURL!).hostname).toBe('127.0.0.1');
    let apiCalls = 0;
    let r2Calls = 0;
    let releaseR2!: () => void;
    const hydrated = new Promise<void>(resolve => { releaseR2 = resolve; });
    let releaseScripts!: () => void;
    const scriptsReady = new Promise<void>(resolve => { releaseScripts = resolve; });
    if (timing === 'before-hydration') await page.route(/\.js(?:\?|$)/, async route => {
      await scriptsReady;
      await route.continue();
    });

    await page.route('**/api/home/experiences', async (route) => {
      apiCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });
    await page.route('https://media-canary.locally-travel.com/**', async (route) => {
      if (timing === 'after-hydration') await hydrated;
      r2Calls += 1;
      await route.fulfill({ status: 503, body: 'intentional canary failure' });
    });
    await page.route(originImageUrl, async (route) => {
      if (timing === 'fallback-also-fails') return route.fulfill({status:503,body:'source unavailable'});
      await route.fulfill({ path: path.resolve('tests/e2e/test-image.png') });
    });

    const html = await (await page.request.get('/')).text();
    expect(html).toContain(`href="/experiences/${canaryExperienceId}"`);
    expect(html).toContain('data-image-delivery="cloudflare-r2"');
    await page.goto('/', { waitUntil: timing === 'before-hydration' ? 'commit' : 'domcontentloaded' });
    if (timing === 'before-hydration') {
      await expect.poll(()=>page.locator('[data-image-delivery="cloudflare-r2"]').evaluate((image:HTMLImageElement)=>image.complete && image.naturalWidth === 0)).toBe(true);
      await expect(page.locator('main')).toHaveAttribute('data-hydrated','false');
      releaseScripts();
    }

    await expect(page.locator('main')).toHaveAttribute('data-hydrated','true');
    releaseR2();
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
    await expect(page.locator('main')).toHaveAttribute('data-hydrated','true');
    await expect.poll(()=>card.locator('img').evaluate((image: HTMLImageElement)=>image.complete && image.naturalWidth > 0)).toBe(timing !== 'fallback-also-fails');
    await expect(card.locator('img')).toHaveAttribute('src', originImageUrl);
    const detail = page.locator('[data-detail-image-delivery="supabase-fallback"]');
    await expect(detail).toBeVisible();
    await expect(detail).toHaveAttribute('src',originImageUrl);
    await expect.poll(()=>detail.evaluate((image:HTMLImageElement)=>image.complete && image.naturalWidth > 0)).toBe(timing !== 'fallback-also-fails');
    await expect(page.locator('[data-detail-image-delivery="cloudflare-r2"]')).toHaveCount(0);
    expect(r2Calls).toBeGreaterThan(0);
    expect(apiCalls).toBe(0);
    await test.info().attach('hydrated-dom',{body:await page.content(),contentType:'text/html'});
  });
  }
});
