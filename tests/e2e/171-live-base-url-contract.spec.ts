import { expect, test } from '@playwright/test';

import { resolveLiveBaseUrl } from './helpers/liveBaseUrl';

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

  test('keeps the legacy vercel domain as the final fallback', () => {
    expect(resolveLiveBaseUrl({})).toBe('https://locally-web.vercel.app');
  });
});
