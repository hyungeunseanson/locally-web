import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
  buildExpectedProductionContract,
  readProductionSnapshot,
  verifyProductionDeployContract,
} from './verify-production-deploy-contract.mjs';

const config = JSON.parse(readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8'));
const expectedVariables = {
  CLOUDFLARE_DEPLOYMENT_ENV: 'production',
  PUBLIC_EXPERIENCE_MEDIA_PRODUCER_ENABLED: 'true',
  PUBLIC_EXPERIENCE_MEDIA_PRODUCER_EXPERIENCE_IDS: '3071,3309',
  EXPERIENCE_MEDIA_R2_SOURCE_ENABLED: 'true',
  EXPERIENCE_TRANSLATION_QUEUE_ENABLED: 'true',
  EXPERIENCE_TRANSLATION_SCHEDULED_RECOVERY_ENABLED: 'true',
  HOME_POPULARITY_SNAPSHOT_SCHEDULED_ENABLED: 'true',
  ADMIN_SUPPORT_UNREAD_ALERTS_SCHEDULED_ENABLED: 'true',
  NOTIFICATION_RETENTION_CLEANUP_SCHEDULED_ENABLED: 'true',
  EXPERIENCE_COMPLETION_SCHEDULED_ENABLED: 'true',
  SERVICE_COMPLETION_SCHEDULED_ENABLED: 'true',
  CANCEL_PENDING_BOOKINGS_SCHEDULED_ENABLED: 'false',
};
const expected = buildExpectedProductionContract(config, expectedVariables);

function plainVariable(name, text) {
  return { name, text, type: 'plain_text' };
}

function currentProductionSnapshot() {
  return {
    routes: [{ pattern: 'www.locally-travel.com/*' }],
    customDomains: [],
    subdomain: { enabled: false, previews_enabled: false },
    observability: {
      enabled: true,
      head_sampling_rate: 0.1,
      redact_query_string: true,
      logs: { enabled: true, head_sampling_rate: 0.1, persist: true, invocation_logs: true },
      traces: { enabled: false, head_sampling_rate: 0.1, persist: true },
    },
    bindings: [
      { name: 'WORKER_SELF_REFERENCE', type: 'service', service: 'locally-web-opennext-production', environment: 'production' },
      { name: 'PUBLIC_EXPERIENCE_MEDIA_QUEUE', type: 'queue', queue_name: 'locally-public-experience-media-mirror-production' },
      { name: 'EXPERIENCE_TRANSLATION_QUEUE', type: 'queue', queue_name: 'locally-experience-translation-production' },
      { name: 'NEXT_INC_CACHE_R2_BUCKET', type: 'r2_bucket', bucket_name: 'locally-opennext-incremental-cache-production' },
      { name: 'PUBLIC_EXPERIENCE_MEDIA_R2', type: 'r2_bucket', bucket_name: 'locally-public-experience-canary' },
      { name: 'NEXT_CACHE_DO_QUEUE', type: 'durable_object_namespace', class_name: 'DOQueueHandler' },
      { name: 'NEXT_TAG_CACHE_DO_SHARDED', type: 'durable_object_namespace', class_name: 'DOShardedTagCache' },
      ...Object.entries(expectedVariables)
        .filter(([name]) => ![
          'SERVICE_COMPLETION_SCHEDULED_ENABLED',
          'CANCEL_PENDING_BOOKINGS_SCHEDULED_ENABLED',
        ].includes(name))
        .map(([name, text]) => plainVariable(name, text)),
      { name: 'SUPABASE_SERVICE_ROLE_KEY', type: 'secret_text', text: 'must-never-appear' },
    ],
    crons: ['*/10 * * * *', '17 19 * * *', '23 */2 * * *', '31 19 * * *'],
    queueConsumers: [
      {
        script: 'locally-web-opennext-production',
        queue_name: 'locally-experience-translation-production',
        dead_letter_queue: 'locally-experience-translation-dlq-production',
        settings: { batch_size: 1, max_retries: 5, max_wait_time_ms: 5000, max_concurrency: 1, retry_delay: 60 },
      },
      {
        script: 'locally-web-opennext-production',
        queue_name: 'locally-public-experience-media-mirror-production',
        dead_letter_queue: 'locally-public-experience-media-mirror-dlq-production',
        settings: { batch_size: 1, max_retries: 5, max_wait_time_ms: 5000, max_concurrency: 1, retry_delay: 60 },
      },
    ],
  };
}

function verify(
  remote = currentProductionSnapshot(),
  allowedPlannedChanges = ['SERVICE_COMPLETION_SCHEDULED_ENABLED'],
  allowedPlannedCronAdditions = ['7,37 * * * *']
) {
  return verifyProductionDeployContract({
    expected,
    remote,
    allowedPlannedChanges,
    allowedPlannedCronAdditions,
  });
}

function expectFailure(remote, code, allowedPlannedChanges) {
  assert.throws(
    () => verify(remote, allowedPlannedChanges),
    (error) => error.message.startsWith('PRODUCTION_DEPLOY_SEMANTIC_PREFLIGHT_FAILED:')
      && error.message.includes(code)
  );
}

test('accepts the current Production snapshot with only the explicit pending-cleanup Cron addition', () => {
  assert.deepEqual(verify(), {
    status: 'PRODUCTION_DEPLOY_SEMANTIC_PREFLIGHT_PASS',
    route: 'pass',
    observability: 'pass',
    serviceBinding: 'pass',
    queues: 'pass',
    crons: 'pass',
    r2: 'pass',
    durableObjects: 'pass',
    vars: 'pass',
    allowedPlannedChanges: [
      'SERVICE_COMPLETION_SCHEDULED_ENABLED',
      'cron:7,37 * * * *',
    ],
  });
});

test('accepts only the exact dashboard-managed route', () => {
  assert.equal(verify().route, 'pass');
  const missing = currentProductionSnapshot();
  missing.routes = [];
  expectFailure(missing, 'route_mismatch');
  const unexpected = currentProductionSnapshot();
  unexpected.routes = [{ pattern: 'api.locally-travel.com/*' }];
  expectFailure(unexpected, 'route_mismatch');
});

test('rejects workers.dev, Preview URLs, and custom domains', () => {
  for (const mutate of [
    (remote) => { remote.subdomain.enabled = true; },
    (remote) => { remote.subdomain.previews_enabled = true; },
    (remote) => { remote.customDomains = [{ hostname: 'www.locally-travel.com' }]; },
  ]) {
    const remote = currentProductionSnapshot();
    mutate(remote);
    assert.throws(() => verify(remote), /PRODUCTION_DEPLOY_SEMANTIC_PREFLIGHT_FAILED/);
  }
});

test('normalizes top-level and nested observability sampling at 0.1', () => {
  const nested = currentProductionSnapshot();
  assert.equal(verify(nested).observability, 'pass');
  const topLevelOnly = currentProductionSnapshot();
  delete topLevelOnly.observability.logs.head_sampling_rate;
  delete topLevelOnly.observability.traces.head_sampling_rate;
  assert.equal(verify(topLevelOnly).observability, 'pass');
});

test('rejects effective observability sampling of 1', () => {
  const remote = currentProductionSnapshot();
  remote.observability.logs.head_sampling_rate = 1;
  expectFailure(remote, 'observability_sampling_mismatch');
});

test('rejects disabled Production logs', () => {
  const remote = currentProductionSnapshot();
  remote.observability.logs.enabled = false;
  expectFailure(remote, 'observability_logs_enabled_mismatch');
});

test('ignores redundant Production service environment metadata but rejects the wrong service', () => {
  assert.equal(verify().serviceBinding, 'pass');
  const remote = currentProductionSnapshot();
  remote.bindings.find((binding) => binding.name === 'WORKER_SELF_REFERENCE').service = 'wrong-worker';
  expectFailure(remote, 'service_binding_mismatch');

  const entrypoint = currentProductionSnapshot();
  entrypoint.bindings.find((binding) => binding.name === 'WORKER_SELF_REFERENCE').entrypoint = 'WrongEntrypoint';
  expectFailure(entrypoint, 'service_binding_mismatch');
});

test('normalizes the omitted local Queue timeout to the remote 5000ms default', () => {
  assert.equal(verify().queues, 'pass');
});

test('ignores Queue order but rejects retry, concurrency, and DLQ drift', () => {
  const reordered = currentProductionSnapshot();
  reordered.queueConsumers.reverse();
  assert.equal(verify(reordered).queues, 'pass');

  for (const mutate of [
    (consumer) => { consumer.settings.max_retries = 4; },
    (consumer) => { consumer.settings.max_concurrency = 2; },
    (consumer) => { consumer.dead_letter_queue = 'wrong-dlq'; },
  ]) {
    const remote = currentProductionSnapshot();
    mutate(remote.queueConsumers[0]);
    expectFailure(remote, 'queue_consumer_mismatch');
  }
});

test('compares Cron expressions as an exact unordered set', () => {
  const reordered = currentProductionSnapshot();
  reordered.crons.reverse();
  assert.equal(verify(reordered).crons, 'pass');

  const added = currentProductionSnapshot();
  added.crons.push('0 0 * * *');
  expectFailure(added, 'cron_mismatch');
  const removed = currentProductionSnapshot();
  removed.crons.pop();
  expectFailure(removed, 'cron_mismatch');
});

test('allows only the explicitly planned pending-cleanup Cron addition', () => {
  const beforeAddition = currentProductionSnapshot();
  beforeAddition.bindings.push(plainVariable('SERVICE_COMPLETION_SCHEDULED_ENABLED', 'true'));
  assert.deepEqual(
    verify(beforeAddition, [], ['7,37 * * * *']).allowedPlannedChanges,
    ['cron:7,37 * * * *']
  );

  const afterAddition = currentProductionSnapshot();
  afterAddition.bindings.push(plainVariable('SERVICE_COMPLETION_SCHEDULED_ENABLED', 'true'));
  afterAddition.crons.push('7,37 * * * *');
  assert.deepEqual(verify(afterAddition, [], []).allowedPlannedChanges, []);

  assert.throws(
    () => verify(beforeAddition, [], []),
    /cron_mismatch/
  );

  const missingExistingCron = currentProductionSnapshot();
  missingExistingCron.bindings.push(plainVariable('SERVICE_COMPLETION_SCHEDULED_ENABLED', 'true'));
  missingExistingCron.crons = missingExistingCron.crons.filter((cron) => cron !== '31 19 * * *');
  assert.throws(
    () => verify(missingExistingCron, [], ['7,37 * * * *']),
    /cron_mismatch/
  );

  assert.throws(
    () => verify(beforeAddition, [], ['0 0 * * *']),
    /allowed_cron_addition_not_expected/
  );
});

test('rejects R2 and Durable Object target drift', () => {
  const r2 = currentProductionSnapshot();
  r2.bindings.find((binding) => binding.name === 'PUBLIC_EXPERIENCE_MEDIA_R2').bucket_name = 'wrong-bucket';
  expectFailure(r2, 'r2_binding_mismatch');

  const durableObject = currentProductionSnapshot();
  durableObject.bindings.find((binding) => binding.name === 'NEXT_CACHE_DO_QUEUE').class_name = 'WrongClass';
  expectFailure(durableObject, 'durable_object_binding_mismatch');
});

test('accepts unchanged intended variables and an absent or false planned Service flag', () => {
  assert.deepEqual(verify().allowedPlannedChanges, [
    'SERVICE_COMPLETION_SCHEDULED_ENABLED',
    'cron:7,37 * * * *',
  ]);
  const remote = currentProductionSnapshot();
  remote.bindings.push(plainVariable('SERVICE_COMPLETION_SCHEDULED_ENABLED', 'false'));
  assert.deepEqual(verify(remote).allowedPlannedChanges, [
    'SERVICE_COMPLETION_SCHEDULED_ENABLED',
    'cron:7,37 * * * *',
  ]);
});

test('rejects unrelated feature flag drift', () => {
  const remote = currentProductionSnapshot();
  remote.bindings.find((binding) => binding.name === 'HOME_POPULARITY_SNAPSHOT_SCHEDULED_ENABLED').text = 'false';
  expectFailure(remote, 'variable_mismatch:HOME_POPULARITY_SNAPSHOT_SCHEDULED_ENABLED');
});

test('never includes secret values in results or errors', () => {
  const remote = currentProductionSnapshot();
  remote.routes = [];
  let message = '';
  try {
    verify(remote);
  } catch (error) {
    message = error.message;
  }
  assert(!message.includes('must-never-appear'));
  assert(!JSON.stringify(verify()).includes('must-never-appear'));
});

test('Production snapshot reader performs GET-only requests', async () => {
  const methods = [];
  const response = (result) => ({ ok: true, json: async () => ({ success: true, result }) });
  const fetchImplementation = async (url, options) => {
    methods.push(options.method);
    if (url.includes('/settings')) return response({ observability: currentProductionSnapshot().observability, bindings: currentProductionSnapshot().bindings });
    if (url.includes('/schedules')) return response({ schedules: currentProductionSnapshot().crons.map((cron) => ({ cron })) });
    if (url.includes('/routes?')) return response(currentProductionSnapshot().routes);
    if (url.includes('/subdomain')) return response(currentProductionSnapshot().subdomain);
    if (url.includes('/domains/records')) return response([]);
    if (url.endsWith('/queues?per_page=100')) return response([{ queue_id: 'queue-1' }]);
    if (url.endsWith('/queues/queue-1/consumers')) return response(currentProductionSnapshot().queueConsumers);
    throw new Error(`unexpected URL: ${url}`);
  };

  await readProductionSnapshot({
    accountId: 'account-id',
    apiToken: 'not-logged',
    workerName: 'locally-web-opennext-production',
    fetchImplementation,
  });
  assert(methods.length > 0);
  assert(methods.every((method) => method === 'GET'));
});
