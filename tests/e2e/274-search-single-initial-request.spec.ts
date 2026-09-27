import { expect, test, type Page, type Route } from '@playwright/test';

const experience = (id: string, city = '도쿄') => ({
  id,
  title: `${city} 체험 ${id}`,
  title_en: `${city} experience ${id}`,
  category: 'nightlife',
  city,
  country: 'Japan',
  location: `${city} Station`,
  languages: ['English', 'Korean'],
  image_url: '/images/company/partnership-media-kit/1.png',
  rating: 4.8,
  review_count: 12,
  price: 85000,
});

function resultId(url: URL) {
  if (url.searchParams.get('city') === '오사카') return '9701';
  if (url.searchParams.has('types')) return '9702';
  if (url.searchParams.has('times')) return '9703';
  if (url.searchParams.has('startDate')) return '9704';
  if (url.searchParams.get('language') === 'English') return '9705';
  if (url.searchParams.has('location')) return '9706';
  return '9700';
}

async function stubSearch(page: Page, responder?: (route: Route) => Promise<void>) {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'GET' && new URL(request.url()).pathname === '/api/search/experiences') {
      requests.push(request.url());
    }
  });
  await page.route('**/api/search/experiences?**', responder ?? (async (route) => {
    const url = new URL(route.request().url());
    const id = resultId(url);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [experience(id, id === '9701' ? '오사카' : '도쿄')] }) });
  }));
  return requests;
}

async function expectOneNewRequest(requests: string[], previousCount: number, expectedQuery: string) {
  await expect.poll(() => requests.length).toBe(previousCount + 1);
  await new Promise((resolve) => setTimeout(resolve, 350));
  expect(requests).toHaveLength(previousCount + 1);
  expect(new URL(requests[previousCount]).search).toBe(expectedQuery);
}

test.describe('Search sends one GET per request identity', () => {
  test('cold desktop/mobile entries keep one initial GET through provider hydration', async ({ page }) => {
    test.setTimeout(180_000);
    const requests = await stubSearch(page);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ['/search', '/search?language=all', '/search?location=Tokyo&language=all', '/en/search']) {
        for (let repetition = 0; repetition < 3; repetition += 1) {
          requests.length = 0;
          const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
          expect(response?.status()).toBe(200);
          const expectedId = path.includes('location=') ? '9706' : '9700';
          const expectedCard = width < 768 ? page.getByTestId(`search-mobile-result-card-${expectedId}`).first() : page.getByTestId(`search-result-card-${expectedId}`);
          await expect(expectedCard).toBeVisible();
          await page.waitForTimeout(450);
          expect(requests, `${width}px ${path} repetition ${repetition + 1}`).toHaveLength(1);
          expect(new URL(requests[0]).search).toBe(path.includes('location=') ? '?location=Tokyo&language=all' : '?language=all');
        }
      }
    }
  });

  test('real filter changes each send one distinct GET and render matching results', async ({ page }) => {
    const requests = await stubSearch(page);
    await page.goto('/en/search');
    await expect(page.getByTestId('search-result-card-9700')).toBeVisible();
    await expectOneNewRequest(requests, 0, '?language=all');

    await page.getByTestId('search-desktop-city-chip').click();
    await page.getByTestId('search-city-option-오사카').click();
    await expect(page.getByTestId('search-result-card-9701')).toBeVisible();
    await expectOneNewRequest(requests, 1, '?location=%EC%98%A4%EC%82%AC%EC%B9%B4&language=all&city=%EC%98%A4%EC%82%AC%EC%B9%B4');

    await page.getByTestId('search-desktop-type-chip').click();
    await page.getByRole('button', { name: 'Architecture', exact: true }).click();
    await expectOneNewRequest(requests, 2, '?location=%EC%98%A4%EC%82%AC%EC%B9%B4&language=all&city=%EC%98%A4%EC%82%AC%EC%B9%B4&types=architecture');

    await page.getByTestId('search-desktop-time-chip').click();
    await page.getByRole('button', { name: /Morning/ }).last().click();
    await expectOneNewRequest(requests, 3, '?location=%EC%98%A4%EC%82%AC%EC%B9%B4&language=all&city=%EC%98%A4%EC%82%AC%EC%B9%B4&times=morning&types=architecture');
  });

  test('slow prior response cannot overwrite a newer city result', async ({ page }) => {
    let releaseTokyo: (() => void) | undefined;
    const requests = await stubSearch(page, async (route) => {
      const url = new URL(route.request().url());
      const city = url.searchParams.get('city');
      if (city === '도쿄') await new Promise<void>((resolve) => { releaseTokyo = resolve; });
      const id = city === '오사카' ? '9701' : city === '도쿄' ? '9706' : '9700';
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [experience(id, city || '도쿄')] }) });
    });
    await page.goto('/search');
    await expect(page.getByTestId('search-result-card-9700')).toBeVisible();
    await page.getByTestId('search-desktop-city-chip').first().click();
    await page.getByTestId('search-city-option-도쿄').first().click();
    await expect.poll(() => Boolean(releaseTokyo)).toBe(true);
    await page.getByTestId('search-desktop-city-chip').first().click();
    await page.getByTestId('search-city-option-오사카').first().click();
    await expect(page.getByTestId('search-result-card-9701')).toBeVisible();
    releaseTokyo?.();
    await page.waitForTimeout(450);
    await expect(page.getByTestId('search-result-card-9701')).toBeVisible();
    await expect(page.getByTestId('search-result-card-9706')).toHaveCount(0);
    expect(requests).toHaveLength(3);
  });

  test('one failed GET yields one localized toast and ends loading; empty data ends loading', async ({ page }) => {
    const requests = await stubSearch(page, async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'fixture failure' }) });
    });
    await page.goto('/en/search');
    await expect(page.getByText('Failed to load search results. Please try again shortly.')).toHaveCount(1);
    await expect(page.getByTestId('search-empty-state').last()).toBeVisible();
    await page.waitForTimeout(450);
    expect(requests).toHaveLength(1);

    await page.unroute('**/api/search/experiences?**');
    await page.route('**/api/search/experiences?**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    });
    requests.length = 0;
    await page.reload();
    await expect(page.getByTestId('search-empty-state').last()).toBeVisible();
    await page.waitForTimeout(450);
    expect(requests).toHaveLength(1);
  });

  test('locale routes and representative query values preserve request and result mapping', async ({ page }) => {
    const requests = await stubSearch(page);
    const cases: Array<[string, string, string]> = [
      ['/search', '?language=all', '9700'],
      ['/en/search?location=Tokyo&language=all', '?location=Tokyo&language=all', '9706'],
      ['/ja/search?language=English', '?language=English', '9705'],
      ['/zh/search?startDate=2026-10-01&endDate=2026-10-02', '?language=all&startDate=2026-10-01&endDate=2026-10-02', '9704'],
    ];
    for (const [path, query, id] of cases) {
      requests.length = 0;
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByTestId(`search-result-card-${id}`)).toBeVisible();
      await expectOneNewRequest(requests, 0, query);
    }
  });
});
