import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { chromium, errors } from '@playwright/test';

import {
  installProductionMutationGate,
  REVIEWED_EXTERNAL_SCRIPT_STUBS,
  runProductionBrowserSmoke as productionBrowserSmoke,
  summarizePendingFirstPartyRequests,
  visitReadOnlyPage,
} from './run-production-browser-smoke.mjs';

const runProductionBrowserSmoke = (origin, options) => productionBrowserSmoke(origin, { log: () => {}, ...options });

async function withFixtureServer({
  unexpectedMethod,
  unexpectedPath,
  analyticsBody = '{"event_type":"view","target_id":"42"}',
  rumPosts = 0,
  externalMethod,
  externalPath = '/telemetry',
  externalScriptPaths = [],
  loginInputDelayMs = 0,
  loginSpinnerForever = false,
  loginGenericError = false,
  loginUnrelatedInput = false,
  loginResources = [],
  loginTimeoutAttempts = 0,
  loginRetryUnexpectedWrite = false,
  loginRetryExternalWrite = false,
  apiStatus = 401,
  navigationTimeoutPath,
  navigationTimeoutAttempts = 0,
} = {}, check) {
  const receivedRequests = [];
  const externalReceivedRequests = [];
  let backgroundStarted = false;
  const externalServer = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    externalReceivedRequests.push({ method: request.method, pathname: url.pathname });
    response.writeHead(200, {
      'access-control-allow-origin': '*',
      'content-type': 'application/javascript',
    }).end('fetch("/unexpected-script-side-effect", { method: "POST" });');
  });
  await new Promise((resolve) => externalServer.listen(0, '127.0.0.1', resolve));
  const externalOrigin = `http://127.0.0.1:${externalServer.address().port}`;
  const loginResourcesByPath = new Map(loginResources.map((resource) => [
    new URL(resource.url, 'http://127.0.0.1').pathname,
    resource,
  ]));
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    receivedRequests.push({ method: request.method, pathname: url.pathname, search: url.search });

    const loginResource = loginResourcesByPath.get(url.pathname);
    if (loginResource) {
      if (loginResource.behavior === 'hang') {
        response.writeHead(200, { 'content-type': 'text/javascript' });
        response.write('void 0;');
      } else if (loginResource.behavior === 'fail') {
        setTimeout(() => response.destroy(), loginResource.responseDelayMs ?? 30);
      } else {
        setTimeout(() => response.writeHead(200, { 'content-type': 'text/javascript' }).end('void 0;'), loginResource.responseDelayMs ?? 30);
      }
      return;
    }

    if (url.pathname === '/background') {
      backgroundStarted = true;
      response.writeHead(200, { 'content-type': 'text/plain' });
      response.write('still running');
      return;
    }
    if (url.pathname === '/navigation-blocker.js') {
      response.writeHead(200, { 'content-type': 'application/javascript' });
      response.write('void 0;');
      return;
    }
    if (url.pathname === '/api/proxy-bookings') {
      response.writeHead(apiStatus).end();
      return;
    }

    const unexpectedWrite = unexpectedMethod
      ? `fetch(${JSON.stringify(unexpectedPath)}, { method: ${JSON.stringify(unexpectedMethod)} }).catch(() => {});`
      : '';
    const externalRequest = externalMethod
      ? `fetch(${JSON.stringify(`${externalOrigin}${externalPath}`)}, { method: ${JSON.stringify(externalMethod)} }).catch(() => {});`
      : '';
    const externalScripts = externalScriptPaths.map((pathname) =>
      `<script src="${externalOrigin}${pathname}"></script>`).join('');
    const rumWrites = Array.from({ length: rumPosts }, () => `
      fetch('/cdn-cgi/rum', { method: 'POST' })
        .then((result) => {
          if (result.status !== 204) throw new Error('RUM synthetic response was not HTTP 204');
          return fetch('/rum-synthetic-observed?status=' + result.status);
        })
        .catch((error) => console.error(error));
    `).join('');
    const loginResourceScripts = loginResources.map(({ url: resourceUrl, startDelayMs = 0 }) => `
      setTimeout(() => {
        const script = document.createElement('script');
        script.src = ${JSON.stringify(resourceUrl)};
        document.head.append(script);
      }, ${startDelayMs});
    `).join('');
    const loginResourceBootstrap = loginResourceScripts ? `<script>${loginResourceScripts}</script>` : '';
    const loginAttempt = receivedRequests.filter((request) => request.pathname === '/login').length;
    const pages = {
      '/': `<title>Home</title><body><a href="/experiences/42">Public experience</a>${externalScripts}<script>fetch("/get-probe");fetch("/head-probe",{method:"HEAD"});fetch("/options-probe",{method:"OPTIONS"});</script></body>`,
      '/experiences/42': `<title>Experience</title><body><h1>Public experience</h1><script>
        fetch('/background');
        fetch('/api/analytics/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: ${JSON.stringify(analyticsBody)} })
          .then((result) => result.json())
          .then((body) => fetch('/synthetic-observed?success=' + body.success + '&skipped=' + body.skipped))
          .catch(() => {});
        ${rumWrites}
        ${unexpectedWrite}
        ${externalRequest}
      </script></body>`,
      '/login': loginGenericError
        ? '<title>Login</title><body>Something went wrong</body>'
        : loginSpinnerForever || loginAttempt <= loginTimeoutAttempts
          ? `<title>Login</title><body>${loginUnrelatedInput ? '<input aria-label="Site search">' : ''}<div class="animate-spin"></div>${loginResourceBootstrap}</body>`
          : loginInputDelayMs > 0
            ? `<title>Login</title><body><div class="animate-spin"></div><script>setTimeout(() => { document.body.insertAdjacentHTML('beforeend', '<div data-testid="login-modal"><input aria-label="Email"></div>'); }, ${loginInputDelayMs});</script></body>`
            : `<title>Login</title><body><div data-testid="login-modal"><input aria-label="Email"></div>${loginRetryUnexpectedWrite && loginAttempt > 1 ? '<script>fetch("/retry-write", {method:"POST"}).catch(() => {});</script>' : ''}${loginRetryExternalWrite && loginAttempt > 1 ? `<script>fetch(${JSON.stringify(externalOrigin + '/retry-external-write')}, {method:"POST"}).catch(() => {});</script>` : ''}</body>`,
    };
    response.writeHead(200, { 'content-type': 'text/html' });
    const navigationAttempt = receivedRequests.filter((request) => request.pathname === navigationTimeoutPath).length;
    const navigationBlocker = url.pathname === navigationTimeoutPath && navigationAttempt <= navigationTimeoutAttempts
      ? '<script src="/navigation-blocker.js?secret=DO_NOT_LOG"></script>' : '';
    response.end(navigationBlocker + (pages[url.pathname] ?? '<body>OK</body>'));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    await check({ origin, externalOrigin, receivedRequests, externalReceivedRequests, backgroundStarted: () => backgroundStarted });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    externalServer.closeAllConnections();
    await new Promise((resolve, reject) => externalServer.close((error) => error ? reject(error) : resolve()));
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

