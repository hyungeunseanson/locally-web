import { build } from 'esbuild';
import { expect, test } from '@playwright/test';

const fixture = Array.from({ length: 5 }, (_, index) => ({
  id: index + 1,
  host_id: `host-${index + 1}`,
  guest_id: `guest-${index + 1}`,
  booking_id: `booking-${index + 1}`,
  rating: 5 - index,
  content: `게스트 평가 내용 ${index + 1}`,
  created_at: '2026-09-20T12:00:00.000Z',
}));

test('guest review API denies anonymous and non-admin readers, then maps five read-only rows', async () => {
  const state = {
    user: null as { id: string; email: string } | null,
    isAdmin: false,
    queriedTables: [] as string[],
  };
  const rows: Record<string, Array<Record<string, unknown>>> = {
    guest_reviews: fixture,
    profiles: fixture.flatMap((review, index) => [
      { id: review.host_id, full_name: `호스트 ${index + 1}` },
      { id: review.guest_id, full_name: `게스트 ${index + 1}` },
    ]),
    bookings: fixture.map((review, index) => ({
      id: review.booking_id,
      order_id: `ORDER-${index + 1}`,
      experience_id: index + 1,
    })),
    experiences: fixture.map((_, index) => ({ id: index + 1, title: `체험 ${index + 1}` })),
  };
  const client = {
    from(table: string) {
      state.queriedTables.push(table);
      const query = {
        select: () => query,
        order: () => query,
        range: async (from: number, to: number) => ({ data: rows[table].slice(from, to + 1), error: null }),
        in: async (column: string, ids: unknown[]) => ({
          data: rows[table].filter((row) => ids.includes(row[column])),
          error: null,
        }),
      };
      return query;
    },
  };
  Object.assign(globalThis, { __guestReviewRouteTest: { state, client } });

  const compiled = await build({
    entryPoints: ['app/api/admin/guest-reviews/route.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    plugins: [{
      name: 'route-dependencies',
      setup(buildApi) {
        buildApi.onResolve({ filter: /^(next\/server|@\/app\/utils\/(adminAccess|supabase\/(admin|server)))$/ },
          (args) => ({ path: args.path, namespace: 'route-test' }));
        buildApi.onLoad({ filter: /.*/, namespace: 'route-test' }, (args) => {
          if (args.path === 'next/server') {
            return { contents: 'export const NextResponse = { json: (body, init) => Response.json(body, init) };', loader: 'js' };
          }
          if (args.path.endsWith('adminAccess')) {
            return { contents: 'export const resolveAdminAccess = async () => ({ isAdmin: globalThis.__guestReviewRouteTest.state.isAdmin });', loader: 'js' };
          }
          if (args.path.endsWith('supabase/admin')) {
            return { contents: 'export const createAdminClient = () => globalThis.__guestReviewRouteTest.client;', loader: 'js' };
          }
          return { contents: 'export const createClient = async () => ({ auth: { getUser: async () => ({ data: { user: globalThis.__guestReviewRouteTest.state.user }, error: null }) } });', loader: 'js' };
        });
      },
    }],
  });
  const route = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`) as {
    GET: (request: Request) => Promise<Response>;
  };
  const request = new Request('http://localhost/api/admin/guest-reviews');

  expect((await route.GET(request)).status).toBe(401);
  expect(state.queriedTables).toEqual([]);

  state.user = { id: 'not-admin', email: 'guest@example.com' };
  expect((await route.GET(request)).status).toBe(403);
  expect(state.queriedTables).toEqual([]);

  state.user = { id: 'admin', email: 'admin@example.com' };
  state.isAdmin = true;
  const response = await route.GET(request);
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.data).toHaveLength(5);
  expect(result.data[0]).toMatchObject({
    host_name: '호스트 1',
    guest_name: '게스트 1',
    experience_title: '체험 1',
    booking_number: 'ORDER-1',
    rating: 5,
    content: '게스트 평가 내용 1',
  });
  expect(Object.keys(result.data[0]).sort()).toEqual([
    'booking_number', 'content', 'created_at', 'experience_title', 'guest_name', 'host_name', 'id', 'rating',
  ]);
  expect(state.queriedTables).toEqual(['guest_reviews', 'profiles', 'bookings', 'experiences']);
});

test('review quality tabs preserve experience actions and show five searchable guest reviews at 390px', async ({ page }) => {
  const browserBundle = await build({
    stdin: {
      contents: `
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        import ReviewsTab from './app/admin/dashboard/components/ReviewsTab';
        window.mountReviewsTab = () => createRoot(document.getElementById('fixture')).render(React.createElement(ReviewsTab));
      `,
      resolveDir: process.cwd(),
      loader: 'js',
    },
    bundle: true,
    format: 'iife',
    platform: 'browser',
    write: false,
    plugins: [{
      name: 'admin-ui-context',
      setup(buildApi) {
        buildApi.onResolve({ filter: /^(next\/image|@\/app\/(context\/ToastContext|hooks\/useConfirmDialog))$/ },
          (args) => ({ path: args.path, namespace: 'review-ui-test' }));
        buildApi.onLoad({ filter: /.*/, namespace: 'review-ui-test' }, (args) => {
          if (args.path === 'next/image') {
            return { contents: 'export default function Image() { return null; }', loader: 'js' };
          }
          if (args.path.endsWith('ToastContext')) {
            return { contents: 'export const useToast = () => ({ showToast: () => {} });', loader: 'js' };
          }
          return { contents: 'export const useConfirmDialog = () => ({ requestConfirm: () => {}, ConfirmDialogElement: null });', loader: 'js' };
        });
      },
    }],
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login', { waitUntil: 'networkidle' });
  const stylesheets = await page.locator('link[rel="stylesheet"]').evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href));
  await page.goto('about:blank');
  await page.setContent(`<html><head>${stylesheets.map((href) => `<link rel="stylesheet" href="${href}">`).join('')}</head><body><main id="fixture" class="p-4"></main></body></html>`);
  await page.evaluate(({ guestRows }) => {
    const experienceRows = [{
      id: 99,
      rating: 4,
      content: '기존 체험 후기',
      reply: null,
      created_at: '2026-09-20T12:00:00.000Z',
      photos: [],
      user_id: 'guest-legacy',
      experience_id: 99,
      guest: { full_name: '기존 게스트', avatar_url: null },
      experiences: { title: '기존 체험', host_id: 'host-legacy' },
    }];
    window.fetch = async (input: RequestInfo | URL) => Response.json({
      success: true,
      data: String(input).includes('/api/admin/guest-reviews') ? guestRows : experienceRows,
    });
  }, { guestRows: fixture.map((review, index) => ({
    id: review.id,
    host_name: `호스트 ${index + 1}`,
    guest_name: `게스트 ${index + 1}`,
    experience_title: `체험 ${index + 1}`,
    booking_number: `ORDER-${index + 1}`,
    rating: review.rating,
    content: review.content,
    created_at: review.created_at,
  })) });
  await page.addScriptTag({ content: browserBundle.outputFiles[0].text });
  await page.evaluate(() => {
    (window as typeof window & { mountReviewsTab: () => void }).mountReviewsTab();
  });

  await expect(page.getByText('기존 체험 후기')).toBeVisible();
  await expect(page.getByRole('button', { name: '후기 삭제' })).toBeVisible();
  await page.getByRole('tab', { name: '게스트 평가' }).click();
  await expect(page.getByTestId('admin-guest-review-card')).toHaveCount(5);
  await expect(page.getByText('호스트 1')).toBeVisible();
  await expect(page.getByText('게스트 5')).toBeVisible();
  await expect(page.getByText('ORDER-1')).toBeVisible();
  await expect(page.getByText('게스트 평가 내용 5')).toBeVisible();
  await expect(page.getByRole('button', { name: /삭제|수정/ })).toHaveCount(0);
  await page.getByPlaceholder('호스트명, 게스트명, 체험명, 내용 검색...').fill('호스트 3');
  await expect(page.getByTestId('admin-guest-review-card')).toHaveCount(1);
  await page.getByPlaceholder('호스트명, 게스트명, 체험명, 내용 검색...').fill('');
  await page.getByRole('button', { name: '3★' }).click();
  await expect(page.getByTestId('admin-guest-review-card')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
