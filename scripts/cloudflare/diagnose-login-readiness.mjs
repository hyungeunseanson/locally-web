// Opt-in read-only diagnostic. Never called by build/deploy; never saves HAR,
// headers, query strings, bodies, cookies, credentials, or raw browser errors.
import { pathToFileURL } from 'node:url';
import { chromium, errors } from '@playwright/test';
import { installProductionMutationGate } from './run-production-browser-smoke.mjs';

const PRODUCTION = 'https://www.locally-travel.com';
export function safeNetworkRecord(event, origin) {
  const url = new URL(event.request.url);
  if (url.origin !== origin) return null;
  return { pathname: url.pathname, type: event.type, method: event.request.method };
}

export async function diagnoseLoginReadiness({ origin = PRODUCTION, attempts = 2, javaScriptEnabled = true } = {}) {
  if (origin !== PRODUCTION && !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw new Error('Unsupported diagnostic origin');
  if (![1, 2].includes(attempts)) throw new Error('Diagnostic is bounded to at most two attempts');
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const context = await browser.newContext({ serviceWorkers: 'block', javaScriptEnabled });
      const gate = await installProductionMutationGate(context, origin);
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      const requests = new Map();
      let firstTimestamp;
      cdp.on('Network.requestWillBeSent', event => {
        const safe = safeNetworkRecord(event, origin);
        if (!safe) return;
        firstTimestamp ??= event.timestamp;
        requests.set(event.requestId, { ...safe, started: event.timestamp, responseReceived: false, loadingFinished: false, loadingFailed: false });
      });
      cdp.on('Network.requestServedFromCache', event => {
        const row = requests.get(event.requestId); if (row) row.servedFromCache = true;
      });
      cdp.on('Network.responseReceived', event => {
        const row = requests.get(event.requestId); if (!row) return;
        Object.assign(row, { responseReceived: true, responseMs: Math.round((event.timestamp-row.started)*1000), status: event.response.status,
          protocol: event.response.protocol, fromDiskCache: event.response.fromDiskCache === true, fromServiceWorker: event.response.fromServiceWorker === true });
      });
      cdp.on('Network.loadingFinished', event => {
        const row = requests.get(event.requestId); if (row) Object.assign(row, { loadingFinished: true, durationMs: Math.round((event.timestamp-row.started)*1000), transferBytes: event.encodedDataLength });
      });
      cdp.on('Network.loadingFailed', event => {
        const row = requests.get(event.requestId); if (row) Object.assign(row, { loadingFailed: true, durationMs: Math.round((event.timestamp-row.started)*1000), canceled: event.canceled === true });
      });
      const start = Date.now();
      let domContentLoadedMs = null, inputReadyMs = null, timedOut = false, failed = false;
      let stage = 'navigation';
      try {
        await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        domContentLoadedMs = Date.now()-start;
        stage = 'input_readiness';
        await page.locator('[data-testid="login-modal"] input[type="email"]').waitFor({ state: 'visible', timeout: 45000 });
        inputReadyMs = Date.now()-start;
      } catch (error) {
        failed = true;
        timedOut = error instanceof errors.TimeoutError;
      }
      const elapsedMs = Date.now()-start;
      const state = await Promise.race([
        page.evaluate(() => ({ firstContentMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
          spinnerPresent: Boolean(document.querySelector('.animate-spin')), emailPresent: Boolean(document.querySelector('input[type="email"]')),
          passwordPresent: Boolean(document.querySelector('input[type="password"]')),
          resources: performance.getEntriesByType('resource').filter(r => new URL(r.name).origin === location.origin).map(r => ({
            pathname: new URL(r.name).pathname, transferBytes: r.transferSize, encodedBodyBytes: r.encodedBodySize, decodedBodyBytes: r.decodedBodySize,
            protocol: r.nextHopProtocol, durationMs: Math.round(r.duration) })) })),
        new Promise(resolve => { const timer = setTimeout(() => resolve({ diagnosticsUnavailable: true }), 1500); timer.unref(); }),
      ]).catch(() => ({ diagnosticsUnavailable: true }));
      const network = [...requests.values()].filter(row => ['Document','Script','Font'].includes(row.type)).map(({ started, ...row }) => ({
        ...row, ...(!row.loadingFinished && !row.loadingFailed ? { pendingDurationMs: Math.max(0, elapsedMs-Math.round((started-firstTimestamp)*1000)) } : {}),
      }));
      const result = { attempt, javaScriptEnabled, routing: 'unchanged_global_mutation_gate', domContentLoadedMs, inputReadyMs, timedOut, failed, failureStage: failed ? stage : null, ...state,
        scriptRequests: network.filter(r => r.type === 'Script').length, fontRequests: network.filter(r => r.type === 'Font').length, network,
        blockedExpectedWrites: gate.blockedExpectedWrites.length, blockedExpectedExternalWrites: gate.blockedExpectedExternalWrites.length,
        blockedUnexpectedWrites: gate.blockedUnexpectedWrites.length, blockedUnexpectedExternalWrites: gate.blockedUnexpectedExternalWrites.length };
      results.push(result);
      console.log(JSON.stringify(result));
      await context.close();
      if (result.blockedUnexpectedWrites || result.blockedUnexpectedExternalWrites) break;
    }
  } finally { await browser.close(); }
  return results;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await diagnoseLoginReadiness();