async function exerciseScriptGate(url, { method = 'GET', resourceType = 'script' } = {}) {
  let handler;
  const actions = [];
  const diagnostics = await installProductionMutationGate({
    route: async (_pattern, callback) => { handler = callback; },
  }, 'https://www.locally-travel.com');
  await handler({
    request: () => ({ url: () => url, method: () => method, resourceType: () => resourceType }),
    continue: async () => actions.push({ type: 'continue' }),
    abort: async (reason) => actions.push({ type: 'abort', reason }),
    fulfill: async (response) => actions.push({ type: 'fulfill', ...response }),
  });
  return { actions, diagnostics };
}

const defaultScriptCases = [
  ['Funding Choices', 'https://fundingchoicesmessages.google.com/i/pub-123456?fixture=private', 'google_cmp_loader', '/i/pub-[REDACTED]'],
  ['gtag', 'https://www.googletagmanager.com/gtag/js?id=fixture-private', 'google_analytics_loader', '/gtag/js'],
  ['AdSense', 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=fixture-private', 'google_adsense_loader', '/pagead/js/adsbygoogle.js'],
];

for (const [label, url, kind, diagnosticPathname] of defaultScriptCases) {
  test(`${label} script GET is synthetic 200 no-op JS with identifier-free diagnostics`, async () => {
    const { actions, diagnostics } = await exerciseScriptGate(url);
    assert.deepEqual(actions, [{ type: 'fulfill', status: 200, contentType: 'application/javascript', body: ';' }]);
    assert.deepEqual(diagnostics.stubbedExternalScripts, [{
      hostname: new URL(url).hostname, pathname: diagnosticPathname,
      method: 'GET', resourceType: 'script', kind,
    }]);
    const diagnosticJson = JSON.stringify(diagnostics);
    assert(!diagnosticJson.includes('123456'));
    assert(!diagnosticJson.includes('fixture-private'));
    assert(!diagnosticJson.includes('?'));
    assert.deepEqual(diagnostics.blockedUnexpectedExternalWrites, []);
  });

  test(`${label} loader URL with a non-script resource type still continues as an ordinary read`, async () => {
    const { actions, diagnostics } = await exerciseScriptGate(url, { resourceType: 'xhr' });
    assert.deepEqual(actions, [{ type: 'continue' }]);
    assert.deepEqual(diagnostics.stubbedExternalScripts, []);
  });

  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    test(`${label} loader URL ${method} is never stubbed and remains an unexpected blocked write`, async () => {
      const { actions, diagnostics } = await exerciseScriptGate(url, { method });
      assert.deepEqual(actions, [{ type: 'abort', reason: 'blockedbyclient' }]);
      assert.deepEqual(diagnostics.stubbedExternalScripts, []);
      assert.deepEqual(diagnostics.blockedExpectedExternalWrites, []);
      assert.equal(diagnostics.blockedUnexpectedExternalWrites.length, 1);
    });
  }
}

