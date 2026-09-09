import { expect, test, type APIRequestContext } from '@playwright/test';

import { canaryHeaders, requiredEnv } from './helpers';

type CacheProbe = {
  slot: string;
  generationId: string;
  generatedAt: number;
  isolateId: string;
  durationMs: number;
  cacheContract: {
    revalidateSeconds: number;
    regenerationDelayMs: number;
  };
};

async function readProbe(request: APIRequestContext, slot: string) {
  const response = await request.get(
    `/api/canary/cloudflare/cache?slot=${encodeURIComponent(slot)}&request=${crypto.randomUUID()}`,
    { headers: canaryHeaders() }
  );
  expect(response.status()).toBe(200);
  return (await response.json()) as CacheProbe;
}

test.describe.serial('OpenNext remote cache semantics', () => {
  test('shares one unstable_cache value across repeated and cross-isolate requests', async ({ request }) => {
    const slot = `cross-isolate-${Date.now()}`;
    const warm = await readProbe(request, slot);
    const samples = await Promise.all(
      Array.from({ length: 64 }, () => readProbe(request, slot))
    );

    expect(warm.cacheContract.revalidateSeconds).toBe(60);
    expect(new Set(samples.map((sample) => sample.generationId))).toEqual(
      new Set([warm.generationId])
    );
    const minimumIsolates = Number(requiredEnv('CLOUDFLARE_CANARY_MIN_ISOLATES'));
    expect(Number.isInteger(minimumIsolates) && minimumIsolates >= 2).toBe(true);
    expect(new Set([warm, ...samples].map((sample) => sample.isolateId)).size).toBeGreaterThanOrEqual(
      minimumIsolates
    );
  });

  test('serves stale at the 60 second boundary and regenerates in the background', async ({ request }) => {
    test.setTimeout(100_000);
    const slot = `ttl-swr-${Date.now()}`;
    const warm = await readProbe(request, slot);
    await new Promise((resolve) => setTimeout(resolve, 61_000));

    const stale = await readProbe(request, slot);
    expect(stale.generationId).toBe(warm.generationId);
    expect(stale.durationMs).toBeLessThan(stale.cacheContract.regenerationDelayMs);

    await expect.poll(
      async () => (await readProbe(request, slot)).generationId,
      { timeout: 20_000, intervals: [500, 1_000, 2_000] }
    ).not.toBe(warm.generationId);
  });

  test('revalidateTag marks the shared value stale and refreshes it through SWR', async ({ request }) => {
    const slot = `tag-swr-${Date.now()}`;
    const warm = await readProbe(request, slot);
    const invalidation = await request.post('/api/canary/cloudflare/cache', {
      headers: canaryHeaders(),
      data: { action: 'revalidate-tag' },
    });
    expect(invalidation.status()).toBe(200);
    expect(await invalidation.json()).toMatchObject({
      accepted: true,
      profile: 'max',
    });

    const stale = await readProbe(request, slot);
    expect(stale.generationId).toBe(warm.generationId);
    await expect.poll(
      async () => (await readProbe(request, slot)).generationId,
      { timeout: 20_000, intervals: [500, 1_000, 2_000] }
    ).not.toBe(warm.generationId);
  });

  test('shares the cache across independently routed colo endpoints when supplied', async ({ request }) => {
    const rawUrls = process.env.CLOUDFLARE_CANARY_MULTI_COLO_URLS;
    test.skip(!rawUrls, 'Multi-colo endpoints are provisioned only for the remote canary gate.');
    const urls = rawUrls!.split(',').map((value) => value.trim()).filter(Boolean);
    expect(urls.length).toBeGreaterThanOrEqual(2);

    const slot = `multi-colo-${Date.now()}`;
    const results = await Promise.all(urls.map(async (baseUrl) => {
      const response = await request.get(
        `${baseUrl.replace(/\/$/, '')}/api/canary/cloudflare/cache?slot=${slot}`,
        { headers: canaryHeaders() }
      );
      expect(response.status()).toBe(200);
      return {
        payload: (await response.json()) as CacheProbe,
        colo: response.headers()['cf-ray']?.split('-').at(-1) || null,
      };
    }));

    expect(new Set(results.map(({ payload }) => payload.generationId)).size).toBe(1);
    expect(new Set(results.map(({ colo }) => colo).filter(Boolean)).size).toBeGreaterThanOrEqual(2);
  });
});
