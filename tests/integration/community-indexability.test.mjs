import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { createClient } from '@supabase/supabase-js';
import { renderToStaticMarkup } from 'react-dom/server';

// Real SQL, SDK and route code. No provider credentials, writes or network targets.
const workerRuntime = process.env.COMMUNITY_SEO_RUNTIME === 'opennext';
const db = new PGlite();
await db.exec('CREATE ROLE community_fixture_anon;');
const publicKey = 'local-community-public-fixture';
const adminKey = 'local-community-admin-fixture';
const authorId = 'f0000000-0000-4000-8000-000000000001';
const ids = Object.fromEntries(['board', 'anonymous', 'legacy', 'content', 'private', 'anonymousContent', 'invalidBoard', 'companion', 'info']
  .map((name, i) => [name, `a0000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`]));
const variants = ['', '?board=japan', '?board=korea', '?board=invalid&hub=seoul&sort=popular', '?board=japan&board=korea'];
let requests = [];
let fault = null;

const server = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    assert.equal(req.method, 'GET');
    const url = new URL(req.url, 'http://127.0.0.1');
    const table = url.pathname.replace('/rest/v1/', '');
    assert(['community_posts', 'public_profiles', 'experiences', 'public_host_applications'].includes(table));
    const columns = url.searchParams.get('select');
    assert.match(columns, /^[a-z_, ]+$/);
    const key = req.headers.apikey;
    assert([publicKey, adminKey, 'sb_publishable_cloudflare_foundation_fixture', 'sb_secret_cloudflare_foundation_fixture'].includes(key));
    const isPublic = key === publicKey || key === 'sb_publishable_cloudflare_foundation_fixture';
    requests.push({ table, columns, key, isPublic });
    if (fault && table === 'community_posts') {
      res.writeHead(400);
      res.end(JSON.stringify(fault));
      return;
    }
    const predicates = [];
    const values = [];
    for (const [column, filter] of url.searchParams) {
      if (['select', 'order', 'limit', 'offset'].includes(column)) continue;
      assert.match(column, /^[a-z_]+$/);
      const match = /^(eq|lt|gt)\.(.*)$/.exec(filter);
      assert(match, filter);
      values.push(match[2]);
      predicates.push(`${column} ${{ eq: '=', lt: '<', gt: '>' }[match[1]]} $${values.length}`);
    }
    const where = predicates.length ? ` WHERE ${predicates.join(' AND ')}` : '';
    const order = url.searchParams.get('order');
    const orderSql = order ? ' ORDER BY ' + order.split(',').map((part) => {
      assert.match(part, /^[a-z_]+\.(asc|desc)$/);
      return part.replace('.', ' ');
    }).join(', ') : '';
    const offset = Number(url.searchParams.get('offset') || 0);
    const limit = Math.min(Number(url.searchParams.get('limit') || 1000), 2);
    const result = await db.transaction(async (tx) => {
      if (isPublic) await tx.exec('SET LOCAL ROLE community_fixture_anon;');
      const rows = (await tx.query(`SELECT ${columns} FROM ${table}${where}${orderSql} OFFSET ${offset} LIMIT ${limit}`, values)).rows;
      const count = Number((await tx.query(`SELECT count(*) AS count FROM ${table}${where}`, values)).rows[0].count);
      return { rows, count };
    });
    res.setHeader('Content-Range', `${offset}-${offset + Math.max(result.rows.length - 1, 0)}/${result.count}`);
    res.writeHead(200);
    res.end(JSON.stringify(result.rows));
  } catch (error) {
    res.writeHead(400);
    res.end(JSON.stringify({ code: error.code || 'FIXTURE_ERROR', message: error.message }));
  }
});
await new Promise((resolve, reject) => server.listen(workerRuntime ? 54329 : 0, '127.0.0.1', resolve).once('error', reject));
const origin = `http://127.0.0.1:${server.address().port}`;
globalThis.__communityPublicClient = createClient(origin, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
globalThis.__communityAdminClient = createClient(origin, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
await mkdir('.tmp', { recursive: true });
const dir = await mkdtemp(path.resolve('.tmp/community-indexability-'));
const plugin = { name: 'isolated-community-inputs', setup(builder) {
  builder.onResolve({ filter: /^server-only$/ }, () => ({ path: 'empty', namespace: 'fixture' }));
  builder.onResolve({ filter: /^next\/cache$/ }, () => ({ path: 'cache', namespace: 'fixture' }));
  builder.onResolve({ filter: /utils\/supabase\/(admin|public-server)$/ }, ({ path: module }) => ({ path: module.endsWith('/admin') ? 'admin' : 'public', namespace: 'fixture' }));
  builder.onResolve({ filter: /components\/(LinkedExperienceChip|PostImages|CommunityCommentsPanel|BackButton|ShareButton|SiteHeader|CommunityAuthorTrigger)$/ }, () => ({ path: 'ui', namespace: 'fixture' }));
  builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'ui', namespace: 'fixture' }));
  builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: kind }) => ({
    contents: kind === 'cache' ? 'export const unstable_cache = fn => fn;'
      : kind === 'public' ? 'export const createPublicServerClient=()=>globalThis.__communityPublicClient;'
        : kind === 'admin' ? 'export const createAdminClient=()=>globalThis.__communityAdminClient;'
          : kind === 'ui' ? 'export default function Component(){return null;}' : '', loader: 'js',
  }));
} };
for (const [name, entry] of [['page', 'app/community/[id]/page.tsx'], ['detail', 'app/community/detailData.server.ts'], ['sitemap', 'app/sitemap.ts'], ['policy', 'app/community/indexability.ts']]) {
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs',
    outfile: path.join(dir, `${name}.cjs`), external: ['react', 'react-dom', 'react/jsx-runtime', 'next/navigation'], plugins: [plugin] });
}
const require = createRequire(import.meta.url);
const page = require(path.join(dir, 'page.cjs'));
const detail = require(path.join(dir, 'detail.cjs'));
const sitemap = require(path.join(dir, 'sitemap.cjs')).default;
const policy = require(path.join(dir, 'policy.cjs'));
const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
process.env.NEXT_PUBLIC_SITE_URL = 'https://www.locally-travel.com';

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.close();
  await rm(dir, { recursive: true, force: true });
  delete globalThis.__communityPublicClient;
  delete globalThis.__communityAdminClient;
  if (previousSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl;
});