for (const [url, resourceType] of [
  ['https://fundingchoicesmessages.google.com/el/something', 'xhr'],
  ['https://fundingchoicesmessages.google.com/el/something', 'script'],
  ['https://fundingchoicesmessages.google.com/unrelated.js', 'script'],
  ['https://fundingchoicesmessages.google.com/i/pub-invalid', 'script'],
  ['https://fundingchoicesmessages.google.com/i/pub-123456/other.js', 'script'],
  ['https://www.googletagmanager.com/other.js', 'script'],
  ['https://www.googletagmanager.com/gtag/js/other', 'script'],
  ['https://pagead2.googlesyndication.com/pagead/js/other.js', 'script'],
  ['https://pagead2.googlesyndication.com/pagead/ping', 'xhr'],
  ['http://www.googletagmanager.com/gtag/js', 'script'],
  ['https://www.googletagmanager.com.example/gtag/js', 'script'],
]) {
  test(`unreviewed read ${new URL(url).hostname}${new URL(url).pathname} (${resourceType}) is not stubbed`, async () => {
    const { actions, diagnostics } = await exerciseScriptGate(url, { resourceType });
    assert.deepEqual(actions, [{ type: 'continue' }]);
    assert.deepEqual(diagnostics.stubbedExternalScripts, []);
  });
}

for (const contract of REVIEWED_EXTERNAL_SCRIPT_STUBS) {
  const pathname = contract.pathname ?? '/i/pub-123456';
  test(`${contract.kind} no-op loader cannot reach a real external fixture server or execute its side effect`, async () => {
    await withFixtureServer({ externalScriptPaths: [pathname + '?fixture=private'] }, async ({ origin, externalOrigin, externalReceivedRequests, receivedRequests }) => {
      const result = await runProductionBrowserSmoke(origin, {
        reviewedExternalScriptStubs: [{ ...contract, origin: externalOrigin }],
      });
      assert.equal(result.status, 'LOCALLY_PRODUCTION_BROWSER_SMOKE_PASS');
      assert.equal(result.stubbedExternalScripts.length, 1);
      assert.equal(result.stubbedExternalScripts[0].kind, contract.kind);
      assert.deepEqual(externalReceivedRequests, []);
      assert(!receivedRequests.some((request) => request.pathname === '/unexpected-script-side-effect'));
      assert.deepEqual(result.blockedUnexpectedWrites, []);
      assert.deepEqual(result.blockedUnexpectedExternalWrites, []);
    });
  });

  test(`${contract.kind} loader POST still fails smoke and never reaches the external fixture`, async () => {
    await withFixtureServer({ externalMethod: 'POST', externalPath: pathname }, async ({ origin, externalOrigin, externalReceivedRequests }) => {
      await assert.rejects(runProductionBrowserSmoke(origin, {
        reviewedExternalScriptStubs: [{ ...contract, origin: externalOrigin }],
      }), /unexpected writes/);
      assert.deepEqual(externalReceivedRequests, []);
    });
  });
}

