import { expect, test } from '@playwright/test';

import { buildAbsoluteUrl, buildLocalizedAbsoluteUrl, resolveSiteUrl } from '@/app/utils/siteUrl';

test.describe('Site URL runtime contract', () => {
  test('uses NEXT_PUBLIC_SITE_URL when configured', () => {
    expect(
      resolveSiteUrl({
        NODE_ENV: 'production',
        NEXT_PUBLIC_SITE_URL: 'https://www.locally-travel.com/',
      })
    ).toBe('https://www.locally-travel.com');
  });

  test('falls back to localhost only outside production', () => {
    expect(resolveSiteUrl({ NODE_ENV: 'development' })).toBe('http://localhost:3000');
    expect(resolveSiteUrl({ NODE_ENV: 'test' })).toBe('http://localhost:3000');
  });

  test('throws in production when NEXT_PUBLIC_SITE_URL is missing', () => {
    expect(() => resolveSiteUrl({ NODE_ENV: 'production' })).toThrow(
      'Missing NEXT_PUBLIC_SITE_URL for production runtime.'
    );
  });

  test('builds safe absolute URLs from the resolved site URL', () => {
    expect(
      buildAbsoluteUrl('/community', {
        NODE_ENV: 'production',
        NEXT_PUBLIC_SITE_URL: 'https://www.locally-travel.com',
      })
    ).toBe('https://www.locally-travel.com/community');

    expect(
      buildAbsoluteUrl('https://malicious.example.com', {
        NODE_ENV: 'production',
        NEXT_PUBLIC_SITE_URL: 'https://www.locally-travel.com',
      })
    ).toBe('https://www.locally-travel.com');

    expect(
      buildLocalizedAbsoluteUrl('en', '/help', {
        NODE_ENV: 'production',
        NEXT_PUBLIC_SITE_URL: 'https://www.locally-travel.com',
      })
    ).toBe('https://www.locally-travel.com/en/help');
  });
});
