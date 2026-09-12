import { expect, test } from '@playwright/test';

import { canaryAccessHeaders, protectCanaryBrowserContext, requiredEnv } from './helpers';

test.describe('Public Worker application surface', () => {
  test.beforeEach(async ({ context }) => {
    await protectCanaryBrowserContext(context);
  });

  test('serves representative SSR pages without a Worker 5xx', async ({ page }) => {
    const experienceId = requiredEnv('CLOUDFLARE_CANARY_EXPERIENCE_ID');
    const hostId = requiredEnv('CLOUDFLARE_CANARY_HOST_USER_ID');
    const failures: string[] = [];
    page.on('response', (response) => {
      if (new URL(response.url()).origin !== new URL(requiredEnv('CLOUDFLARE_CANARY_BASE_URL')).origin) {
        return;
      }
      if (response.status() >= 500) failures.push(`${response.status()} ${response.url()}`);
    });

    for (const path of ['/', '/search', `/experiences/${experienceId}`, `/users/${hostId}`]) {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), path).toBe(200);
    }

    await expect(page.getByText('Locally Staging host', { exact: true }).first()).toBeVisible();
    expect(failures).toEqual([]);
  });

  test('serves the public API, sitemap, static assets, redirects, and 404 contract', async ({ request }) => {
    const headers = canaryAccessHeaders();
    const experienceId = requiredEnv('CLOUDFLARE_CANARY_EXPERIENCE_ID');

    const api = await request.get('/api/home/experiences', { headers });
    expect(api.status()).toBe(200);
    expect(await api.text()).toContain('Cloudflare functional canary');

    const sitemap = await request.get('/sitemap.xml', { headers });
    expect(sitemap.status()).toBe(200);
    expect(sitemap.headers()['content-type']).toMatch(/^application\/xml/);
    expect(await sitemap.text()).toContain(requiredEnv('CLOUDFLARE_CANARY_BASE_URL'));

    const asset = await request.get('/images/logo.png', { headers });
    expect(asset.status()).toBe(200);
    expect(asset.headers()['content-type']).toMatch(/^image\/png/);

    const missing = await request.get(`/__cloudflare-canary-not-found__-${experienceId}`, { headers });
    expect(missing.status()).toBe(404);

    const redirect = await request.get('/login?back_url=%2Faccount', {
      headers,
      maxRedirects: 0,
    });
    expect(redirect.status()).toBe(308);
    expect(redirect.headers().location).toBe('https://locally2.imweb.me/login?back_url=%2Faccount');
  });
});