test('AdSense runtime ping POST stays blocked and fails smoke with loader isolation enabled', async () => {
  await withFixtureServer({ externalMethod: 'POST', externalPath: '/pagead/ping' }, async ({ origin, externalOrigin, externalReceivedRequests }) => {
    const contract = REVIEWED_EXTERNAL_SCRIPT_STUBS.find((entry) => entry.kind === 'google_adsense_loader');
    await assert.rejects(runProductionBrowserSmoke(origin, {
      reviewedExternalScriptStubs: [{ ...contract, origin: externalOrigin }],
    }), /unexpected writes/);
    assert.deepEqual(externalReceivedRequests, []);
  });
});

test('external GET passes through the mutation gate', async () => {
  await withFixtureServer({ externalMethod: 'GET' }, async ({ origin, externalReceivedRequests }) => {
    const result = await runProductionBrowserSmoke(origin);
    assert.equal(result.status, 'LOCALLY_PRODUCTION_BROWSER_SMOKE_PASS');
    assert.deepEqual(externalReceivedRequests, [{ method: 'GET', pathname: '/telemetry' }]);
    assert.deepEqual(result.blockedExpectedExternalWrites, []);
    assert.deepEqual(result.blockedUnexpectedExternalWrites, []);
  });
});

test('exact reviewed external telemetry POST is fulfilled locally without reaching the external server', async () => {
  await withFixtureServer({ externalMethod: 'POST' }, async ({ origin, externalOrigin, externalReceivedRequests }) => {
    const result = await runProductionBrowserSmoke(origin, {
      reviewedExternalTelemetry: [{
        origin: externalOrigin,
        pathname: '/telemetry',
        method: 'POST',
        kind: 'test_telemetry',
      }],
    });
    assert.equal(result.status, 'LOCALLY_PRODUCTION_BROWSER_SMOKE_PASS');
    assert.deepEqual(result.blockedExpectedExternalWrites, [{
      method: 'POST',
      pathname: '/telemetry',
      hostname: '127.0.0.1',
      resourceType: 'fetch',
      kind: 'test_telemetry',
    }]);
    assert.deepEqual(result.blockedUnexpectedExternalWrites, []);
    assert.deepEqual(externalReceivedRequests, []);
  });
});

for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
  test(`unknown external ${method} is blocked locally and fails smoke`, async () => {
    await withFixtureServer({ externalMethod: method }, async ({ origin, externalReceivedRequests }) => {
      await assert.rejects(runProductionBrowserSmoke(origin), (error) =>
        error.message.includes('unexpected writes')
        && error.message.includes(`"method":"${method}"`)
        && error.message.includes('"pathname":"/telemetry"'));
      assert.deepEqual(externalReceivedRequests, []);
    });
  });
}

for (const [label, loginInputDelayMs] of [
  ['14-second-equivalent', 140],
  ['20-second-equivalent', 200],
]) {
  test(`delayed Login input ${label} passes within the Login-specific timeout`, async () => {
    await withFixtureServer({ loginInputDelayMs }, async ({ origin }) => {
      const result = await runProductionBrowserSmoke(origin, { loginReadinessTimeoutMs: 450 });
      assert.equal(result.login, 'rendered');
    });
  });
}

test('Login input beyond its timeout boundary fails with bounded diagnostics', async () => {
  await withFixtureServer({ loginInputDelayMs: 1000 }, async ({ origin }) => {
    await assert.rejects(
      runProductionBrowserSmoke(origin, { loginReadinessTimeoutMs: 100 }),
      (error) => error.message.includes('/login input readiness timed out')
        && error.message.includes('"bodyReady":true')
        && error.message.includes('"spinnerPresent":true')
        && error.message.includes('"loginModalPresent":false')
        && error.message.includes('"documentReadyState":"complete"')
        && error.message.includes('"pendingFirstPartyRequestCount":0')
    );
  });
});

function loginTimeoutDiagnostic(error) {
  const prefix = '/login input readiness timed out: ';
  assert(error.message.startsWith(prefix), error.message);
  return JSON.parse(error.message.slice(prefix.length));
}

