import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const BUNDLE = path.join(ROOT, '.wrangler/deploy/production/cloudflare-worker.js');
const CRON = '17 19 * * *';
const ADMIN_SUPPORT_CRON = '*/10 * * * *';
const NOTIFICATION_RETENTION_CRON = '31 19 * * *';
const EXPERIENCE_COMPLETION_CRON = '23 */2 * * *';

async function reservePort() {
  const server = http.createServer();
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const address = server.address();
  assert(address && typeof address === 'object');
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function waitFor(predicate, timeoutMs, description) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'locally-translation-runtime-'));
let backend;
let wrangler;
let output = '';
try {
  await readFile(BUNDLE, 'utf8');
  const backendRequests = [];
  backend = http.createServer((request, response) => {
    backendRequests.push(request.url ?? '');
    if (request.url?.startsWith('/rest/v1/rpc/lease_experience_translation_task')) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('[]');
      return;
    }
    if (request.url?.startsWith('/rest/v1/rpc/refresh_experience_popularity_snapshot')) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('20');
      return;
    }
    if (request.url?.startsWith('/rest/v1/rpc/claim_due_admin_support_unread_alert_batches')) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('[]');
      return;
    }
    if (request.url?.startsWith('/rest/v1/rpc/prune_notifications_retention')) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('0');
      return;
    }
    if (request.url?.startsWith('/rest/v1/admin_job_runs')) {
      if (request.method === 'POST') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          id: 1,
          started_at: '2026-09-15T00:00:00.000Z',
          lease_expires_at: '2026-09-15T00:02:00.000Z',
        }));
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(request.url.includes('select=id') ? '{"id":1}' : '[]');
      return;
    }
    if (request.url?.startsWith('/rest/v1/rpc/list_due_experience_completion_candidates')) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('[]');
      return;
    }
    response.writeHead(500, { 'content-type': 'application/json' });
    response.end('{"error":"unexpected_fixture_request"}');
  });
  await new Promise((resolve, reject) => backend.listen(0, '127.0.0.1', resolve).once('error', reject));
  const backendAddress = backend.address();
  assert(backendAddress && typeof backendAddress === 'object');
  const workerPort = await reservePort();
  const configPath = path.join(temporaryDirectory, 'wrangler.jsonc');
  await writeFile(configPath, JSON.stringify({
    name: 'locally-translation-runtime-fixture',
    main: BUNDLE,
    compatibility_date: '2026-03-24',
    compatibility_flags: ['nodejs_compat', 'service_binding_extra_handlers'],
    vars: {
      CLOUDFLARE_DEPLOYMENT_ENV: 'production',
      EXPERIENCE_TRANSLATION_QUEUE_ENABLED: 'true',
      EXPERIENCE_TRANSLATION_SCHEDULED_RECOVERY_ENABLED: 'true',
      HOME_POPULARITY_SNAPSHOT_SCHEDULED_ENABLED: 'true',
      ADMIN_SUPPORT_UNREAD_ALERTS_SCHEDULED_ENABLED: 'true',
      NOTIFICATION_RETENTION_CLEANUP_SCHEDULED_ENABLED: 'true',
      EXPERIENCE_COMPLETION_SCHEDULED_ENABLED: 'true',
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${backendAddress.port}`,
      SUPABASE_SERVICE_ROLE_KEY: 'fixture-service-role',
      GEMINI_API_KEY: 'fixture-gemini-key',
    },
    queues: {
      producers: [{ binding: 'EXPERIENCE_TRANSLATION_QUEUE', queue: 'locally-experience-translation-production' }],
      consumers: [{ queue: 'locally-experience-translation-production', max_batch_size: 1 }],
    },
    triggers: { crons: [CRON, ADMIN_SUPPORT_CRON, NOTIFICATION_RETENTION_CRON, EXPERIENCE_COMPLETION_CRON] },
    rules: [
      { type: 'CompiledWasm', globs: [`${path.dirname(BUNDLE)}/*.wasm`], fallthrough: true },
      { type: 'Data', globs: [`${path.dirname(BUNDLE)}/*.bin`], fallthrough: true },
    ],
  }, null, 2), { mode: 0o600 });

  wrangler = spawn(process.execPath, [
    path.join(ROOT, 'node_modules/wrangler/bin/wrangler.js'),
    'dev', '--config', configPath, '--local', '--ip', '127.0.0.1',
    '--port', String(workerPort), '--test-scheduled', '--log-level', 'log',
  ], {
    cwd: ROOT,
    env: { ...process.env, NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  wrangler.stdout.on('data', (chunk) => { output += chunk.toString(); });
  wrangler.stderr.on('data', (chunk) => { output += chunk.toString(); });
  await waitFor(() => output.includes('Ready on'), 45_000, 'local Worker readiness');

  const scheduledUrl = new URL('/cdn-cgi/local/scheduled', `http://127.0.0.1:${workerPort}`);
  scheduledUrl.searchParams.set('cron', CRON);
  const firstScheduled = await fetch(scheduledUrl);
  assert.equal(firstScheduled.status, 200);
  await waitFor(() => (output.match(/experience_translation_queue_outcome/g) ?? []).length >= 1, 15_000, 'cold Queue outcome');
  assert.equal(backendRequests.filter((request) => request.startsWith('/rest/v1/rpc/lease_experience_translation_task')).length, 2);
  assert.equal(backendRequests.filter((request) => request.startsWith('/rest/v1/rpc/refresh_experience_popularity_snapshot')).length, 1);
  assert.equal(backendRequests.filter((request) => request.startsWith('/rest/v1/rpc/prune_notifications_retention')).length, 0);
  assert.equal(backendRequests.filter((request) => request.startsWith('/rest/v1/rpc/claim_due_admin_support_unread_alert_batches')).length, 0);

  const adminScheduledUrl = new URL('/cdn-cgi/local/scheduled', `http://127.0.0.1:${workerPort}`);
  adminScheduledUrl.searchParams.set('cron', ADMIN_SUPPORT_CRON);
  const adminScheduled = await fetch(adminScheduledUrl);
  assert.equal(adminScheduled.status, 200);
  await waitFor(() => output.includes('admin_support_unread_scheduled'), 15_000, 'cold Admin Support scheduled outcome');
  assert.equal(backendRequests.filter((request) => request.startsWith('/rest/v1/rpc/claim_due_admin_support_unread_alert_batches')).length, 1);

  const completionScheduledUrl = new URL('/cdn-cgi/local/scheduled', `http://127.0.0.1:${workerPort}`);
  completionScheduledUrl.searchParams.set('cron', EXPERIENCE_COMPLETION_CRON);
  const completionScheduled = await fetch(completionScheduledUrl);
  assert.equal(completionScheduled.status, 200);
  await waitFor(() => output.includes('experience_completion_scheduled'), 15_000, 'cold Experience completion scheduled outcome');
  assert.equal(backendRequests.filter((request) => request.startsWith('/rest/v1/rpc/list_due_experience_completion_candidates')).length, 1);
  assert.equal(backendRequests.filter((request) => request.startsWith('/rest/v1/rpc/lease_experience_translation_task')).length, 2);
  assert.equal(backendRequests.filter((request) => request.startsWith('/rest/v1/rpc/refresh_experience_popularity_snapshot')).length, 1);
  assert.equal(backendRequests.filter((request) => request.startsWith('/rest/v1/rpc/claim_due_admin_support_unread_alert_batches')).length, 1);
  assert.equal(backendRequests.filter((request) => request.startsWith('/rest/v1/rpc/prune_notifications_retention')).length, 0);

  const retentionScheduledUrl = new URL('/cdn-cgi/local/scheduled', `http://127.0.0.1:${workerPort}`);
  retentionScheduledUrl.searchParams.set('cron', NOTIFICATION_RETENTION_CRON);
  const retentionScheduled = await fetch(retentionScheduledUrl);
  assert.equal(retentionScheduled.status, 200);
  await waitFor(() => output.includes('notification_retention_cleanup_scheduled'), 15_000, 'cold notification retention scheduled outcome');
  assert.equal(backendRequests.filter((request) => request.startsWith('/rest/v1/rpc/prune_notifications_retention')).length, 1);
  assert.equal(backendRequests.filter((request) => request.startsWith('/rest/v1/rpc/lease_experience_translation_task')).length, 2);
  assert.equal(backendRequests.filter((request) => request.startsWith('/rest/v1/rpc/refresh_experience_popularity_snapshot')).length, 1);
  assert.equal(backendRequests.filter((request) => request.startsWith('/rest/v1/rpc/claim_due_admin_support_unread_alert_batches')).length, 1);

  const unauthorized = await fetch(`http://127.0.0.1:${workerPort}/api/cron/experience-translations`);
  assert.equal(unauthorized.status, 401);
  const secondScheduled = await fetch(scheduledUrl);
  assert.equal(secondScheduled.status, 200);
  await waitFor(() => (output.match(/experience_translation_queue_outcome/g) ?? []).length >= 2, 15_000, 'warm Queue outcome');
  assert.equal(backendRequests.filter((request) => request.startsWith('/rest/v1/rpc/lease_experience_translation_task')).length, 4);
  assert.equal(backendRequests.filter((request) => request.startsWith('/rest/v1/rpc/refresh_experience_popularity_snapshot')).length, 2);
  const applicationLogs = output.split('\n').filter((line) => line.includes('experience_translation_')).join('\n');
  assert(!applicationLogs.includes('fixture-service-role'));
  assert(!applicationLogs.includes('fixture-gemini-key'));
  const completionLogs = output.split('\n').filter((line) => line.includes('experience_completion_')).join('\n');
  assert(!completionLogs.includes('fixture-service-role'));
  assert(!completionLogs.includes('fixture-gemini-key'));
  console.log(JSON.stringify({ coldQueue: 'PASS', coldScheduledHome: 'PASS', coldScheduledAdminSupport: 'PASS', coldScheduledNotificationRetention: 'PASS', coldScheduledExperienceCompletion: 'PASS', exactCronIsolation: 'PASS', afterHttpQueue: 'PASS', leaseRequests: 4, homeRefreshRequests: 2, adminSupportClaimRequests: 1, notificationRetentionRequests: 1, experienceCompletionDueRequests: 1, providerCalls: 0, financialProviderCalls: 0 }));
} catch (error) {
  const diagnostic = output
    .replaceAll('fixture-service-role', '[REDACTED]')
    .replaceAll('fixture-gemini-key', '[REDACTED]')
    .replaceAll(temporaryDirectory, '[TEMP]')
    .slice(-6000);
  if (diagnostic) console.error(diagnostic);
  throw error;
} finally {
  if (wrangler && !wrangler.killed) wrangler.kill('SIGTERM');
  if (backend) await new Promise((resolve) => backend.close(resolve));
  await rm(temporaryDirectory, { recursive: true, force: true });
}
