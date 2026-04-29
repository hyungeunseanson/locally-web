import { readFileSync } from 'fs';

import { expect, test } from '@playwright/test';

test.describe('Public cache policy contract', () => {
  test('keeps home and search API cache-control headers stable', async ({ request }) => {
    const homeResponse = await request.get('/api/home/experiences');
    expect(homeResponse.ok()).toBeTruthy();
    expect(homeResponse.headers()['cache-control']).toBe('public, s-maxage=300, stale-while-revalidate=3600');

    const searchResponse = await request.get('/api/search/experiences');
    expect(searchResponse.ok()).toBeTruthy();
    expect(searchResponse.headers()['cache-control']).toBe('public, s-maxage=120, stale-while-revalidate=600');
  });

  test('keeps community and sitemap revalidation windows stable in source', () => {
    const sitemapSource = readFileSync('app/sitemap.ts', 'utf8');

    expect(readFileSync('app/community/boardFeed.server.ts', 'utf8')).toContain(
      'const COMMUNITY_BOARD_FEED_REVALIDATE_SECONDS = 60;'
    );
    expect(readFileSync('app/community/detailData.server.ts', 'utf8')).toContain(
      'const COMMUNITY_DETAIL_REVALIDATE_SECONDS = 300;'
    );
    expect(sitemapSource).toContain('export const revalidate = 3600;');
    expect(sitemapSource).toContain("'app/config/companyNotices.ts'");
  });
});