test('Login timeout reports a hanging first-party script without query, body, or header data', async () => {
  await withFixtureServer({
    loginSpinnerForever: true,
    loginResources: [{
      url: '/hanging-login.js?secret=DO_NOT_LOG',
      behavior: 'hang',
    }],
  }, async ({ origin, receivedRequests }) => {
    await assert.rejects(
      runProductionBrowserSmoke(origin, { loginReadinessTimeoutMs: 300 }),
      (error) => {
        const diagnostic = loginTimeoutDiagnostic(error);
        assert(diagnostic.pendingFirstPartyRequestCount >= 1);
        assert(diagnostic.pendingFirstPartyRequests.some((request) =>
          request.method === 'GET'
          && request.pathname === '/hanging-login.js'
          && request.resourceType === 'script'
          && request.isNavigationRequest === false
          && request.elapsedMs >= 0));
        assert.doesNotMatch(error.message, /DO_NOT_LOG|\?secret=|Authorization|Cookie|requestBody|headers/i);
        return true;
      }
    );
    assert(receivedRequests.some((request) =>
      request.pathname === '/hanging-login.js' && request.search === '?secret=DO_NOT_LOG'));
  });
});

test('finished and failed scripts leave pending diagnostics; the failed script console error prevents retry', async () => {
  await withFixtureServer({
    loginSpinnerForever: true,
    loginResources: [
      { url: '/finished-login.js', behavior: 'finish' },
      { url: '/failed-login.js', behavior: 'fail' },
      { url: '/still-hanging-login.js', behavior: 'hang' },
    ],
  }, async ({ origin, receivedRequests }) => {
    const attempts = [];
    await assert.rejects(
      runProductionBrowserSmoke(origin, { loginReadinessTimeoutMs: 300, log: (entry) => attempts.push(JSON.parse(entry)) }),
      /first-party browser console error/
    );
    const loginAttempts = attempts.filter(({ pathname }) => pathname === '/login');
    assert.equal(loginAttempts.length, 1);
    assert.equal(loginAttempts[0].pendingFirstPartyRequestCount, 1);
    assert.deepEqual(loginAttempts[0].pendingFirstPartyRequests.map((request) => request.pathname), ['/still-hanging-login.js']);
    assert.equal(receivedRequests.filter((request) => request.pathname === '/login').length, 1);
    for (const pathname of ['/finished-login.js', '/failed-login.js', '/still-hanging-login.js']) {
      assert(receivedRequests.some((request) => request.pathname === pathname));
    }
  });
});

test('Login timeout reports the longest pending first-party request first', async () => {
  await withFixtureServer({
    loginSpinnerForever: true,
    loginResources: [
      { url: '/older-login.js', behavior: 'hang' },
      { url: '/newer-login.js', behavior: 'hang', startDelayMs: 80 },
    ],
  }, async ({ origin }) => {
    await assert.rejects(
      runProductionBrowserSmoke(origin, { loginReadinessTimeoutMs: 350 }),
      (error) => {
        const requests = loginTimeoutDiagnostic(error).pendingFirstPartyRequests;
        assert.deepEqual(requests.map((request) => request.pathname), [
          '/older-login.js', '/newer-login.js',
        ]);
        assert(requests[0].elapsedMs > requests[1].elapsedMs);
        return true;
      }
    );
  });
});

test('pending request summary keeps the total count while listing at most ten longest requests', () => {
  const pending = new Map(Array.from({ length: 12 }, (_, index) => [
    index,
    {
      method: 'GET',
      pathname: `/chunk-${index}.js`,
      resourceType: 'script',
      isNavigationRequest: false,
      startedAt: 1000 + index,
    },
  ]));
  const summary = summarizePendingFirstPartyRequests(pending, 2000);
  assert.equal(pending.size, 12);
  assert.equal(summary.length, 10);
  assert.equal(summary[0].pathname, '/chunk-0.js');
  assert.equal(summary[9].pathname, '/chunk-9.js');
  assert(summary.every((request) => !Object.hasOwn(request, 'startedAt')));
});

test('Login spinner forever fails rather than passing on HTTP 200', async () => {
  await withFixtureServer({ loginSpinnerForever: true, loginUnrelatedInput: true }, async ({ origin }) => {
    await assert.rejects(
      runProductionBrowserSmoke(origin, { loginReadinessTimeoutMs: 100 }),
      (error) => error.message.includes('/login input readiness timed out')
        && error.message.includes('"spinnerPresent":true')
    );
  });
});

test('Login generic error before input fails rather than passing on HTTP 200', async () => {
  await withFixtureServer({ loginGenericError: true }, async ({ origin, receivedRequests }) => {
    await assert.rejects(
      runProductionBrowserSmoke(origin, { loginReadinessTimeoutMs: 100 }),
      (error) => error.message.includes('/login rendered a generic error before input readiness')
        && error.message.includes('"genericErrorPresent":true')
    );
    assert.equal(receivedRequests.filter((request) => request.pathname === '/login').length, 1);
  });
});