async function seed(missing = []) {
  requests = [];
  fault = null;
  await db.exec(`
    DROP TABLE IF EXISTS community_posts, public_profiles, experiences, public_host_applications;
    CREATE TABLE community_posts (id uuid PRIMARY KEY, user_id uuid, category text, destination_hub text,
      board_country text, is_anonymous boolean, title text, content text, images text[], companion_date date,
      companion_city text, linked_exp_id bigint, view_count integer, like_count integer, comment_count integer,
      created_at timestamptz, updated_at timestamptz);
    CREATE TABLE public_profiles (id uuid PRIMARY KEY, full_name text, avatar_url text);
    CREATE TABLE experiences (id bigint PRIMARY KEY, host_id uuid, status text, is_active boolean);
    CREATE TABLE public_host_applications (id text PRIMARY KEY, user_id uuid, status text, created_at timestamptz);
    INSERT INTO public_profiles VALUES ('${authorId}', 'PRIVATE_AUTHOR_MARKER', 'https://example.test/PRIVATE_AVATAR_MARKER.png');
    ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
    CREATE POLICY public_fixture_posts ON community_posts FOR SELECT TO community_fixture_anon USING (id <> '${ids.private}');
    GRANT SELECT ON community_posts, public_profiles, experiences, public_host_applications TO community_fixture_anon;
  `);
  const rows = [
    [ids.board, 'qna', 'tokyo', 'japan', false],
    [ids.anonymous, 'qna', 'seoul', 'korea', true],
    [ids.legacy, 'qna', null, null, false],
    [ids.content, 'locally_content', null, null, false],
    [ids.private, 'locally_content', null, null, false],
    [ids.anonymousContent, 'locally_content', null, null, true],
    [ids.invalidBoard, 'qna', null, 'invalid', false],
    [ids.companion, 'companion', null, 'japan', false],
    [ids.info, 'info', null, 'japan', false],
  ];
  for (const [id, category, hub, board, anonymous] of rows) {
    await db.query(`INSERT INTO community_posts (id, user_id, category, destination_hub, board_country,
      is_anonymous, title, content, images, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'{}','2026-09-01','2026-09-02')`,
    [id, authorId, category, hub, board, anonymous, `Synthetic ${id}`, 'Synthetic local content']);
  }
  // A legacy schema cannot store anonymous flags; only nonanonymous fixtures are retained.
  // Unknown anonymity on ordinary posts must nevertheless remain noindex.
  if (missing.includes('is_anonymous')) await db.query('DELETE FROM community_posts WHERE is_anonymous = true;');
  for (const column of missing) {
    assert(['board_country', 'destination_hub', 'is_anonymous'].includes(column));
    await db.exec(`ALTER TABLE community_posts DROP COLUMN ${column};`);
  }
}

