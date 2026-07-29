import { expect, test, type APIRequestContext } from '@playwright/test';

const LEGACY_ORIGIN = 'https://locally2.imweb.me';

const legacySitemapPaths = [
  '/programs',
  '/archive',
  '/38',
  '/esim',
  '/partner',
  '/57',
  '/59',
  '/event',
  '/32',
  '/52',
  '/51',
  '/73',
  '/62',
  '/75',
  '/64',
  '/1523756371',
  '/shop_view/125',
  '/shop_view/173',
  '/shop_view/176',
  '/shop_view/178',
  '/shop_view/169',
  '/shop_view/160',
  '/shop_view/132',
  '/shop_view/198',
  '/shop_view/138',
  '/shop_view/187',
  '/shop_view/155',
  '/shop_view/204',
  '/shop_view/98',
  '/shop_view/180',
  '/shop_view/191',
  '/shop_view/119',
  '/shop_view/192',
  '/shop_view/179',
  '/shop_view/141',
  '/shop_view/182',
  '/shop_view/194',
  '/shop_view/181',
  '/shop_view/195',
  '/shop_view/115',
  '/shop_view/200',
  '/shop_view/183',
  '/shop_view/170',
  '/shop_view/177',
  '/shop_view/199',
  '/shop_view/128',
  '/shop_view/129',
  '/shop_view/124',
  '/shop_view/112',
  '/shop_view/104',
  '/shop_view/149',
  '/shop_view/107',
  '/shop_view/175',
  '/shop_view/157',
  '/shop_view/154',
  '/shop_view/122',
  '/shop_view/166',
  '/shop_view/185',
  '/shop_view/163',
  '/shop_view/121',
  '/shop_view/174',
  '/shop_view/144',
  '/shop_view/139',
  '/shop_view/94',
  '/shop_view/189',
  '/shop_view/184',
  '/shop_view/172',
  '/shop_view/158',
  '/shop_view/165',
  '/shop_view/111',
  '/shop_view/110',
  '/shop_view/159',
  '/shop_view/142',
  '/shop_view/164',
  '/shop_view/140',
  '/shop_view/168',
  '/shop_view/117',
  '/shop_view/135',
] as const;

const internalSitemapRedirects = [
  ['/home', '/'],
  ['/apply', '/become-a-host'],
  ['/partners', '/company/partnership'],
] as const;

function expectEquivalentLocation(actualLocation: string | undefined, expected: string) {
  expect(actualLocation).toBeTruthy();

  const actualUrl = new URL(actualLocation!, 'http://127.0.0.1:3000');
  const expectedUrl = new URL(expected, 'http://127.0.0.1:3000');

  expect(actualUrl.origin).toBe(expectedUrl.origin);
  expect(actualUrl.pathname).toBe(expectedUrl.pathname);
  expect([...actualUrl.searchParams.entries()]).toEqual([...expectedUrl.searchParams.entries()]);
}

async function expectPermanentRedirect(
  request: APIRequestContext,
  source: string,
  destination: string
) {
  const response = await request.get(source, { maxRedirects: 0 });

  expect(response.status(), source).toBe(308);
  expectEquivalentLocation(response.headers().location, destination);
}

test.describe('Legacy Imweb domain cutover redirects', () => {
  test('covers every route in the current 82-URL Imweb sitemap', async ({ request }) => {
    expect(legacySitemapPaths).toHaveLength(78);
    expect(internalSitemapRedirects).toHaveLength(3);

    for (const path of legacySitemapPaths) {
      await expectPermanentRedirect(request, path, `${LEGACY_ORIGIN}${path}`);
    }

    for (const [source, destination] of internalSitemapRedirects) {
      await expectPermanentRedirect(request, source, destination);
    }

    const retainedAbout = await request.get('/about', { maxRedirects: 0 });
    expect(retainedAbout.status()).toBe(200);
  });

  test('preserves legacy content, product, host-board, and order queries', async ({ request }) => {
    const cases = [
      '/archive?idx=123&bmode=view&q=guide&category=travel&page=2&t=board',
      '/programs?idx=189',
      '/shop_view?idx=189&type=detail&type_code=legacy',
      '/52?idx=189',
      '/partner?idx=47&bmode=view&page=3',
      '/shop_payment?order_code=ORDER-2026-001',
      '/shop_mypage?mode=order',
      '/shop/change_password?return_url=%2Fshop_mypage',
      '/backpg/login.cm?back_url=%2Fshop_cart',
      '/site_join?back_url=%2Fprograms',
      '/logout.cm?back_url=%2Fhome',
    ] as const;

    for (const source of cases) {
      await expectPermanentRedirect(request, source, `${LEGACY_ORIGIN}${source}`);
    }
  });

  test('redirects only legacy login and policy query shapes', async ({ request }) => {
    await expectPermanentRedirect(
      request,
      '/login?back_url=%2Fshop_mypage&used_login_btn=Y',
      `${LEGACY_ORIGIN}/login?back_url=%2Fshop_mypage&used_login_btn=Y`
    );
    await expectPermanentRedirect(
      request,
      '/login?used_login_btn=Y',
      `${LEGACY_ORIGIN}/login?used_login_btn=Y`
    );

    for (const mode of ['policy', 'privacy', 'domesticoverseas']) {
      await expectPermanentRedirect(
        request,
        `/?mode=${mode}&idx=terms`,
        `${LEGACY_ORIGIN}/?mode=${mode}&idx=terms`
      );
    }
  });

  test('keeps new-site pages, auth, locale, and APIs out of Imweb', async ({ request }) => {
    const newSitePaths = [
      '/',
      '/?redirect=no',
      '/?mode=other',
      '/about',
      '/login',
      '/login?returnUrl=%2Fwishlist',
      '/search',
      '/services/intro',
      '/community',
      '/en/search',
      '/ja/services/intro',
      '/api/payment/card-ready',
    ] as const;

    for (const path of newSitePaths) {
      const response = await request.get(path, { maxRedirects: 0 });
      const location = response.headers().location || '';

      expect(location, path).not.toContain(LEGACY_ORIGIN);
    }
  });

  test('keeps singular partner on Imweb and plural partners on the new site', async ({ request }) => {
    await expectPermanentRedirect(
      request,
      '/partner?idx=47&bmode=view',
      `${LEGACY_ORIGIN}/partner?idx=47&bmode=view`
    );
    await expectPermanentRedirect(request, '/partners', '/company/partnership');
  });
});
