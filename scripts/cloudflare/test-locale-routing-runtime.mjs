import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';

const originOverride = process.env.LOCALE_RUNTIME_ORIGIN;
let worker;
let output = '';

async function reservePort() {
  const server = http.createServer();
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const address = server.address();
  assert(address && typeof address === 'object');
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function waitForReady(timeoutMs = 45_000) {
  const started = Date.now();
  while (!output.includes('Ready on')) {
    if (worker?.exitCode !== null || Date.now() - started > timeoutMs) {
      throw new Error(`Local OpenNext Worker did not start: ${output.slice(-2000)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function readAttribute(html, expression) {
  return html.match(expression)?.[1] ?? null;
}

try {
  let origin = originOverride;
  if (!origin) {
    const port = await reservePort();
    origin = `http://127.0.0.1:${port}`;
    worker = spawn(process.execPath, [
      'node_modules/wrangler/bin/wrangler.js',
      'dev', '--config', 'wrangler.jsonc', '--env', 'production',
      '--local', '--ip', '127.0.0.1', '--port', String(port),
      '--var', `NEXT_PUBLIC_SITE_URL:${origin}`,
      '--var', 'NEXT_PUBLIC_SUPABASE_URL:http://127.0.0.1:54329',
      '--var', 'NEXT_PUBLIC_SUPABASE_ANON_KEY:local-locale-routing-anon-key',
    ], { cwd: process.cwd(), env: { ...process.env, NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    worker.stdout.on('data', (chunk) => { output += chunk.toString(); });
    worker.stderr.on('data', (chunk) => { output += chunk.toString(); });
    await waitForReady();
  }

  const routes = [
    ['/', 'ko'], ['/en', 'en'], ['/ja', 'ja'], ['/zh', 'zh'],
    ['/about', 'ko'], ['/en/about', 'en'], ['/ja/about', 'ja'], ['/zh/about', 'zh'],
    ['/community', 'ko'], ['/en/community', 'en'], ['/ja/community', 'ja'], ['/zh/community', 'zh'],
    ['/search', 'ko'], ['/en/search', 'en'], ['/ja/search', 'ja'], ['/zh/search', 'zh'],
    ['/login', 'ko'], ['/en/login', 'en'], ['/ja/login', 'ja'], ['/zh/login', 'zh'],
    ['/ko', 'ko'],
  ];

  for (const [pathname, locale] of routes) {
    const response = await fetch(new URL(pathname, origin), { signal: AbortSignal.timeout(15_000) });
    assert.equal(response.status, 200, `${pathname} should resolve in the local OpenNext Worker`);
    const html = await response.text();
    assert.equal(readAttribute(html, /<html[^>]*\blang="([^"]+)"/), locale, `${pathname} HTML locale`);
    if (pathname.startsWith(`/${locale}`)) {
      assert.match(response.headers.get('set-cookie') ?? '', new RegExp(`app_lang=${locale}`), `${pathname} locale cookie`);
    }
    if (pathname === `/${locale}` && locale !== 'ko') {
      assert.match(readAttribute(html, /<link rel="canonical" href="([^"]+)"/) ?? '', new RegExp(`/${locale}$`));
    }
    console.log(`${pathname} ${response.status} lang=${locale}`);
  }

  const queryResponse = await fetch(new URL('/en/search?location=Tokyo&category=all', origin));
  assert.equal(queryResponse.status, 200, 'locale search URL with query parameters');
  assert.equal(readAttribute(await queryResponse.text(), /<html[^>]*\blang="([^"]+)"/), 'en');
  console.log('LOCALE_OPENNEXT_RUNTIME_PASS');
} finally {
  if (worker && !worker.killed) worker.kill('SIGTERM');
}
