import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { createClient } from '@supabase/supabase-js';

// All data and SQL are local synthetic fixtures; never load .env or contact a provider.
const db = new PGlite();
const workerRuntime = process.env.SITEMAP_RUNTIME === 'opennext';
await db.exec(`
  CREATE TABLE experiences (id bigint PRIMARY KEY, host_id text, status text, is_active boolean);
  CREATE TABLE public_host_applications (id text PRIMARY KEY, user_id text, status text, created_at timestamptz);
  CREATE TABLE community_posts (id text PRIMARY KEY, category text, destination_hub text, created_at timestamptz, updated_at timestamptz);
`);
let requests = [];
let fault = {};
const server = createServer(async (req, res) => {
  try {
    assert.equal(req.method, 'GET');
    const url = new URL(req.url, 'http://127.0.0.1');
    const table = url.pathname.replace('/rest/v1/', '');
    assert(['experiences', 'public_host_applications', 'community_posts'].includes(table));
    const columns = url.searchParams.get('select');
    assert.match(columns, /^[a-z_, ]+$/);
    const offset = Number(url.searchParams.get('offset') || 0);
    const limit = Math.min(Number(url.searchParams.get('limit') || 1000), fault.cap ?? 1000);
    const order = url.searchParams.get('order');
    const orderSql = order.split(',').map((part) => {
      const [column, direction] = part.split('.');
      assert(['id', 'created_at'].includes(column));
      assert(['asc', 'desc'].includes(direction));
      return `${column} ${direction}`;
    }).join(', ');
    requests.push({ table, columns, offset, limit, order, prefer: req.headers.prefer });
    res.setHeader('Content-Type', 'application/json');
    if (fault.table === table && offset >= (fault.offset ?? 0)) {
      res.writeHead(500);
      res.end(JSON.stringify({ code: 'XX000', message: 'SENSITIVE_DATABASE_DETAIL' }));
      return;
    }
    const where = table === 'experiences' ? " WHERE status = 'active'" : '';
    if (table === 'experiences') assert.equal(url.searchParams.get('status'), 'eq.active');
    const rows = (await db.query(`SELECT ${columns} FROM ${table}${where} ORDER BY ${orderSql} OFFSET $1 LIMIT $2`, [offset, limit])).rows;
    let count = Number((await db.query(`SELECT count(*) AS count FROM ${table}${where}`)).rows[0].count);
    if (fault.countChanged && offset) count += 1;
    if (fault.duplicate && offset && rows.length) rows[0].id = fault.duplicate;
    const output = fault.emptyPage && offset ? [] : rows;
    res.setHeader('Content-Range', `${offset}-${offset + Math.max(output.length - 1, 0)}/${fault.noCount ? '*' : count}`);
    res.writeHead(200);
    res.end(JSON.stringify(output));
  } catch (error) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: error.code || 'FIXTURE_ERROR', message: error.message }));
  }
});
await new Promise((resolve, reject) => server.listen(workerRuntime ? 54329 : 0, '127.0.0.1', resolve).once('error', reject));
const origin = `http://127.0.0.1:${server.address().port}`;
globalThis.__sitemapRecoveryClient = createClient(origin, 'local-sitemap-fixture-key', {
  auth: { persistSession: false, autoRefreshToken: false },
});
await mkdir('.tmp', { recursive: true });
const dir = await mkdtemp(path.resolve('.tmp/sitemap-recovery-'));
await build({
  entryPoints: ['app/sitemap.ts'], bundle: true, platform: 'node', format: 'cjs',
  outfile: path.join(dir, 'sitemap.cjs'),
  plugins: [{ name: 'local-only-admin-client', setup(builder) {
    builder.onResolve({ filter: /^next\/cache$/ }, () => ({ path: 'cache', namespace: 'fixture' }));
    builder.onResolve({ filter: /utils\/supabase\/admin$/ }, () => ({ path: 'fixture', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: kind }) => ({
      // Test each generation independently. The Next HTTP test exercises the real cache.
      contents: kind === 'cache' ? 'export const unstable_cache = fn => fn;'
        : 'export const createAdminClient = () => globalThis.__sitemapRecoveryClient;', loader: 'js',
    }));
  } }],
});
await build({
  entryPoints: ['app/experiences/[id]/page.tsx'], bundle: true, platform: 'node', format: 'cjs',
  outfile: path.join(dir, 'metadata.cjs'), external: ['next/*', 'react'],
  plugins: [{ name: 'public-metadata-inputs', setup(builder) {
    builder.onResolve({ filter: /^server-only$/ }, () => ({ path: 'ui', namespace: 'metadata-fixture' }));
    builder.onResolve({ filter: /publicDetailData\.server$/ }, () => ({ path: 'snapshot', namespace: 'metadata-fixture' }));
    builder.onResolve({ filter: /utils\/locale$/ }, () => ({ path: 'locale', namespace: 'metadata-fixture' }));
    builder.onResolve({ filter: /ExperienceClient$|components\/seo\/JsonLd$/ }, () => ({ path: 'ui', namespace: 'metadata-fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'metadata-fixture' }, ({ path: kind }) => ({
      contents: kind === 'snapshot'
        ? 'export const EXPERIENCE_DETAIL_SELECT=""; export const getPublicExperienceDetail=async()=>globalThis.__sitemapMetadataSnapshot;'
        : kind === 'locale' ? 'export const getCurrentLocale=async()=>globalThis.__sitemapMetadataLocale;'
          : 'export default function Component(){return null;}',
      loader: 'js',
    }));
  } }],
});
const require = createRequire(import.meta.url);
const sitemap = require(path.join(dir, 'sitemap.cjs')).default;
const { generateMetadata } = require(path.join(dir, 'metadata.cjs'));
const { resolveRouteData } = require('next/dist/build/webpack/loaders/metadata/resolve-route-data.js');
const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
process.env.NEXT_PUBLIC_SITE_URL = 'https://www.locally-travel.com';

