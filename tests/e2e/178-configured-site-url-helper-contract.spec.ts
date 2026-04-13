import { expect, test } from '@playwright/test';

import { resolveConfiguredSiteUrl } from './helpers/siteUrl';

test.describe('Configured site URL helper', () => {
  test('uses NEXT_PUBLIC_SITE_URL as the single owner for domain-sensitive assertions', () => {
    expect(
      resolveConfiguredSiteUrl({
        NEXT_PUBLIC_SITE_URL: 'https://www.locally-travel.com/',
      })
    ).toBe('https://www.locally-travel.com');
  });

  test('fails closed when NEXT_PUBLIC_SITE_URL is missing', () => {
    expect(() => resolveConfiguredSiteUrl({})).toThrow(
      'Missing NEXT_PUBLIC_SITE_URL for domain-sensitive test expectations.'
    );
  });
});
