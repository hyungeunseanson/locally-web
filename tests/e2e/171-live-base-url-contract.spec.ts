import { expect, test } from '@playwright/test';

import { requireLiveBaseUrl, resolveLiveBaseUrl } from './helpers/liveBaseUrl';

test.describe('Live base URL helper', () => {
  test('prefers PLAYWRIGHT_LIVE_BASE_URL over NEXT_PUBLIC_SITE_URL', () => {
    expect(resolveLiveBaseUrl({
      PLAYWRIGHT_LIVE_BASE_URL: 'https://www.locally-travel.com',
      NEXT_PUBLIC_SITE_URL: 'https://locally-web.vercel.app',
    })).toBe('https://www.locally-travel.com');
  });

  test('falls back to NEXT_PUBLIC_SITE_URL when PLAYWRIGHT_LIVE_BASE_URL is missing', () => {
    expect(resolveLiveBaseUrl({
      NEXT_PUBLIC_SITE_URL: 'https://www.locally-travel.com',
    })).toBe('https://www.locally-travel.com');
  });

  test('returns null when no live base URL env is configured', () => {
    expect(resolveLiveBaseUrl({})).toBeNull();
  });

  test('throws when a live run is requested without any configured base URL', () => {
    expect(() => requireLiveBaseUrl({})).toThrow(
      'Missing PLAYWRIGHT_LIVE_BASE_URL or NEXT_PUBLIC_SITE_URL.'
    );
  });
});
