import { expect, test } from '@playwright/test';

import { shouldRenderVercelAnalytics } from '@/app/utils/analytics/runtime';

test.describe('Vercel analytics runtime contract', () => {
  test('stays off by default outside deployed Vercel runtimes', () => {
    expect(shouldRenderVercelAnalytics({})).toBeFalsy();
    expect(shouldRenderVercelAnalytics({ NODE_ENV: 'development' })).toBeFalsy();
  });

  test('turns on automatically inside deployed Vercel runtimes', () => {
    expect(shouldRenderVercelAnalytics({ VERCEL: '1' })).toBeTruthy();
    expect(shouldRenderVercelAnalytics({ VERCEL_ENV: 'preview' })).toBeTruthy();
    expect(shouldRenderVercelAnalytics({ VERCEL_ENV: 'production' })).toBeTruthy();
  });

  test('respects explicit overrides for owner-boundary control', () => {
    expect(
      shouldRenderVercelAnalytics({
        VERCEL: '1',
        NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED: 'false',
      })
    ).toBeFalsy();

    expect(
      shouldRenderVercelAnalytics({
        NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED: 'true',
      })
    ).toBeTruthy();
  });
});
