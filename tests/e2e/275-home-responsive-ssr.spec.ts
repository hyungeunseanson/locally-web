import { createServer, type Server } from 'node:http';
import { expect, test } from '@playwright/test';

// Loopback fixture only; this production SSR test never needs a real Supabase project.
const experiences = Array.from({ length: 33 }, (_, index) => ({
  id: 98000 + index, host_id: 'responsive-ssr-host', status: 'active', is_active: true,
  title: `서울 체험 ${index + 1}`, title_en: `Seoul Experience ${index + 1}`,
  category: '문화 체험', city: '서울', country: 'South Korea', location: 'Seoul',
  languages: ['Korean'], photos: ['/images/company/partnership-media-kit/1.png'],
  image_url: '/images/company/partnership-media-kit/1.png', price: 35000,
  duration: 2, rating: 4.8, review_count: 5,
  created_at: new Date(Date.UTC(2026, 8, index + 1)).toISOString(),
}));
const sources: Record<string, unknown[]> = {
  public_host_applications: [{ id: 1, user_id: 'responsive-ssr-host', status: 'approved', created_at: '2026-09-01T00:00:00Z' }],
  experiences,
  experience_availability: experiences.map(({ id }) => ({ experience_id: id, date: '2099-10-01' })),
  experience_popularity_snapshot: experiences.map(({ id }, index) => ({ experience_id: id, wishlist_count: (index * 7) % 33 })),
};
let fixture: Server;
let fixtureWrites = 0;

test.describe('Home responsive production SSR', () => {
  test.skip(process.env.PLAYWRIGHT_SERVER_MODE !== 'start', 'Requires a local production build with the loopback Supabase fixture');
  test.beforeAll(async () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe('http://127.0.0.1:54329');
    fixture = createServer((request, response) => {
      if (request.method !== 'GET') {
        fixtureWrites += 1;
        response.writeHead(405).end();
        return;
      }
      const source = new URL(request.url ?? '/', 'http://127.0.0.1').pathname.split('/').at(-1) ?? '';
      const data = sources[source];
      response.writeHead(data ? 200 : 404, { 'content-type': 'application/json' });
      response.end(JSON.stringify(data ?? []));
    });
    await new Promise<void>((resolve) => fixture.listen(54329, '127.0.0.1', resolve));
  });
  test.afterAll(async () => {
    if (fixture) await new Promise<void>((resolve, reject) => fixture.close((error) => error ? reject(error) : resolve()));
  });

  test('SSR sends 34 unique section cards and preserves responsive layout and reveal state', async ({ request, page }) => {
    const response = await request.get('/');
    expect(response.status()).toBe(200);
    const html = await response.text();
    const cardIds = [...html.matchAll(/data-testid="(home-(?:popular|all)-experience-card-[^"]+)"/g)].map((match) => match[1]);
    expect(cardIds.filter((id) => id.startsWith('home-popular-'))).toHaveLength(10);
    expect(cardIds.filter((id) => id.startsWith('home-all-'))).toHaveLength(24);
    expect(new Set(cardIds).size).toBe(34);

    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && /hydration|did not match|server rendered/i.test(message.text())) errors.push(message.text());
    });
    await page.route('**/*', (route) => {
      const incoming = route.request();
      const hostname = new URL(incoming.url()).hostname;
      if (incoming.method() !== 'GET' || !['127.0.0.1', 'localhost'].includes(hostname)) return route.abort();
      return route.continue();
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const popular = page.getByTestId('home-popular-experiences-section').locator('[data-testid^="home-popular-experience-card-"]');
    const latest = page.getByTestId('home-all-experiences-section').locator('[data-testid^="home-all-experience-card-"]');
    await expect(latest.locator('visible=true')).toHaveCount(12);
    await expect(popular).toHaveCount(10);
    await expect(popular.first()).toHaveAttribute('data-testid', 'home-popular-experience-card-98014');
    await expect(latest.first()).toHaveAttribute('data-testid', 'home-all-experience-card-98032');
    expect((await popular.first().boundingBox())!.width).toBeCloseTo(390 * 0.42, 0);
    const firstLatest = (await latest.nth(0).boundingBox())!;
    const secondLatest = (await latest.nth(1).boundingBox())!;
    expect(firstLatest.y).toBe(secondLatest.y);
    expect(secondLatest.x).toBeGreaterThan(firstLatest.x);
    const scroller = popular.first().locator('..');
    await scroller.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
    await expect(popular.last()).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await page.getByTestId('home-mobile-all-experiences-load-more').click();
    await expect(latest.locator('visible=true')).toHaveCount(24);
    for (const [width, count] of [[768, 3], [1024, 4], [1280, 5], [1440, 5], [1536, 6]]) {
      await page.setViewportSize({ width, height: 1400 });
      await expect(popular.locator('visible=true')).toHaveCount(count);
      await expect(latest.locator('visible=true')).toHaveCount(24);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.getByTestId('home-desktop-all-experiences-load-more').click();
    await expect(latest).toHaveCount(33);
    await expect(page.getByTestId('home-desktop-all-experiences-load-more')).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(latest.locator('visible=true')).toHaveCount(33);
    await expect(page.getByTestId('home-mobile-all-experiences-load-more')).toHaveCount(0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(latest.locator('visible=true')).toHaveCount(12);
    await page.getByTestId('home-mobile-all-experiences-load-more').click();
    await expect(latest.locator('visible=true')).toHaveCount(24);
    await page.getByTestId('home-mobile-all-experiences-load-more').click();
    await expect(latest.locator('visible=true')).toHaveCount(33);
    expect(errors).toEqual([]);
    expect(fixtureWrites).toBe(0);
  });
});