function retryFixture(plans) {
  const origin = 'https://www.locally-travel.com';
  const pages = [];
  const diagnostics = [];
  const mutationGate = { blockedUnexpectedWrites: [], blockedUnexpectedExternalWrites: [] };
  const context = {
    async newPage() {
      assert(pages.length < plans.length, 'Unexpected extra Page/attempt.');
      const plan = plans[pages.length];
      const page = new EventEmitter();
      const frame = {};
      page.mainFrame = () => frame;
      page.closed = false;
      page.goto = async (url, options) => {
        assert.equal(options.waitUntil, 'domcontentloaded');
        assert.equal(options.timeout, 30000);
        const request = {
          url: () => url, method: () => 'GET', resourceType: () => 'document',
          isNavigationRequest: () => true, frame: () => frame,
        };
        page.emit('request', request);
        if (plan.status !== undefined) page.emit('response', { request: () => request, status: () => plan.status });
        if (plan.pageerror) page.emit('pageerror', new Error('Fixture pageerror'));
        if (plan.consoleError) page.emit('console', {
          type: () => 'error', location: () => ({ url: origin + '/script.js' }), text: () => 'Fixture console error',
        });
        if (plan.unexpectedWrite) mutationGate.blockedUnexpectedWrites.push({ method: 'POST', pathname: '/unexpected' });
        if (plan.externalWrite) mutationGate.blockedUnexpectedExternalWrites.push({ method: 'POST', pathname: '/external' });
        if (plan.navigationTimeout) throw new errors.TimeoutError('Do not log query ?secret=DO_NOT_LOG');
        if (plan.gotoError) throw plan.gotoError;
        page.emit('requestfinished', request);
        return plan.nullResponse ? null : { status: () => plan.status ?? 200 };
      };
      page.locator = () => ({
        async waitFor() { if (plan.readinessTimeout) throw new errors.TimeoutError('Fixture readiness timeout'); },
      });
      page.evaluate = async () => {
        if (plan.stateUnavailable) throw new Error('Fixture diagnostic error');
        if (plan.stateHang) return new Promise(() => {});
        return {
          documentReadyState: 'interactive', bodyReady: true, spinnerPresent: false,
          loginModalPresent: false, genericErrorPresent: Boolean(plan.genericError),
        };
      };
      page.waitForTimeout = async () => {};
      page.close = async () => {
        page.closed = true;
        if (plan.closeWrite) mutationGate.blockedUnexpectedWrites.push({ method: 'POST', pathname: '/late-write' });
      };
      pages.push(page);
      return page;
    },
  };
  return {
    pages, diagnostics,
    visit: (pathname, check = async () => 'ready') => visitReadOnlyPage(context, origin, pathname, check, {
      mutationGate, attemptDiagnostics: diagnostics, log: () => {},
    }),
  };
}

for (const pathname of ['/', '/experiences/42?secret=DO_NOT_LOG']) {
  test(`${new URL(pathname, 'https://fixture.test').pathname} navigation timeout retries once on a fresh Page`, async () => {
    const fixture = retryFixture([{ navigationTimeout: true }, {}]);
    assert.equal(await fixture.visit(pathname), 'ready');
    assert.equal(fixture.pages.length, 2);
    assert(fixture.pages.every((page) => page.closed));
    assert.notEqual(fixture.pages[0], fixture.pages[1]);
    assert.deepEqual(fixture.diagnostics.map(({ attempt, outcome }) => [attempt, outcome]), [[1, 'retry'], [2, 'pass']]);
    assert.equal(fixture.diagnostics[0].timeoutStage, 'navigation');
    assert.equal(fixture.diagnostics[0].readinessElapsedMs, 0);
    assert.equal(fixture.diagnostics[0].pendingFirstPartyRequestCount, 1);
    assert.equal(fixture.diagnostics[0].pendingFirstPartyRequests[0].pathname, new URL(pathname, 'https://fixture.test').pathname);
    assert.doesNotMatch(JSON.stringify(fixture.diagnostics), /DO_NOT_LOG|\?secret=|headers|requestBody/);
  });

  test(`${new URL(pathname, 'https://fixture.test').pathname} two navigation timeouts fail with max attempts two`, async () => {
    const fixture = retryFixture([{ navigationTimeout: true }, { navigationTimeout: true }]);
    await assert.rejects(fixture.visit(pathname), (error) => {
      assert(error instanceof errors.TimeoutError);
      assert.doesNotMatch(error.message, /DO_NOT_LOG|\?secret=/);
      return error.message.includes('"attempt":2');
    });
    assert.equal(fixture.pages.length, 2);
    assert(fixture.pages.every((page) => page.closed));
    assert.deepEqual(fixture.diagnostics.map(({ outcome }) => outcome), ['retry', 'fail']);
  });
}

