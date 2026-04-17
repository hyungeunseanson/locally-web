import { expect, test } from '@playwright/test';

import {
  pickRepresentativePublicPaths,
  resolveAdsTxtExpectation,
} from '@/scripts/domain-parity-lib.mjs';

test.describe('Live domain parity helper contract', () => {
  test('picks stable representative public surfaces from the configured sitemap origin', () => {
    const sitemapText = `
      <urlset>
        <url><loc>https://www.locally-travel.com/</loc></url>
        <url><loc>https://www.locally-travel.com/search</loc></url>
        <url><loc>https://www.locally-travel.com/services/intro</loc></url>
        <url><loc>https://www.locally-travel.com/experiences/123</loc></url>
        <url><loc>https://www.locally-travel.com/community/post-1</loc></url>
        <url><loc>https://www.locally-travel.com/users/host-1</loc></url>
        <url><loc>https://www.locally-travel.com/experiences/456</loc></url>
      </urlset>
    `;

    expect(
      pickRepresentativePublicPaths({
        expectedOrigin: 'https://www.locally-travel.com',
        sitemapText,
      })
    ).toEqual([
      '/search',
      '/services/intro',
      '/experiences/123',
      '/community/post-1',
      '/users/host-1',
    ]);
  });

  test('ignores foreign origins and deduplicates repeated sitemap entries', () => {
    const sitemapText = `
      <urlset>
        <url><loc>https://www.locally-travel.com/search</loc></url>
        <url><loc>https://www.locally-travel.com/search</loc></url>
        <url><loc>https://www.locally-travel.com/services/intro</loc></url>
        <url><loc>https://legacy.example.com/experiences/999</loc></url>
        <url><loc>https://www.locally-travel.com/community/post-2</loc></url>
      </urlset>
    `;

    expect(
      pickRepresentativePublicPaths({
        expectedOrigin: 'https://www.locally-travel.com',
        sitemapText,
      })
    ).toEqual(['/search', '/services/intro', '/community/post-2']);
  });

  test('drives ads.txt expectation from publisher id presence, not the global ad toggle', () => {
    expect(resolveAdsTxtExpectation({})).toEqual({
      clientId: null,
      expectedStatus: 404,
    });

    expect(
      resolveAdsTxtExpectation({
        NEXT_PUBLIC_ADSENSE_ENABLED: 'false',
        NEXT_PUBLIC_ADSENSE_CLIENT_ID: 'ca-pub-1234567890',
      })
    ).toEqual({
      clientId: 'ca-pub-1234567890',
      expectedStatus: 200,
    });
  });
});
