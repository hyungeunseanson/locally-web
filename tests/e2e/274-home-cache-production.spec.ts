import { createServer, type Server } from 'node:http';
import { expect, test } from '@playwright/test';

const fixturePort = 54329;
const sourceNames = [
  'public_host_applications',
  'experiences',
  'experience_popularity_snapshot',
];

let server: Server;
const sourceRequests: string[] = [];

function deliveredAt(html: string) {
  const match = html.match(/initialExperiencesUpdatedAt.{0,30}?(\d{13})/);
  expect(match, 'SSR must deliver a fresh initialExperiencesUpdatedAt').not.toBeNull();
  return Number(match![1]);
}

test.describe('production Home public dataset cache', () => {
  test.skip(process.env.PLAYWRIGHT_SERVER_MODE !== 'start', 'Run after the production Next build with PLAYWRIGHT_SERVER_MODE=start');

  test.beforeAll(async () => {
    server = createServer((request, response) => {
      const path = new URL(request.url ?? '/', `http://127.0.0.1:${fixturePort}`).pathname;
      const source = sourceNames.find((name) => path.endsWith(`/${name}`));
      if (path.endsWith('/experience_availability')) sourceRequests.push('experience_availability');
      else if (source) sourceRequests.push(source);

      const data = source === 'public_host_applications'
        ? [{ id: 1, user_id: 'cache-test-host', status: 'approved', created_at: '2026-09-01T00:00:00.000Z', is_superhost: true }]
        : source === 'experiences'
          ? [{
              id: 99501, host_id: 'cache-test-host', status: 'active', is_active: true,
              title: 'Cached Home Experience', title_ko: 'Cached Home Experience',
              category: '문화 체험', city: '서울', country: 'South Korea', location: 'Seoul',
              languages: ['Korean'], photos: [], image_url: null,
              rating: 4.8, review_count: 5, price: 12000, duration: 2,
              created_at: '2026-09-01T00:00:00.000Z',
            }]
          : source === 'experience_availability'
            ? [{ experience_id: 99501, date: '2099-10-01' }]
            : source === 'experience_popularity_snapshot'
              ? [{ experience_id: 99501, wishlist_count: 7 }]
              : { message: 'fixture route not found' };
      response.writeHead(source ? 200 : 404, { 'content-type': 'application/json' });
      response.end(JSON.stringify(data));
    });
    await new Promise<void>((resolve) => server.listen(fixturePort, '127.0.0.1', resolve));
  });

  test.afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  test('reuses public data across requests and refreshes the delivery timestamp', async ({ request, page }) => {
    const first = await request.get('/');
    expect(first.status()).toBe(200);
    const firstHtml = await first.text();
    expect(firstHtml).toContain('Cached Home Experience');
    expect(sourceRequests).not.toContain('experience_availability');
    const firstSourceCount = sourceRequests.length;
    // A fresh local build makes three reads; a repeated test may reuse the persisted local Data Cache.
    expect([0, 3]).toContain(firstSourceCount);
    if (firstSourceCount === 3) expect([...sourceRequests].sort()).toEqual([...sourceNames].sort());
    const firstUpdatedAt = deliveredAt(firstHtml);

    await new Promise((resolve) => setTimeout(resolve, 100));
    const second = await request.get('/');
    expect(second.status()).toBe(200);
    const secondHtml = await second.text();
    expect(secondHtml).toContain('Cached Home Experience');
    expect(sourceRequests).toHaveLength(firstSourceCount);
    expect(deliveredAt(secondHtml)).toBeGreaterThan(firstUpdatedAt);

    const homeApiRequests: string[] = [];
    const browserRequests: string[] = [];
    page.on('request', (browserRequest) => browserRequests.push(browserRequest.url()));
    page.on('request', (browserRequest) => {
      if (browserRequest.url().includes('/api/home/experiences')) homeApiRequests.push(browserRequest.url());
    });
    await page.addInitScript(() => {
      const state = { shell: null as number | null, card: null as number | null, splash: false, lcp: null as number | null };
      Object.assign(window, { __homePerf: state });
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) state.lcp = entry.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch { /* LCP may not be available in every browser. */ }
      const check = () => {
        const now = performance.now();
        if (state.shell === null && document.querySelector('[data-testid="home-streaming-skeleton"], [data-testid="home-all-experiences-section"]')) state.shell = now;
        if (state.card === null && document.querySelector('[data-testid^="home-all-experience-card-"]')) state.card = now;
        if (document.querySelector('.locally-brand-splash')) state.splash = true;
        window.setTimeout(check, 25);
      };
      check();
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('home-all-experiences-section').getByText('Cached Home Experience')).toBeVisible();
    await page.waitForTimeout(1500);
    expect(homeApiRequests).toEqual([]);
    const localTiming = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      const state = (window as Window & { __homePerf?: { shell: number | null; card: number | null; splash: boolean; lcp: number | null } }).__homePerf;
      if (!state) throw new Error('Home performance observer was not installed');
      return {
        ttfbMs: nav.responseStart,
        domContentLoadedMs: nav.domContentLoadedEventEnd,
        fcpMs: fcp?.startTime ?? null,
        lcpMs: state.lcp,
        firstShellMs: state.shell,
        firstCardMs: state.card,
        splashObserved: state.splash,
      };
    });
    console.log('Local production Home browser timing:', JSON.stringify({ ...localTiming, requestCount: browserRequests.length }));
    const payload = await (await request.get('/api/home/experiences')).json();
    for (const field of ['host_id', 'is_superhost', 'photos', 'image_url', 'available_dates']) {
      expect(payload.data[0]).not.toHaveProperty(field);
    }
    expect(sourceRequests).not.toContain('experience_availability');
  });
});
