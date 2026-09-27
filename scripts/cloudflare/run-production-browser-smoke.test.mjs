import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import test from 'node:test';

import { runProductionBrowserSmoke } from './run-production-browser-smoke.mjs';

async function withFixtureServer({ unexpectedMethod, unexpectedPath, analyticsBody = '{"event_type":"view","target_id":"42"}', rumPosts = 0 } = {}, check) {
  const receivedRequests = [];
  let backgroundStarted = false;
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    receivedRequests.push({ method: request.method, pathname: url.pathname, search: url.search });

    if (url.pathname === '/background') {
      backgroundStarted = true;
      response.writeHead(200, { 'content-type': 'text/plain' });
      response.write('still running');
      return;
    }
    if (url.pathname === '/api/proxy-bookings') {
      response.writeHead(401).end();
      return;
    }

    const unexpectedWrite = unexpectedMethod
      ? `fetch(${JSON.stringify(unexpectedPath)}, { method: ${JSON.stringify(unexpectedMethod)} }).catch(() => {});`
      : '';
    const rumWrites = Array.from({ length: rumPosts }, () => `
      fetch('/cdn-cgi/rum', { method: 'POST' })
        .then((result) => {
          if (result.status !== 204) throw new Error('RUM synthetic response was not HTTP 204');
          return fetch('/rum-synthetic-observed?status=' + result.status);
        })
        .catch((error) => console.error(error));
    `).join('');
    const pages = {
      '/': '<title>Home</title><body><a href="/experiences/42">Public experience</a><script>fetch("/get-probe");fetch("/head-probe",{method:"HEAD"});fetch("/options-probe",{method:"OPTIONS"});</script></body>',
      '/experiences/42': `<title>Experience</title><body><h1>Public experience</h1><script>
        fetch('/background');
        fetch('/api/analytics/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: ${JSON.stringify(analyticsBody)} })
          .then((result) => result.json())
          .then((body) => fetch('/synthetic-observed?success=' + body.success + '&skipped=' + body.skipped))
          .catch(() => {});
        ${rumWrites}
        ${unexpectedWrite}
      </script></body>`,
      '/login': '<title>Login</title><body><input aria-label="Email"></body>',
    };
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end(pages[url.pathname] ?? '<body>OK</body>');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    await check({ origin, receivedRequests, backgroundStarted: () => backgroundStarted });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('GET pages and protected API stay live while analytics POST is fulfilled locally and a background request never ends', async () => {
  await withFixtureServer({}, async ({ origin, receivedRequests, backgroundStarted }) => {
    const result = await runProductionBrowserSmoke(origin);

    assert.equal(result.status, 'LOCALLY_PRODUCTION_BROWSER_SMOKE_PASS');
    assert.equal(result.publicExperience, '/experiences/42');
    assert.equal(result.unauthenticatedProxyBookings, 401);
    assert.equal(backgroundStarted(), true);
    for (const pathname of ['/', '/experiences/42', '/login', '/api/proxy-bookings', '/get-probe']) {
      assert(receivedRequests.some((request) => request.method === 'GET' && request.pathname === pathname), pathname);
    }
    assert(receivedRequests.some((request) => request.method === 'HEAD' && request.pathname === '/head-probe'));
    assert(receivedRequests.some((request) => request.method === 'OPTIONS' && request.pathname === '/options-probe'));
    assert(receivedRequests.some((request) =>
      request.pathname === '/synthetic-observed'
      && request.search.includes('success=true')
      && request.search.includes('skipped=production_smoke')));
    assert(result.blockedExpectedWrites.some((write) =>
      write.method === 'POST' && write.pathname === '/api/analytics/events'
      && write.eventType === 'view' && write.targetId === '42'));
    assert.deepEqual(result.blockedUnexpectedWrites, []);
    assert.deepEqual(receivedRequests.filter((request) => !['GET', 'HEAD', 'OPTIONS'].includes(request.method)), []);
  });
});

for (const rumPosts of [1, 2]) {
  test(`${rumPosts} exact Cloudflare RUM POST beacon(s) are fulfilled locally without console errors`, async () => {
    await withFixtureServer({ rumPosts }, async ({ origin, receivedRequests }) => {
      const result = await runProductionBrowserSmoke(origin);
      assert.equal(result.unauthenticatedProxyBookings, 401);
      assert.equal(result.blockedExpectedWrites.filter((write) =>
        write.method === 'POST' && write.pathname === '/cdn-cgi/rum'
        && write.kind === 'cloudflare_rum').length, rumPosts);
      assert.equal(receivedRequests.filter((request) =>
        request.method === 'GET' && request.pathname === '/rum-synthetic-observed'
        && request.search === '?status=204').length, rumPosts);
      assert.deepEqual(result.blockedUnexpectedWrites, []);
      assert.deepEqual(receivedRequests.filter((request) => !['GET', 'HEAD', 'OPTIONS'].includes(request.method)), []);
    });
  });
}

for (const pathname of [
  '/cdn-cgi/rum-evil',
  '/cdn-cgi/rum/test',
  '/api/cdn-cgi/rum',
  '/cdn-cgi/other',
  '/cdn-cgi/rum/',
]) {
  test(`POST ${pathname} is not expected Cloudflare RUM telemetry`, async () => {
    await withFixtureServer({ unexpectedMethod: 'POST', unexpectedPath: pathname }, async ({ origin, receivedRequests }) => {
      await assert.rejects(runProductionBrowserSmoke(origin), (error) =>
        error.message.includes(`"pathname":"${pathname}"`));
      assert.deepEqual(receivedRequests.filter((request) => !['GET', 'HEAD', 'OPTIONS'].includes(request.method)), []);
    });
  });
}

for (const method of ['PUT', 'PATCH', 'DELETE']) {
  test(`${method} /cdn-cgi/rum is blocked and fails smoke`, async () => {
    await withFixtureServer({ unexpectedMethod: method, unexpectedPath: '/cdn-cgi/rum' }, async ({ origin, receivedRequests }) => {
      await assert.rejects(runProductionBrowserSmoke(origin), (error) =>
        error.message.includes(`"method":"${method}"`)
        && error.message.includes('"pathname":"/cdn-cgi/rum"'));
      assert.deepEqual(receivedRequests.filter((request) => !['GET', 'HEAD', 'OPTIONS'].includes(request.method)), []);
    });
  });
}

for (const [label, analyticsBody, eventType] of [
  ['click', '{"event_type":"click","target_id":"42"}', 'click'],
  ['payment_init', '{"event_type":"payment_init","target_id":"42"}', 'payment_init'],
  ['booking_confirmed', '{"event_type":"booking_confirmed","target_id":"42"}', 'booking_confirmed'],
  ['missing event_type', '{"target_id":"42"}', null],
  ['malformed JSON', '{', null],
  ['missing target_id', '{"event_type":"view"}', 'view'],
]) {
  test(`analytics ${label} is blocked before the server and fails smoke`, async () => {
    await withFixtureServer({ analyticsBody }, async ({ origin, receivedRequests }) => {
      await assert.rejects(
        runProductionBrowserSmoke(origin),
        (error) => error.message.includes('"pathname":"/api/analytics/events"')
          && error.message.includes(`"eventType":${JSON.stringify(eventType)}`)
      );
      assert.deepEqual(receivedRequests.filter((request) => !['GET', 'HEAD', 'OPTIONS'].includes(request.method)), []);
    });
  });
}

test('protected API smoke cannot bypass BrowserContext routes through APIRequestContext', () => {
  const source = readFileSync(new URL('./run-production-browser-smoke.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\b(?:context|page|apiPage)\.request\b|\bAPIRequestContext\b/);
});

for (const [method, pathname] of [
  ['POST', '/api/analytics/search'],
  ['PUT', '/api/mutate'],
  ['PATCH', '/api/mutate'],
  ['DELETE', '/api/mutate'],
]) {
  test(`unexpected first-party ${method} is blocked before the server and fails smoke`, async () => {
    await withFixtureServer({ unexpectedMethod: method, unexpectedPath: pathname }, async ({ origin, receivedRequests }) => {
      await assert.rejects(
        runProductionBrowserSmoke(origin),
        (error) => error.message.includes(`"method":"${method}"`)
          && error.message.includes(`"pathname":"${pathname}"`)
      );
      assert.deepEqual(receivedRequests.filter((request) => !['GET', 'HEAD', 'OPTIONS'].includes(request.method)), []);
    });
  });
}