test('body visible readiness TimeoutError retries on a fresh Page', async () => {
  const fixture = retryFixture([{ readinessTimeout: true }, {}]);
  assert.equal(await fixture.visit('/'), 'ready');
  assert.equal(fixture.pages.length, 2);
  assert.equal(fixture.diagnostics[0].timeoutStage, 'readiness');
});

for (const state of ['visible', 'attached']) {
  test(`${state} page-check readiness TimeoutError retries once`, async () => {
    const fixture = retryFixture([{}, {}]);
    let checks = 0;
    assert.equal(await fixture.visit('/', async (_page, _pending, waitForReadiness) => {
      checks += 1;
      await waitForReadiness({ waitFor: async (options) => {
        assert.equal(options.state, state);
        if (checks === 1) throw new errors.TimeoutError('Fixture readiness timeout');
      } }, { state, timeout: 15000 });
      return 'ready';
    }), 'ready');
    assert.equal(fixture.pages.length, 2);
    assert.equal(fixture.diagnostics[0].timeoutStage, 'readiness');
  });
}

for (const [label, plan, message] of [
  ['generic error', { navigationTimeout: true, genericError: true }, /generic error/],
  ['first-party write', { navigationTimeout: true, unexpectedWrite: true }, /unexpected writes/],
  ['external write', { navigationTimeout: true, externalWrite: true }, /unexpected writes/],
  ['HTTP 500', { status: 500 }, /HTTP 200/],
  ['HTTP 500 with navigation timeout', { status: 500, navigationTimeout: true }, /HTTP 200/],
  ['pageerror', { navigationTimeout: true, pageerror: true }, /uncaught browser error/],
  ['first-party console error', { navigationTimeout: true, consoleError: true }, /first-party browser console error/],
  ['unavailable safety diagnostics', { navigationTimeout: true, stateUnavailable: true }, /diagnostic error/],
  ['hanging safety diagnostics', { navigationTimeout: true, stateHang: true }, /Page diagnostics timed out/],
  ['write during timeout cleanup', { navigationTimeout: true, closeWrite: true }, /unexpected writes/],
  ['malformed/null response', { nullResponse: true }, /HTTP 200/],
  ['non-timeout navigation error', { gotoError: new Error('Fixture connection failure') }, /connection failure/],
]) {
  test(`${label} fails without retry`, async () => {
    const fixture = retryFixture([plan]);
    await assert.rejects(fixture.visit('/'), message);
    assert.equal(fixture.pages.length, 1);
    assert.equal(fixture.pages[0].closed, true);
    assert.equal(fixture.diagnostics[0].outcome, 'fail');
  });
}

for (const error of [new assert.AssertionError({ message: 'Fixture assertion' }), new errors.TimeoutError('Unrelated operation timeout')]) {
  test(`unrelated check ${error.name} never retries`, async () => {
    const fixture = retryFixture([{}]);
    await assert.rejects(fixture.visit('/', async () => { throw error; }), (actual) => actual === error);
    assert.equal(fixture.pages.length, 1);
  });
}

test('Login first input-readiness timeout then fresh Page success passes', async () => {
  await withFixtureServer({ loginTimeoutAttempts: 1 }, async ({ origin, receivedRequests }) => {
    const result = await runProductionBrowserSmoke(origin, { loginReadinessTimeoutMs: 100 });
    assert.equal(result.status, 'LOCALLY_PRODUCTION_BROWSER_SMOKE_PASS');
    assert.deepEqual(result.pageAttempts.filter(({ pathname }) => pathname === '/login').map(({ attempt, outcome, timeoutStage }) =>
      [attempt, outcome, timeoutStage]), [[1, 'retry', 'login_input_readiness'], [2, 'pass', null]]);
    assert.equal(receivedRequests.filter((request) => request.pathname === '/login').length, 2);
    assert.deepEqual(receivedRequests.filter((request) => !['GET', 'HEAD', 'OPTIONS'].includes(request.method)), []);
  });
});