function props(id, query = '') {
  const search = {};
  for (const [key, value] of new URLSearchParams(query)) {
    search[key] = search[key] === undefined ? value : [search[key], value].flat();
  }
  return { params: Promise.resolve({ id }), searchParams: Promise.resolve(search) };
}

function expectedIds(missing) {
  return [ids.content, ...(!missing.includes('is_anonymous') && (!missing.includes('board_country') || !missing.includes('destination_hub')) ? [ids.board] : [])].sort();
}

for (const missing of [[], ['board_country'], ['is_anonymous'], ['destination_hub'], ['board_country', 'is_anonymous'], ['board_country', 'destination_hub'], ['destination_hub', 'is_anonymous'], ['board_country', 'destination_hub', 'is_anonymous']]) {
  test(`real SQL/SDK detail and sitemap agree with missing columns: ${missing.join(',') || 'modern'}`, async () => {
    await seed(missing);
    const entries = await sitemap();
    const sitemapIds = entries.filter((e) => e.url.includes('/community/')).map((e) => e.url.split('/').at(-1)).sort();
    assert.deepEqual(sitemapIds, expectedIds(missing));
    assert.equal(entries.filter((e) => !e.url.includes('/community/')).length, 15);
    for (const [name, id] of Object.entries(ids)) {
      if (missing.includes('is_anonymous') && ['anonymous', 'anonymousContent'].includes(name)) continue;
      const result = await detail.getCommunityDetailPost(id);
      if (name === 'private') {
        assert.equal(result.post, null, 'The same anonymous RLS excludes private rows from the detail and sitemap');
        continue;
      }
      const indexable = sitemapIds.includes(id);
      const baseline = await page.generateMetadata(props(id));
      assert.equal(baseline.robots?.index !== false, indexable);
      assert.equal(result.post.is_anonymous, missing.includes('is_anonymous') ? null : ['anonymous', 'anonymousContent'].includes(name));
      if (name === 'board') {
        assert.equal(result.post.destination_hub, missing.includes('destination_hub') ? null : 'tokyo');
        assert.equal(result.post.board_country, missing.includes('board_country') && missing.includes('destination_hub') ? null : 'japan');
      }
      for (const query of variants) {
        const metadata = await page.generateMetadata(props(id, query));
        assert.deepEqual(metadata, baseline, `${name}: query cannot change any metadata`);
        assert.equal(metadata.alternates.canonical, `https://www.locally-travel.com/community/${id}`);
        const html = renderToStaticMarkup(await page.default(props(id, query)));
        assert.equal(html.includes('"@type":"Article"'), indexable, `${name}: Article matches robots/sitemap`);
        if (result.post.is_anonymous === true) {
          assert.equal(result.profile, null);
          assert(!html.includes('PRIVATE_AUTHOR_MARKER'));
          assert(!html.includes('PRIVATE_AVATAR_MARKER'));
          assert(!html.includes(authorId));
        }
      }
    }
    assert(requests.filter((r) => r.table === 'community_posts').every((r) => r.isPublic), 'Sitemap and detail both honor anonymous RLS');
  });
}