beforeEach(async () => {
  requests = [];
  fault = {};
  await db.exec('TRUNCATE experiences, public_host_applications, community_posts;');
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.close();
  await rm(dir, { recursive: true, force: true });
  delete globalThis.__sitemapRecoveryClient;
  delete globalThis.__sitemapMetadataSnapshot;
  delete globalThis.__sitemapMetadataLocale;
  if (previousSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl;
});

async function seed() {
  await db.exec(`
    INSERT INTO public_host_applications VALUES
      ('a-old', 'host-a', 'approved', '2026-01-01'),
      ('a-new', 'host-a', 'revision', '2026-02-01'),
      ('b', 'host-b', 'approved', '2026-02-01'),
      ('c', 'host-c', 'active', '2026-02-01'),
      ('d', 'host-d', 'pending', '2026-02-01'),
      ('e-1', 'host-e', 'approved', '2026-02-01'),
      ('e-2', 'host-e', 'rejected', '2026-02-01');
    INSERT INTO experiences VALUES
      (1, 'host-b', 'active', true), (2, 'host-c', 'active', null),
      (3, 'host-b', 'active', false), (4, 'host-b', 'draft', true),
      (5, 'host-a', 'active', true), (6, 'host-d', 'active', true),
      (7, NULL, 'active', true), (8, 'missing-host', 'active', true),
      (9, 'host-e', 'active', true);
    INSERT INTO community_posts VALUES
      ('japan', 'qna', 'tokyo', '2026-02-01', '2026-02-02'),
      ('korea', 'qna', 'seoul', '2026-02-01', NULL),
      ('content', 'locally_content', NULL, '2026-02-01', '2026-02-03'),
      ('legacy-qna', 'qna', NULL, '2026-02-01', NULL);
  `);
}

test('actual sitemap restores only active experiences with the latest approved/active host', async () => {
  await seed();
  const entries = await sitemap();
  assert.deepEqual(entries.filter((e) => e.url.includes('/experiences/')).map((e) => e.url), [
    'https://www.locally-travel.com/experiences/1', 'https://www.locally-travel.com/experiences/2',
  ]);
  for (const entry of entries.filter((e) => e.url.includes('/experiences/'))) {
    assert(!Object.hasOwn(entry, 'lastModified'));
  }
  for (const request of requests.filter((r) => r.table === 'experiences')) {
    assert.equal(request.columns, 'id,host_id,status,is_active');
    assert.equal(request.order, 'id.asc');
    assert.equal(request.prefer, 'count=exact');
  }
  // The fixture schema intentionally has no updated_at; this reproduces the original root cause.
  await assert.rejects(db.query('SELECT updated_at FROM experiences'), (e) => e.code === '42703');
});

test('static/community/host membership, legacy-board fallback and existing dates remain intact', async () => {
  await seed();
  const entries = await sitemap();
  assert.equal(entries.filter((e) => !/\/(experiences|community|users)\//.test(e.url)).length, 15);
  for (const url of ['/search', '/community', '/services/intro', '/site-map', '/privacy']) {
    assert(entries.some((e) => e.url === `https://www.locally-travel.com${url}`));
  }
  assert.deepEqual(entries.filter((e) => e.url.includes('/community/')).map((e) => e.url).sort(),
    ['content', 'japan', 'korea'].map((id) => `https://www.locally-travel.com/community/${id}`));
  assert.deepEqual(entries.filter((e) => e.url.includes('/users/')).map((e) => e.url).sort(),
    ['host-b', 'host-c'].map((id) => `https://www.locally-travel.com/users/${id}`));
  assert.equal(entries.find((e) => e.url.endsWith('/community/content')).lastModified.toISOString(), '2026-02-03T00:00:00.000Z');
  assert.equal(entries.find((e) => e.url.endsWith('/users/host-b')).lastModified.toISOString(), '2026-02-01T00:00:00.000Z');
  const xml = resolveRouteData(entries, 'sitemap');
  assert(xml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'));
  assert(xml.includes('<loc>https://www.locally-travel.com/experiences/1</loc>'));
  assert(!xml.match(/<url>\s*<loc>[^<]*\/experiences\/[^<]*<\/loc>\s*<lastmod>/));
  assert(!xml.includes('undefined'));
});

test('a genuinely empty database still returns the 15 static URLs successfully', async () => {
  assert.equal((await sitemap()).length, 15);
});

test('existing real experience metadata preserves self canonical and all four hreflang targets', async () => {
  globalThis.__sitemapMetadataSnapshot = {
    experience: { id: '4659', host_id: 'host-b', status: 'active', is_active: true, photos: [],
      title: 'Public tour', description: 'Public description', image_url: null },
    publicHostApplication: { status: 'approved' },
  };
  const languages = Object.fromEntries(['ko', 'en', 'ja', 'zh'].map((locale) => [locale,
    `https://www.locally-travel.com${locale === 'ko' ? '' : `/${locale}`}/experiences/4659`]));
  for (const locale of ['ko', 'en', 'ja', 'zh']) {
    globalThis.__sitemapMetadataLocale = locale;
    const metadata = await generateMetadata({ params: Promise.resolve({ id: '4659' }) });
    assert.equal(metadata.alternates.canonical, languages[locale]);
    assert.deepEqual(metadata.alternates.languages, languages);
    assert.equal(metadata.robots, undefined);
  }
  globalThis.__sitemapMetadataSnapshot.experience.is_active = false;
  assert.equal((await generateMetadata({ params: Promise.resolve({ id: '4659' }) })).robots.index, false);
  globalThis.__sitemapMetadataSnapshot.experience.is_active = true;
  globalThis.__sitemapMetadataSnapshot.publicHostApplication.status = 'pending';
  assert.equal((await generateMetadata({ params: Promise.resolve({ id: '4659' }) })).robots.index, false);
});

test('more than 1000 rows and a lower server cap do not truncate any dynamic source', async () => {
  fault.cap = 125;
  await db.exec(`
    INSERT INTO public_host_applications SELECT 'host-' || g, 'user-' || g, 'approved', '2026-02-01' FROM generate_series(1, 1050) g;
    INSERT INTO experiences SELECT g, 'user-' || g, 'active', true FROM generate_series(1, 1025) g;
    INSERT INTO community_posts SELECT 'post-' || g, 'locally_content', NULL, '2026-02-01', NULL FROM generate_series(1, 1010) g;
  `);
  const entries = await sitemap();
  assert.equal(entries.filter((e) => e.url.includes('/experiences/')).length, 1025);
  assert.equal(entries.filter((e) => e.url.includes('/community/')).length, 1010);
  assert.equal(entries.filter((e) => e.url.includes('/users/')).length, 1050);
  assert(entries.some((e) => e.url.endsWith('/experiences/1025')));
  for (const table of ['experiences', 'public_host_applications', 'community_posts']) {
    assert(requests.some((r) => r.table === table && r.offset === 125));
    assert(requests.some((r) => r.table === table && r.offset >= 1000));
  }
});

for (const table of ['experiences', 'community_posts', 'public_host_applications']) {
  test(`${table} failure cannot return a partial successful sitemap and logs no DB details`, async () => {
    await seed();
    fault.table = table;
    const logs = [];
    const original = console.error;
    console.error = (...args) => logs.push(args);
    try {
      await assert.rejects(sitemap(), (error) => error.source === table && error.code === 'XX000'
        && !String(error).includes('SENSITIVE_DATABASE_DETAIL'));
      assert.deepEqual(logs, [['[Sitemap] Generation failed', { source: table, code: 'XX000' }]]);
    } finally { console.error = original; }
  });
}

test('a missing selected column produces an observable failure instead of static-only XML', async () => {
  await seed();
  await db.exec('ALTER TABLE experiences RENAME COLUMN is_active TO temporarily_missing;');
  try {
    await assert.rejects(sitemap(), (e) => e.source === 'experiences' && e.code === '42703');
  } finally { await db.exec('ALTER TABLE experiences RENAME COLUMN temporarily_missing TO is_active;'); }
});

test('community fallback errors are not swallowed', async () => {
  await seed();
  await db.exec('ALTER TABLE community_posts RENAME COLUMN destination_hub TO temporarily_missing;');
  try {
    await assert.rejects(sitemap(), (e) => e.source === 'community_posts' && e.code === '42703');
  } finally { await db.exec('ALTER TABLE community_posts RENAME COLUMN temporarily_missing TO destination_hub;'); }
});

test('a failed later page cannot publish earlier pages', async () => {
  await seed();
  fault.cap = 1;
  fault.table = 'experiences';
  fault.offset = 1;
  await assert.rejects(sitemap(), (e) => e.source === 'experiences' && e.code === 'XX000');
});

for (const [setting, code] of [['noCount', 'INCOMPLETE_RESPONSE'], ['emptyPage', 'INCOMPLETE_PAGE'], ['countChanged', 'COUNT_CHANGED']]) {
  test(`${setting} fails visibly instead of trusting a short/inconsistent response`, async () => {
    await seed();
    fault.cap = 1;
    fault[setting] = true;
    await assert.rejects(sitemap(), (e) => e.code === code);
  });
}

test('repeated IDs across pages fail instead of generating duplicate or missing URLs', async () => {
  await seed();
  fault.cap = 1;
  fault.duplicate = 1;
  await assert.rejects(sitemap(), (e) => e.code === 'INVALID_PAGE');
});

test(`real ${workerRuntime ? 'OpenNext Worker' : 'Next'} HTTP route returns 500 on failure, valid complete XML on retry and caches only success`, { timeout: 90_000 }, async () => {
  assert(!existsSync('.env.local'), 'Use an isolated worktree without provider credentials');
  await seed();
  const portServer = createServer();
  await new Promise((resolve) => portServer.listen(0, '127.0.0.1', resolve));
  const port = portServer.address().port;
  await new Promise((resolve) => portServer.close(resolve));
  let output = '';
  const command = workerRuntime ? ['node_modules/wrangler/bin/wrangler.js', 'dev', '--config', 'wrangler.jsonc',
    '--env', 'production', '--local', '--persist-to', path.join(dir, 'workerd-state'),
    '--ip', '127.0.0.1', '--port', String(port),
    '--var', 'NEXT_PUBLIC_SITE_URL:https://www.locally-travel.com',
    '--var', `NEXT_PUBLIC_SUPABASE_URL:${origin}`,
    '--var', 'NEXT_PUBLIC_SUPABASE_ANON_KEY:local-sitemap-fixture-key',
    '--var', 'SUPABASE_SERVICE_ROLE_KEY:local-sitemap-fixture-key']
    : ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)];
  const child = spawn(process.execPath, command, {
    env: { ...process.env, NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1',
      WRANGLER_SEND_METRICS: 'false',
      NEXT_PUBLIC_SUPABASE_URL: origin, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-sitemap-fixture-key',
      SUPABASE_SERVICE_ROLE_KEY: 'local-sitemap-fixture-key', NEXT_PUBLIC_SITE_URL: 'https://www.locally-travel.com' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (data) => { output += data; });
  child.stderr.on('data', (data) => { output += data; });
  try {
    const started = Date.now();
    while (!output.includes(workerRuntime ? 'Ready on' : 'Ready in')) {
      assert.equal(child.exitCode, null, output.slice(-3000));
      assert(Date.now() - started < 40_000, output.slice(-3000));
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    fault.table = 'experiences';
    const failed = await fetch(`http://127.0.0.1:${port}/sitemap.xml`);
    assert.equal(failed.status, 500, output.slice(-3000));
    fault = {};
    const healthy = await fetch(`http://127.0.0.1:${port}/sitemap.xml`);
    assert.equal(healthy.status, 200, output.slice(-3000));
    assert.match(healthy.headers.get('content-type'), /xml/);
    const xml = await healthy.text();
    const parsed = spawnSync('python3', ['-c',
      'import sys,xml.etree.ElementTree as ET; from urllib.parse import urlparse; r=ET.fromstring(sys.stdin.read()); assert r.tag=="{http://www.sitemaps.org/schemas/sitemap/0.9}urlset"; urls=[n.text for n in r.findall("{*}url/{*}loc")]; assert len(urls)==22; assert all(urlparse(u).scheme=="https" and urlparse(u).netloc=="www.locally-travel.com" for u in urls)'],
    { input: xml, encoding: 'utf8' });
    assert.equal(parsed.status, 0, parsed.stderr);
    assert.equal((xml.match(/<url>/g) || []).length, 22);
    assert(xml.includes('<loc>https://www.locally-travel.com/experiences/1</loc>'));
    assert(!xml.includes('/experiences/3</loc>'));
    assert(!xml.includes('/users/host-a</loc>'));
    const previousRequests = requests.length;
    fault.table = 'experiences';
    const cached = await fetch(`http://127.0.0.1:${port}/sitemap.xml`);
    assert.equal(cached.status, 200);
    assert.equal(await cached.text(), xml);
    assert.equal(requests.length, previousRequests, 'Successful complete data is reused without another DB request');
    assert(output.includes('[Sitemap] Generation failed'));
    assert(!output.includes('SENSITIVE_DATABASE_DETAIL'));
  } finally {
    child.kill('SIGTERM');
    if (child.exitCode === null) await new Promise((resolve) => child.once('exit', resolve));
  }
});