test('Login retry retains the same context mutation gate and blocks writes before the server', async () => {
  await withFixtureServer({ loginTimeoutAttempts: 1, loginRetryUnexpectedWrite: true }, async ({ origin, receivedRequests }) => {
    await assert.rejects(runProductionBrowserSmoke(origin, { loginReadinessTimeoutMs: 100 }), /unexpected writes/);
    assert.equal(receivedRequests.filter((request) => request.pathname === '/login').length, 2);
    assert(!receivedRequests.some((request) => request.pathname === '/retry-write'));
    assert.deepEqual(receivedRequests.filter((request) => !['GET', 'HEAD', 'OPTIONS'].includes(request.method)), []);
  });
});

test('Login retry blocks unexpected external writes before the external server', async () => {
  await withFixtureServer({ loginTimeoutAttempts: 1, loginRetryExternalWrite: true }, async ({ origin, receivedRequests, externalReceivedRequests }) => {
    await assert.rejects(runProductionBrowserSmoke(origin, { loginReadinessTimeoutMs: 100 }), /unexpected writes/);
    assert.equal(receivedRequests.filter((request) => request.pathname === '/login').length, 2);
    assert.deepEqual(externalReceivedRequests, []);
    assert.deepEqual(receivedRequests.filter((request) => !['GET', 'HEAD', 'OPTIONS'].includes(request.method)), []);
  });
});

test('unauthenticated API status mismatch fails immediately without a retry', async () => {
  await withFixtureServer({ apiStatus: 200 }, async ({ origin, receivedRequests }) => {
    await assert.rejects(runProductionBrowserSmoke(origin), /must return HTTP 401/);
    assert.equal(receivedRequests.filter((request) => request.pathname === '/api/proxy-bookings').length, 1);
  });
});

for (const pathname of ['/', '/experiences/42']) {
  test(`real ${pathname} navigation timeout then fresh Page success retains mutation blocking`, async () => {
    await withFixtureServer({ navigationTimeoutPath: pathname, navigationTimeoutAttempts: 1 }, async ({ origin, receivedRequests }) => {
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ serviceWorkers: 'block' });
      const mutationGate = await installProductionMutationGate(context, origin);
      const diagnostics = [];
      try {
        const result = await visitReadOnlyPage(context, origin, pathname, async (page, _pending, waitForReadiness) => {
          await waitForReadiness(page.locator(pathname === '/' ? 'a[href^="/experiences/"]' : 'h1'), { state: 'attached', timeout: 1000 });
          return 'ready';
        }, { mutationGate, attemptDiagnostics: diagnostics, navigationTimeoutMs: 300, log: () => {} });
        assert.equal(result, 'ready');
        assert.deepEqual(diagnostics.map(({ attempt, outcome }) => [attempt, outcome]), [[1, 'retry'], [2, 'pass']]);
        assert.equal(receivedRequests.filter((request) => request.pathname === pathname).length, 2);
        assert.deepEqual(receivedRequests.filter((request) => !['GET', 'HEAD', 'OPTIONS'].includes(request.method)), []);
        assert.deepEqual(mutationGate.blockedUnexpectedWrites, []);
        assert.doesNotMatch(JSON.stringify(diagnostics), /DO_NOT_LOG|\?secret=/);
        assert(diagnostics[0].pendingFirstPartyRequests.some((request) => request.pathname === '/navigation-blocker.js'));
      } finally {
        await context.close();
        await browser.close();
      }
    });
  });
}

test('real navigation timeout twice fails without a third Page/request', async () => {
  await withFixtureServer({ navigationTimeoutPath: '/', navigationTimeoutAttempts: 2 }, async ({ origin, receivedRequests }) => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const mutationGate = await installProductionMutationGate(context, origin);
    const diagnostics = [];
    try {
      await assert.rejects(visitReadOnlyPage(context, origin, '/', async () => 'ready', {
        mutationGate, attemptDiagnostics: diagnostics, navigationTimeoutMs: 300, log: () => {},
      }), errors.TimeoutError);
      assert.equal(diagnostics.length, 2);
      assert.equal(receivedRequests.filter((request) => request.pathname === '/').length, 2);
      assert.deepEqual(diagnostics.map(({ outcome }) => outcome), ['retry', 'fail']);
    } finally {
      await context.close();
      await browser.close();
    }
  });
});
