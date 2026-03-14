import { expect, test } from '@playwright/test';

test.describe('Robots policy', () => {
  test('disallows only API crawl paths and leaves private UI to page-level noindex', async ({ request }) => {
    const response = await request.get('/robots.txt');

    expect(response.ok()).toBeTruthy();

    const text = await response.text();

    expect(text).toContain('Disallow: /api/');
    expect(text).not.toContain('/admin/');
    expect(text).not.toContain('/host/dashboard/');
    expect(text).not.toContain('/guest/inbox/');
  });
});
