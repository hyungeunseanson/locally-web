import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

import { runProductionBrowserSmoke } from './run-production-browser-smoke.mjs';

async function withFixtureServer({ unexpectedMethod, unexpectedPath } = {}, check) {
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
    const pages = {
      '/': '<title>Home</title><body><a href="/experiences/42">Public experience</a><script>fetch("/get-probe");fetch("/head-probe",{method:"HEAD"});fetch("/options-probe",{method:"OPTIONS"});</script></body>',
      '/experiences/42': `<title>Experience</title><body><h1>Public experience</h1><script>
        fetch('/background');
        fetch('/api/analytics/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
          .then((result) => result.json())
          .then((body) => fetch('/synthetic-observed?success=' + body.success + '&skipped=' + body.skipped));
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
      write.method === 'POST' && write.pathname === '/api/analytics/events'));
    assert.deepEqual(result.blockedUnexpectedWrites, []);
    assert.deepEqual(receivedRequests.filter((request) => !['GET', 'HEAD', 'OPTIONS'].includes(request.method)), []);
  });
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