test('permission/query errors mentioning compatibility fields cannot trigger a fallback or publish partial success', async () => {
  await seed();
  for (const code of ['42501', 'XX000']) {
    fault = { code, message: 'SENSITIVE destination_hub is_anonymous board_country column failure' };
    requests = [];
    await assert.rejects(detail.getCommunityDetailPost(ids.board), (e) => e.code === code);
    assert.equal(requests.filter((r) => r.table === 'community_posts').length, 1);
    const original = console.error;
    const logs = [];
    console.error = (...args) => logs.push(args);
    try { await assert.rejects(sitemap(), (e) => e.source === 'community_posts' && e.code === code); }
    finally { console.error = original; }
    assert(!JSON.stringify(logs).includes('SENSITIVE'));
  }
});

test('required columns fail visibly and unknown or nonpublic categories cannot be indexed', async () => {
  await seed();
  await db.exec('ALTER TABLE community_posts DROP COLUMN category;');
  await assert.rejects(detail.getCommunityDetailPost(ids.board), (e) => e.code === '42703');
  await assert.rejects(sitemap(), (e) => e.source === 'community_posts' && e.code === '42703');
  for (const category of ['qna', 'info', 'companion', 'private', 'unknown']) {
    assert.equal(policy.isCommunityPostIndexable({ category, board_country: null, is_anonymous: false }), false);
    assert.equal(policy.isCommunityPostIndexable({ category, board_country: 'japan', is_anonymous: null }), false);
  }
  assert.equal(policy.isCommunityPostIndexable({ category: 'locally_content', is_anonymous: true }), false);
  assert.equal(policy.isCommunityPostIndexable(policy.normalizeCommunityPost({ category: 'qna', board_country: 'invalid', destination_hub: 'tokyo', is_anonymous: false })), false);
});

