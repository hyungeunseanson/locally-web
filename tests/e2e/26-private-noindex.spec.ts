import { expect, test } from '@playwright/test';

const PRIVATE_PATHS = [
  '/account',
  '/guest/trips',
  '/guest/inbox',
  '/guest/wishlists',
  '/notifications',
  '/services',
  '/services/my',
] as const;

test.describe('Private noindex smoke', () => {
  for (const path of PRIVATE_PATHS) {
    test(`serves noindex metadata for ${path}`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.ok()).toBeTruthy();

      const html = await response.text();
      expect(html).toMatch(/<meta[^>]+name="robots"[^>]+content="[^"]*noindex[^"]*nofollow/i);
    });
  }
});
