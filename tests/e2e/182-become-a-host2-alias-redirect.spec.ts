import { expect, test } from '@playwright/test';

test.describe('Legacy host landing alias redirect', () => {
  test('redirects the bare alias permanently to the canonical host landing', async ({ request }) => {
    const response = await request.get('/become-a-host2', {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe('/become-a-host');
  });

  test('preserves query params on the alias redirect', async ({ request }) => {
    const response = await request.get('/become-a-host2?utm_source=legacy&step=cta', {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe('/become-a-host?utm_source=legacy&step=cta');
  });

  test('keeps the locale prefix on localized alias redirects', async ({ request }) => {
    const response = await request.get('/en/become-a-host2?utm_source=legacy', {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe('/en/become-a-host?utm_source=legacy');
  });
});
