import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import robotsParser from 'robots-parser';

const require = createRequire(import.meta.url);
const { resolveRobots } = require('next/dist/build/webpack/loaders/metadata/resolve-route-data.js');
const canonical = 'https://www.locally-travel.com';
const bundle = await build({ entryPoints: ['app/robots.ts'], bundle: true, platform: 'node', format: 'esm', write: false,
  define: { 'process.env': JSON.stringify({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: canonical }) } });
const source = bundle.outputFiles[0].text;
const { default: robots } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const data = robots();
const body = resolveRobots(data);
const training = ['Amazonbot', 'Applebot-Extended', 'Bytespider', 'CCBot', 'ClaudeBot', 'GPTBot', 'meta-externalagent'];
const searchAndAgents = ['Googlebot', 'Googlebot-Image', 'Bingbot', 'Applebot', 'OAI-SearchBot', 'ChatGPT-User',
  'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User'];

// Parse the actual Next serialization with the external REP implementation.
// Specific groups replace wildcard groups; they do not inherit API exclusions.
function allowed(token, pathname, rules = data.rules) {
  const text = typeof rules === 'string' ? rules : resolveRobots({ rules });
  return robotsParser(`${canonical}/robots.txt`, text).isAllowed(`${canonical}${pathname}`, token);
}

test('Google-Extended uses wildcard public permission and API restriction without a specific group', () => {
  assert(!/User-agent:\s*Google-Extended\s*$/im.test(body));
  for (const pathname of ['/', '/experiences/3071', '/community/public?board=japan', '/login', '/account']) {
    assert.equal(allowed('Google-Extended', pathname), true);
  }
  for (const pathname of ['/api/', '/api/payment/card-notification', '/api/auth/callback']) {
    assert.equal(allowed('Google-Extended', pathname), false);
  }
});

// Content Signals describe content use, outside REP Allow/Disallow. A REP
// parser ignoring this extension must not be mistaken for policy alignment.
function optionBConflicts(text) {
  const conflicts = [];
  if (!allowed('Google-Extended', '/experiences/3071', text)) conflicts.push('GOOGLE_EXTENDED_DISALLOW');
  if (/^Content-signal:\s*.*\bai-train\s*=\s*no\b/im.test(text)) conflicts.push('TRAINING_SIGNAL_REQUIRES_REVIEW');
  return conflicts;
}

test('managed Google-Extended Disallow invalidates Option B and is detected rather than overridden', () => {
  const injected = `User-agent: Google-Extended\nDisallow: /\n\n${body}`;
  assert.equal(allowed('Google-Extended', '/', injected), false);
  assert.deepEqual(optionBConflicts(injected), ['GOOGLE_EXTENDED_DISALLOW']);
  assert.equal(allowed('Googlebot', '/login', injected), true);
  assert.equal(allowed('Googlebot', '/api/private', injected), false);
});

test('Cloudflare managed content-use signal is a separate policy conflict even if REP allows crawling', () => {
  const signalOnly = `User-agent: *\nContent-signal: search=yes, ai-train=no, use=reference\nAllow: /\n\n${body}`;
  assert.equal(allowed('Google-Extended', '/', signalOnly), true);
  assert.deepEqual(optionBConflicts(signalOnly), ['TRAINING_SIGNAL_REQUIRES_REVIEW']);
  const managed = `User-agent: Google-Extended\nDisallow: /\n\n${signalOnly}`;
  assert.deepEqual(optionBConflicts(managed), ['GOOGLE_EXTENDED_DISALLOW', 'TRAINING_SIGNAL_REQUIRES_REVIEW']);
  assert.deepEqual(optionBConflicts(body), []);
});

test('ordinary search and AI search/user fetchers can crawl public and noindex UI pages', () => {
  for (const bot of searchAndAgents) {
    for (const url of ['/', '/sitemap.xml', '/experiences/3071', '/community/public?board=japan', '/users/public',
      '/en/experiences/3071', '/ja/experiences/3071', '/zh/experiences/3071', '/ko/experiences/3071',
      '/login', '/account', '/host/dashboard', '/guest/inbox', '/admin/dashboard']) assert(allowed(bot, url), `${bot}: ${url}`);
  }
});