for (const missing of [[], ['board_country', 'is_anonymous']]) {
  test(`real ${workerRuntime ? 'OpenNext workerd' : 'Next'} HTTP: ${missing.length ? 'Production-shaped legacy' : 'modern'} metadata, Article, privacy and sitemap`, { timeout: 150_000 }, async () => {
    assert(!existsSync('.env.local'), 'Run in an isolated checkout without provider credentials');
    await seed(missing);
    // Independent schema fixtures must not reuse a preceding Next dev dataset.
    if (!workerRuntime) await rm('.next/dev/cache', { recursive: true, force: true });
    const portServer = createServer();
    await new Promise((resolve) => portServer.listen(0, '127.0.0.1', resolve));
    const port = portServer.address().port;
    await new Promise((resolve) => portServer.close(resolve));
    let output = '';
    const command = workerRuntime ? ['node_modules/wrangler/bin/wrangler.js', 'dev', '--config', 'wrangler.jsonc',
      '--env', 'production', '--local', '--persist-to', path.join(dir, `state-${missing.length}`), '--ip', '127.0.0.1', '--port', String(port),
      '--var', 'NEXT_PUBLIC_SITE_URL:https://www.locally-travel.com', '--var', `NEXT_PUBLIC_SUPABASE_URL:${origin}`,
      '--var', `NEXT_PUBLIC_SUPABASE_ANON_KEY:${publicKey}`, '--var', `SUPABASE_SERVICE_ROLE_KEY:${adminKey}`]
      : ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)];
    const child = spawn(process.execPath, command, { env: { ...process.env, NODE_ENV: 'development',
      NEXT_TELEMETRY_DISABLED: '1', WRANGLER_SEND_METRICS: 'false', NEXT_PUBLIC_SUPABASE_URL: origin,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: publicKey, SUPABASE_SERVICE_ROLE_KEY: adminKey, NEXT_PUBLIC_SITE_URL: 'https://www.locally-travel.com' },
    stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (data) => { output += data; });
    child.stderr.on('data', (data) => { output += data; });
    try {
      const started = Date.now();
      while (!output.includes(workerRuntime ? 'Ready on' : 'Ready in')) {
        assert.equal(child.exitCode, null, output.slice(-4000));
        assert(Date.now() - started < 40_000, output.slice(-4000));
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const base = `http://127.0.0.1:${port}`;
      fault = { code: 'XX000', message: 'SENSITIVE_COMMUNITY_QUERY_DETAIL' };
      const failedSitemap = await fetch(`${base}/sitemap.xml`);
      assert.equal(failedSitemap.status, 500, output.slice(-4000));
      assert(!(await failedSitemap.text()).includes('<urlset'));
      fault = null;
      const sitemapResponse = await fetch(`${base}/sitemap.xml`);
      assert.equal(sitemapResponse.status, 200, output.slice(-4000));
      const xml = await sitemapResponse.text();
      const sitemapIds = [...xml.matchAll(/<loc>https:\/\/www\.locally-travel\.com\/community\/([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
      assert.deepEqual(sitemapIds, expectedIds(missing));
      assert(!xml.includes(ids.private));
      for (const name of ['board', 'legacy', 'content', ...(missing.length ? [] : ['anonymous'])]) {
        const id = ids[name];
        let baseline;
        for (const query of variants) {
          const response = await fetch(`${base}/community/${id}${query}`, { headers: { 'User-Agent': 'Googlebot' } });
          assert.equal(response.status, 200, output.slice(-4000));
          const html = await response.text();
          assert(!html.includes('문제가 발생했습니다.'));
          const snapshot = {
            robots: /<meta[^>]+name="robots"[^>]+content="([^"]*)/i.exec(html)?.[1] ?? '',
            canonical: /<link[^>]+rel="canonical"[^>]+href="([^"]*)/i.exec(html)?.[1],
            article: /"@type"\s*:\s*"Article"/.test(html),
            title: /<title>([^<]*)<\/title>/.exec(html)?.[1],
          };
          assert.equal(snapshot.canonical, `https://www.locally-travel.com/community/${id}`);
          assert.equal(!snapshot.robots.includes('noindex'), sitemapIds.includes(id));
          assert.equal(snapshot.article, sitemapIds.includes(id));
          if (baseline) assert.deepEqual(snapshot, baseline, `${name} query invariant`);
          baseline = snapshot;
          if (name === 'anonymous') {
            for (const privateValue of [authorId, 'PRIVATE_AUTHOR_MARKER', 'PRIVATE_AVATAR_MARKER']) assert(!html.includes(privateValue));
          }
        }
      }
      const privateResponse = await fetch(`${base}/community/${ids.private}?board=japan`, { headers: { 'User-Agent': 'Googlebot' } });
      // Next's streamed notFound() may retain HTTP 200, but must emit noindex and no data.
      assert([200, 404].includes(privateResponse.status));
      const privateHtml = await privateResponse.text();
      assert(privateHtml.includes('페이지를 찾을 수 없습니다'));
      assert(/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/.test(privateHtml));
      assert(!privateHtml.includes(`Synthetic ${ids.private}`));
      assert(!privateHtml.includes('PRIVATE_AUTHOR_MARKER'));
      assert(!privateHtml.includes('"@type":"Article"'));
      assert(requests.filter((r) => r.table === 'community_posts').every((r) => r.isPublic));
      assert(output.includes('[Sitemap] Generation failed'));
      assert(!output.includes('SENSITIVE_COMMUNITY_QUERY_DETAIL'));
      console.log(`${workerRuntime ? 'workerd' : 'Next'} ${missing.length ? 'legacy' : 'modern'}: bare + 4 query variants, canonical/robots/Article/sitemap/privacy PASS`);
    } finally {
      child.kill('SIGTERM');
      if (child.exitCode === null) await new Promise((resolve) => child.once('exit', resolve));
    }
  });
}
