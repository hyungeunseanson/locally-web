import { expect, test } from '@playwright/test';

test('public home, search, detail, and login respond through GET only', async ({ request }) => {
  const home = await request.get('/');
  expect(home.status()).toBe(200);
  const html = await home.text();
  const experienceId = html.match(/href="\/experiences\/(\d+)"/)?.[1];
  expect(experienceId, 'home must expose a public experience').toBeTruthy();

  for (const path of ['/search', `/experiences/${experienceId}`, '/login', '/robots.txt', '/sitemap.xml']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
  }
});

test('anonymous requests cannot read administrator access or analytics', async ({ request }) => {
  for (const path of ['/api/admin/access', '/api/admin/analytics-summary']) {
    const response = await request.get(path);
    expect([401, 403], path).toContain(response.status());
  }
});