for (const bot of training) {
  test(`${bot} has an explicit native robots opt-out without matching its search counterpart`, () => {
    assert(!allowed(bot, '/experiences/3071'));
    assert(body.includes(`User-Agent: ${bot}\n`));
    assert(allowed('Googlebot', '/experiences/3071'));
    assert(allowed('Applebot', '/experiences/3071'));
  });
}

test('API crawl exclusion is preserved for every declared use case and unknown bots', () => {
  for (const bot of [...training, ...searchAndAgents, 'Google-Extended', 'UnknownBot']) {
    for (const pathname of ['/api/', '/api/payment/card-notification', '/api/auth/callback', '/api/private?query=1']) {
      assert.equal(allowed(bot, pathname), false, `${bot}: ${pathname}`);
    }
  }
});

test('search noindex remains readable; robots does not claim to enforce privacy or indexing', () => {
  assert(!body.toLowerCase().includes('noindex'));
  assert(!body.includes('Disallow: /account'));
  assert(!body.includes('Disallow: /host/'));
  assert(!body.includes('Crawl-delay'));
  assert(!body.includes('Content-signal'));
  assert.equal(data.sitemap, `${canonical}/sitemap.xml`);
});

test('equivalent prepended training groups cannot change the API/noindex search contract', () => {
  const merged = [{ userAgent: training, disallow: '/' }, { userAgent: '*', allow: '/' }, ...data.rules];
  for (const bot of searchAndAgents) {
    assert(allowed(bot, '/account', merged));
    assert(!allowed(bot, '/api/private', merged));
  }
  for (const bot of training) assert(!allowed(bot, '/', merged));
  assert.equal(allowed('Google-Extended', '/', merged), true);
  assert.equal(allowed('Google-Extended', '/api/private', merged), false);
});

test('negative controls expose an accidental specific allow that drops API protection and a noindex crawl block', () => {
  const badAllow = [data.rules[0], { userAgent: 'OAI-SearchBot', allow: '/' }];
  assert(allowed('OAI-SearchBot', '/api/private', badAllow));
  assert(allowed('Google-Extended', '/api/private', [data.rules[0], { userAgent: 'Google-Extended', allow: '/' }]));
  assert(!allowed('Googlebot', '/account', [{ userAgent: '*', disallow: '/account' }]));
});

test('actual isolated Next HTTP GET/HEAD serves the source policy without provider credentials', { timeout: 60_000 }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'locally-robots-fixture-'));
  const portSocket = createServer();
  await new Promise(resolve => portSocket.listen(0, '127.0.0.1', resolve));
  const port = portSocket.address().port;
  await new Promise(resolve => portSocket.close(resolve));
  let child;
  let output = '';
  try {
    await mkdir(path.join(dir, 'app'));
    await symlink(path.resolve('node_modules'), path.join(dir, 'node_modules'), 'dir');
    await writeFile(path.join(dir, 'package.json'), JSON.stringify({ private: true, dependencies: { next: '*', react: '*', 'react-dom': '*' } }));
    await writeFile(path.join(dir, 'app/robots.js'), source);
    await writeFile(path.join(dir, 'app/layout.js'), "import {createElement} from 'react'; export default function Layout({children}) {return createElement('html',null,createElement('body',null,children))}");
    // This synthetic app symlinks installed dependencies outside its temporary
    // root. Use Next's supported webpack dev mode rather than Turbopack's root inference.
    child = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], {
      cwd: dir, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
        NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SITE_URL: canonical }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    const started = Date.now();
    while (!output.includes('Ready in')) {
      assert.equal(child.exitCode, null, output.slice(-3000));
      assert(Date.now() - started < 25_000, output.slice(-3000));
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const response = await fetch(`http://127.0.0.1:${port}/robots.txt`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^text\/plain/);
    assert.equal(await response.text(), body);
    assert.equal(response.headers.get('x-robots-tag'), null);
    const head = await fetch(`http://127.0.0.1:${port}/robots.txt`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
  } catch (error) {
    throw new Error(`${error.message}\n${output.slice(-4000)}`, { cause: error });
  } finally {
    if (child && child.exitCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill('SIGTERM');
      await exited;
    }
    await rm(dir, { recursive: true, force: true });
  }
});
