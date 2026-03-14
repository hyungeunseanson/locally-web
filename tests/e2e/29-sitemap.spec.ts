import { expect, test } from '@playwright/test';

test.describe('Sitemap route', () => {
  test('exposes only live public paths with stable lastmod tags', async ({ request }) => {
    const response = await request.get('/sitemap.xml');

    expect(response.ok()).toBeTruthy();

    const xml = await response.text();

    expect(xml).toContain('<loc>https://locally-web.vercel.app/search</loc>');
    expect(xml).toContain('<loc>https://locally-web.vercel.app/community</loc>');
    expect(xml).toContain('<loc>https://locally-web.vercel.app/services/intro</loc>');
    expect(xml).toContain('<loc>https://locally-web.vercel.app/site-map</loc>');
    expect(xml).not.toContain('/company/community');
    expect(xml).toMatch(/<lastmod>[^<]+<\/lastmod>/);
  });
});
