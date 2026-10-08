import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import ts from 'typescript';
import { expect, test } from '@playwright/test';

const DETAIL_PATH = resolve('app/community/detailData.server.ts');
const PAGE_PATH = resolve('app/community/[id]/page.tsx');
const MISSING_ID = '00000000-0000-4000-8000-000000000000';
const EXISTING_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const AUTHOR_ID = 'bb0ebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const ROUTE_MISSING_ID = randomUUID();
const ROUTE_EXISTING_ID = randomUUID();
const NOT_FOUND = new Error('NEXT_HTTP_ERROR_FALLBACK;404');

const post = {
  id: EXISTING_ID,
  user_id: AUTHOR_ID,
  category: 'qna',
  destination_hub: null,
  board_country: 'japan',
  title: 'Community fixture title',
  content: 'Community fixture article',
  images: [],
  is_anonymous: false,
  companion_date: null,
  companion_city: null,
  linked_exp_id: 42,
  view_count: 1,
  like_count: 2,
  comment_count: 3,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};
const profile = { id: AUTHOR_ID, full_name: 'Fixture author', avatar_url: null };
const experience = { id: 42, host_id: AUTHOR_ID, title: 'Fixture experience', image_url: '', price: 100 };

function executeModule(filename, resolveImport, environment = 'development') {
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', 'process', source)(
    resolveImport,
    loaded,
    loaded.exports,
    { env: { NODE_ENV: environment } },
  );
  return loaded.exports;
}

function loadDetail(environment, existing = false, postError = null) {
  const calls = { client: 0, cache: 0, cacheInvocation: 0, queries: [] };
  const client = {
    from(table) {
      const filters = {};
      const query = {
        select() { return query; },
        eq(column, value) { filters[column] = value; return query; },
        lt(column, value) { filters[`lt:${column}`] = value; return query; },
        gt(column, value) { filters[`gt:${column}`] = value; return query; },
        order() { return query; },
        limit() { return query; },
        async maybeSingle() {
          calls.queries.push({ table, filters: { ...filters } });
          if (table === 'community_posts' && filters.id) {
            return { data: existing ? post : null, error: postError };
          }
          if (table === 'community_posts' && filters['lt:created_at']) {
            return { data: { id: MISSING_ID, title: 'Previous', created_at: '2026-08-01T00:00:00Z' }, error: null };
          }
          if (table === 'community_posts' && filters['gt:created_at']) {
            return { data: { id: AUTHOR_ID, title: 'Next', created_at: '2026-10-01T00:00:00Z' }, error: null };
          }
          if (table === 'public_profiles') return { data: profile, error: null };
          if (table === 'experiences') return { data: experience, error: null };
          throw new Error(`Unexpected query: ${table}`);
        },
        then(resolvePromise) {
          calls.queries.push({ table, filters: { ...filters } });
          if (table !== 'public_host_applications') throw new Error(`Unexpected collection query: ${table}`);
          return Promise.resolve(resolvePromise({ data: [{ user_id: AUTHOR_ID, status: 'approved' }], error: null }));
        },
      };
      return query;
    },
  };
  const imports = {
    'server-only': {},
    'next/cache': {
      unstable_cache(fn) {
        calls.cache += 1;
        return async () => {
          calls.cacheInvocation += 1;
          return fn();
        };
      },
    },
    '@/app/utils/supabase/public-server': {
      createPublicServerClient() { calls.client += 1; return client; },
    },
    './feedSelect': {
      COMMUNITY_FEED_LINKED_EXPERIENCE_SELECT: 'id, host_id, title, image_url, price',
      filterVisibleCommunityLinkedExperiences: (rows) => rows,
    },
    './indexability': executeModule(resolve('app/community/indexability.ts'), () => ({ inferCommunityBoardFromLegacyHub: () => null }), environment),
    './anonymousColumn': {
      isMissingAnonymousColumnError: () => false,
      isMissingCommunityBoardColumnError: () => false,
      isMissingCommunityModelColumnError: () => false,
    },
    './boardMeta': {
      getLegacyHubSeedForBoard: () => null,
      inferCommunityBoardFromLegacyHub: () => null,
    },
  };
  const detail = executeModule(DETAIL_PATH, (name) => {
    if (!(name in imports)) throw new Error(`Unmocked detail import: ${name}`);
    return imports[name];
  }, environment);
  return { detail, calls };
}

function loadPage(detail) {
  return executeModule(PAGE_PATH, (name) => {
    if (name === '../detailData.server') return detail;
    if (name === 'next/navigation') return { notFound: () => { throw NOT_FOUND; } };
    if (name === '../queryParams') return { resolveCommunitySort: () => 'latest' };
    return {};
  });
}

