import { createServer, type Server } from 'node:http';
import { expect, test } from '@playwright/test';

const fixturePort = 54329;
const visibleExperience = {
  id: 99001,
  host_id: 'host-visible',
  status: 'active',
  is_active: true,
  title: '서울 사전 로드 체험',
  title_ko: '서울 사전 로드 체험',
  title_en: 'Seoul Preloaded Experience',
  title_ja: 'ソウル事前読み込み体験',
  title_zh: '首尔预加载体验',
  category: '문화 체험',
  city: '서울',
  country: 'South Korea',
  location: 'Seoul',
  languages: ['Korean', 'English'],
  photos: [],
  image_url: null,
  rating: 4.8,
  review_count: 5,
  price: 12000,
  duration: 2,
  created_at: '2026-09-01T00:00:00.000Z',
};

let server: Server;
let mode: 'records' | 'empty' | 'fail-once' = 'records';
let failNextHostRequest = false;
let responseDelayMs = 0;
const queries: string[] = [];

function respond(response: import('node:http').ServerResponse, status: number, data: unknown) {
  setTimeout(() => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(data));
  }, responseDelayMs);
}

test.describe('Home public data behind brand splash', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    server = createServer((request, response) => {
      const path = new URL(request.url ?? '/', `http://127.0.0.1:${fixturePort}`).pathname;
      queries.push(path);
      if (path.endsWith('/public_host_applications')) {
        if (mode === 'fail-once' && failNextHostRequest) {
          failNextHostRequest = false;
          respond(response, 500, { message: 'temporary fixture failure' });
          return;
        }
        respond(response, 200, mode === 'empty' ? [] : [
          { id: 1, user_id: 'host-visible', status: 'approved', created_at: '2026-09-01T00:00:00.000Z', is_superhost: false },
          { id: 2, user_id: 'host-private', status: 'rejected', created_at: '2026-09-01T00:00:00.000Z', is_superhost: false },
        ]);
        return;
      }
      if (path.endsWith('/experiences')) {
        respond(response, 200, [
          visibleExperience,
          { ...visibleExperience, id: 99002, title: 'Inactive Experience', is_active: false },
          { ...visibleExperience, id: 99003, title: 'Private Host Experience', host_id: 'host-private' },
        ]);
        return;
      }
      if (path.endsWith('/experience_availability')) {
        respond(response, 200, [{ experience_id: 99001, date: '2099-10-01' }]);
        return;
      }
      if (path.endsWith('/experience_popularity_snapshot')) {
        respond(response, 200, [{ experience_id: 99001, wishlist_count: 3 }]);
        return;
      }
      respond(response, 404, { message: 'fixture route not found' });
    });
    await new Promise<void>((resolve) => server.listen(fixturePort, '127.0.0.1', resolve));
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  test.beforeEach(async ({ context }) => {
    mode = 'records';
    failNextHostRequest = false;
    responseDelayMs = 0;
    queries.length = 0;
    await context.addCookies([{ name: 'app_lang', value: 'ko', url: 'http://127.0.0.1:3000' }]);
  });

  test('renders visible cards in initial HTML without an initial Home API GET on desktop and mobile', async ({ page }) => {
    const hydrationErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && /hydration|did not match|server rendered HTML/i.test(message.text())) {
        hydrationErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => {
      if (/hydration|did not match|server rendered HTML/i.test(error.message)) hydrationErrors.push(error.message);
    });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const homeApiRequests: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes('/api/home/experiences')) homeApiRequests.push(request.url());
      });
      const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
      expect(await response?.text()).toContain('서울 사전 로드 체험');
      const section = width > 768 ? 'home-desktop-all-experiences-section' : 'home-mobile-all-experiences-section';
      await expect(page.getByTestId(section).getByText('서울 사전 로드 체험')).toBeVisible();
      await page.waitForTimeout(1500);
      expect(homeApiRequests).toHaveLength(0);
      expect(queries.some((path) => path.endsWith('/public_host_applications'))).toBe(true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId(section).getByText('서울 사전 로드 체험')).toBeVisible();
      expect(homeApiRequests).toHaveLength(0);
    }
    expect(hydrationErrors).toEqual([]);
  });

  test('keeps inactive experiences and private hosts out of the shared page and API contract', async ({ page, request }) => {
    const html = await (await request.get('/')).text();
    expect(html).toContain('서울 사전 로드 체험');
    expect(html).not.toContain('Inactive Experience');
    expect(html).not.toContain('Private Host Experience');
    const response = await request.get('/api/home/experiences');
    expect(response.ok()).toBe(true);
    const payload = await response.json();
    expect(payload.data.map((item: { id: number }) => item.id)).toEqual([99001]);
    expect(payload.data[0].available_dates).toEqual(['2099-10-01']);
    expect(payload.data[0].wishlist_count).toBe(3);
    await page.goto('/');
    await expect(page.getByText('Inactive Experience')).toHaveCount(0);
  });

  test('treats a successful empty result as an empty state without fetching the API again', async ({ page }) => {
    mode = 'empty';
    const homeApiRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/home/experiences')) homeApiRequests.push(request.url());
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('home-load-error-state')).toHaveCount(0);
    await expect(page.getByTestId('home-desktop-all-experiences-section')).toHaveCount(0);
    await page.waitForTimeout(1500);
    expect(homeApiRequests).toHaveLength(0);
  });

  test('falls back to one client API request if the server initial fetch fails', async ({ page }) => {
    mode = 'fail-once';
    failNextHostRequest = true;
    const homeApiRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/home/experiences')) homeApiRequests.push(request.url());
    });
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId('home-desktop-all-experiences-section').getByText('서울 사전 로드 체험')).toBeVisible();
    expect(homeApiRequests).toHaveLength(1);
  });

  test('keeps the Home splash bounded on first load, refresh, and browser back', async ({ page }) => {
    const splash = page.locator('div[style*="z-index: 9999"] > img[alt="Locally"]');
    const verifySplash = async () => {
      await expect(splash).toBeVisible();
      await expect(splash.locator('..')).toHaveCSS('animation-duration', '1.3s');
      const visibleAt = Date.now();
      await expect(splash).toBeHidden({ timeout: 2500 });
      const visibleMs = Date.now() - visibleAt;
      expect(visibleMs).toBeGreaterThanOrEqual(750);
      await expect(page.getByTestId('home-desktop-all-experiences-section').getByText('서울 사전 로드 체험')).toBeVisible();
    };

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await verifySplash();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await verifySplash();
    await page.goto('/about', { waitUntil: 'domcontentloaded' });
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(splash).toBeHidden({ timeout: 2500 });
    await expect(page.getByTestId('home-desktop-all-experiences-section').getByText('서울 사전 로드 체험')).toBeVisible();
  });

  test('shows the brand splash when navigating from another route to Home', async ({ page }) => {
    await page.goto('/about', { waitUntil: 'domcontentloaded' });
    await page.locator('a[href="/"]').first().click();
    const splash = page.locator('div[style*="z-index: 9999"] > img[alt="Locally"]');
    await expect(splash).toBeVisible();
    await expect(splash).toBeHidden({ timeout: 2500 });
    await expect(page.getByTestId('home-desktop-all-experiences-section').getByText('서울 사전 로드 체험')).toBeVisible();
  });

  test('streams the splash and a skeleton before slow public data finishes', async ({ page }) => {
    responseDelayMs = 1000;
    const splash = page.locator('div[style*="z-index: 9999"] > img[alt="Locally"]');
    await page.goto('/', { waitUntil: 'commit' });
    await expect(splash).toBeVisible();
    await expect(page.getByTestId('home-streaming-skeleton')).toBeAttached();
    await expect(splash).toBeHidden({ timeout: 2500 });
    await expect(page.getByTestId('home-streaming-skeleton')).toBeVisible();
    await expect(page.getByTestId('home-desktop-all-experiences-section').getByText('서울 사전 로드 체험')).toBeVisible();
  });

  test('preserves the language-change splash and localized cards', async ({ page }) => {
    const splash = page.locator('div[style*="z-index: 9999"] > img[alt="Locally"]');
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(splash).toBeHidden();
    await page.locator('button:has(svg.lucide-globe)').first().click();
    await page.getByRole('button', { name: 'English' }).click();
    await expect(splash).toBeVisible();
    await expect(splash).toBeHidden({ timeout: 2500 });
    await expect(page.getByTestId('home-desktop-all-experiences-section').getByText('Seoul Preloaded Experience')).toBeVisible();
  });

  for (const [locale, title] of [
    ['ko', '서울 사전 로드 체험'],
    ['en', 'Seoul Preloaded Experience'],
    ['ja', 'ソウル事前読み込み体験'],
    ['zh', '首尔预加载体验'],
  ] as const) {
    test(`renders initial data in ${locale}`, async ({ page, context }) => {
      await context.addCookies([{ name: 'app_lang', value: locale, url: 'http://127.0.0.1:3000' }]);
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('home-desktop-all-experiences-section').getByText(title)).toBeVisible();
    });
  }
});