test.describe('community detail UUID boundary', () => {
  for (const environment of ['development', 'production']) {
    test(`invalid IDs return missing-post data before Supabase and cache in ${environment}`, async () => {
      const { detail, calls } = loadDetail(environment);
      for (const id of [
        '.env',
        'not-a-uuid',
        '123',
        'undefined',
        ' ',
        '',
        '00000000-0000-4000-8000-00000000000z',
        '00000000-0000-4000-8000-000000000000-extra',
      ]) {
        await expect(detail.getCommunityDetailPost(id)).resolves.toEqual({
          post: null,
          profile: null,
          linkedExperience: null,
          usedPreBoardFallback: false,
        });
      }
      expect(calls).toEqual({ client: 0, cache: 0, cacheInvocation: 0, queries: [] });
    });

    test(`valid missing UUID still queries and returns missing-post data in ${environment}`, async () => {
      const { detail, calls } = loadDetail(environment);
      await expect(detail.getCommunityDetailPost(MISSING_ID)).resolves.toEqual({
        post: null,
        profile: null,
        linkedExperience: null,
        usedPreBoardFallback: false,
      });
      expect(calls.client).toBe(1);
      expect(calls.queries).toEqual([{ table: 'community_posts', filters: { id: MISSING_ID } }]);
      expect(calls.cacheInvocation).toBe(environment === 'production' ? 1 : 0);
    });

    test(`existing UUID preserves post, profile, linked experience, and adjacent data in ${environment}`, async () => {
      const { detail, calls } = loadDetail(environment, true);
      const result = await detail.getCommunityDetailPost(EXISTING_ID.toUpperCase());
      expect(result).toEqual({
        post,
        profile,
        linkedExperience: experience,
        usedPreBoardFallback: false,
      });
      expect(calls.queries[0]).toEqual({
        table: 'community_posts',
        filters: { id: EXISTING_ID.toUpperCase() },
      });
      const adjacent = await detail.getAdjacentCommunityPosts({
        post: result.post,
        requestedBoard: null,
        usedPreBoardFallback: result.usedPreBoardFallback,
        fallbackHub: 'all',
      });
      expect(adjacent).toEqual({
        boardContext: 'japan',
        prevPost: { id: MISSING_ID, title: 'Previous', created_at: '2026-08-01T00:00:00Z' },
        nextPost: { id: AUTHOR_ID, title: 'Next', created_at: '2026-10-01T00:00:00Z' },
      });
    });
  }

  test('metadata and page use the same invalid-ID guard without DB queries', async () => {
    const { detail, calls } = loadDetail('production');
    const page = loadPage(detail);
    const props = { params: Promise.resolve({ id: '.env' }), searchParams: Promise.resolve({}) };
    await expect(page.generateMetadata(props)).resolves.toEqual({ title: '게시글을 찾을 수 없습니다' });
    await expect(page.default(props)).rejects.toBe(NOT_FOUND);
    expect(calls).toEqual({ client: 0, cache: 0, cacheInvocation: 0, queries: [] });
  });

  test('real database errors for valid IDs still propagate', async () => {
    const dbError = { code: 'PGRST500', message: 'fixture database failure' };
    const { detail, calls } = loadDetail('production', false, dbError);
    await expect(detail.getCommunityDetailPost(MISSING_ID)).rejects.toBe(dbError);
    expect(calls.queries).toEqual([{ table: 'community_posts', filters: { id: MISSING_ID } }]);
  });
});

test.describe('community detail HTTP route with local PostgREST fixture', () => {
  test.describe.configure({ mode: 'serial' });
  const requests = [];
  let server;

  test.beforeAll(async () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe('http://127.0.0.1:54329');
    server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1:54329');
      requests.push(url);
      let rows = [];
      if (url.pathname.endsWith('/community_posts')) {
        if (url.searchParams.get('id') === `eq.${ROUTE_EXISTING_ID}`) {
          rows = [{ ...post, id: ROUTE_EXISTING_ID, linked_exp_id: null }];
        } else if (url.searchParams.has('created_at')) {
          rows = url.searchParams.get('created_at')?.startsWith('lt.')
            ? [{ id: MISSING_ID, title: 'Previous', created_at: '2026-08-01T00:00:00Z' }]
            : [{ id: AUTHOR_ID, title: 'Next', created_at: '2026-10-01T00:00:00Z' }];
        }
      } else if (url.pathname.endsWith('/public_profiles')) {
        rows = [profile];
      } else if (url.pathname.endsWith('/experiences')) {
        rows = [{ ...experience, status: 'active', is_active: true }];
      } else if (url.pathname.endsWith('/public_host_applications')) {
        rows = [{ id: 1, user_id: AUTHOR_ID, status: 'approved', created_at: '2026-08-01T00:00:00Z' }];
      } else {
        response.writeHead(404, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ message: 'Unexpected fixture request' }));
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(rows));
    });
    await new Promise((resolve) => server.listen(54329, '127.0.0.1', resolve));
  });

  test.afterAll(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  test.beforeEach(() => { requests.length = 0; });

  for (const path of ['/community/.env', '/community/not-a-uuid', '/community/123']) {
    test(`${path} renders not-found without a PostgREST request`, async ({ request }) => {
      const response = await request.get(path);
      const html = await response.text();
      expect([200, 404]).toContain(response.status());
      expect(html).toContain('페이지를 찾을 수 없습니다');
      expect(html).not.toContain('문제가 발생했습니다.');
      expect(html).not.toContain('22P02');
      expect(requests).toEqual([]);
      console.log(`${path}: HTTP ${response.status()}, PostgREST requests 0`);
    });
  }

  test('valid missing UUID retains the database lookup and not-found UI', async ({ request }) => {
    const response = await request.get(`/community/${ROUTE_MISSING_ID}`);
    const html = await response.text();
    expect([200, 404]).toContain(response.status());
    expect(html).toContain('페이지를 찾을 수 없습니다');
    expect(requests.some((url) =>
      url.pathname.endsWith('/community_posts') && url.searchParams.get('id') === `eq.${ROUTE_MISSING_ID}`
    )).toBe(true);
    console.log(`valid missing UUID: HTTP ${response.status()}`);
  });

  test('valid existing UUID retains metadata, article, author and adjacent links', async ({ request }) => {
    const response = await request.get(`/community/${ROUTE_EXISTING_ID}`);
    const html = await response.text();
    expect(response.status()).toBe(200);
    for (const text of ['Community fixture title', 'Community fixture article', 'Fixture author', '이전글', '다음글']) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain('문제가 발생했습니다.');
    expect(html).not.toContain('NEXT_HTTP_ERROR_FALLBACK');
    expect(requests.some((url) =>
      url.pathname.endsWith('/community_posts') && url.searchParams.get('id') === `eq.${ROUTE_EXISTING_ID}`
    )).toBe(true);
  });
});
