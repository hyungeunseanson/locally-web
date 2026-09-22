import assert from 'node:assert/strict';
import path from 'node:path';
import process from 'node:process';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const DEFAULT_CONFIG_PATH = path.join(ROOT, 'wrangler.jsonc');
const EXPECTED_ROUTE = 'www.locally-travel.com/*';
const EXPECTED_ENVIRONMENT = 'production';
const DEFAULT_QUEUE_BATCH_TIMEOUT_SECONDS = 5;

const MANAGED_FEATURE_VARIABLE = /_ENABLED$/;

function fail(code, diagnostics) {
  diagnostics.add(code);
}

function comparableSet(values) {
  return [...new Set(values)].sort();
}

function sameSet(left, right) {
  return JSON.stringify(comparableSet(left)) === JSON.stringify(comparableSet(right));
}

function bindingKey(binding, targetKey) {
  return `${binding.name}:${binding[targetKey]}`;
}

function expectedQueueConsumer(consumer) {
  return {
    queue: consumer.queue,
    batchSize: consumer.max_batch_size,
    batchTimeoutSeconds: consumer.max_batch_timeout ?? DEFAULT_QUEUE_BATCH_TIMEOUT_SECONDS,
    maxRetries: consumer.max_retries,
    maxConcurrency: consumer.max_concurrency,
    retryDelay: consumer.retry_delay,
    deadLetterQueue: consumer.dead_letter_queue,
  };
}

function remoteQueueConsumer(consumer) {
  return {
    queue: consumer.queue_name,
    batchSize: consumer.settings?.batch_size,
    batchTimeoutSeconds: consumer.settings?.max_wait_time_ms === undefined
      ? DEFAULT_QUEUE_BATCH_TIMEOUT_SECONDS
      : consumer.settings.max_wait_time_ms / 1000,
    maxRetries: consumer.settings?.max_retries,
    maxConcurrency: consumer.settings?.max_concurrency,
    retryDelay: consumer.settings?.retry_delay,
    deadLetterQueue: consumer.dead_letter_queue,
  };
}

function equalQueueConsumer(left, right) {
  return left.queue === right.queue
    && left.batchSize === right.batchSize
    && left.batchTimeoutSeconds === right.batchTimeoutSeconds
    && left.maxRetries === right.maxRetries
    && left.maxConcurrency === right.maxConcurrency
    && left.retryDelay === right.retryDelay
    && left.deadLetterQueue === right.deadLetterQueue;
}

export function buildExpectedProductionContract(config, expectedVariables) {
  assert.equal(config.keep_vars, true, 'Production deploy must preserve dashboard variables with keep_vars=true.');
  const production = config.env?.production;
  assert(production, 'Production Wrangler environment is missing.');
  assert.equal(production.workers_dev, false, 'Production workers_dev must remain false.');
  assert.equal(production.preview_urls, false, 'Production preview_urls must remain false.');
  assert.equal(production.route, undefined, 'Production route must remain dashboard-managed.');
  assert.equal(production.routes, undefined, 'Production routes must remain dashboard-managed.');

  const observability = production.observability ?? {};
  const samplingRate = observability.head_sampling_rate;
  assert.equal(typeof samplingRate, 'number', 'Production observability sampling rate is missing.');

  return {
    workerName: production.name,
    route: EXPECTED_ROUTE,
    observability: {
      enabled: observability.enabled,
      samplingRate,
      logsEnabled: true,
      tracesEnabled: false,
      redactQueryString: observability.redact_query_string,
    },
    services: production.services ?? [],
    queueProducers: production.queues?.producers ?? [],
    queueConsumers: (production.queues?.consumers ?? []).map(expectedQueueConsumer),
    crons: production.triggers?.crons ?? [],
    r2: production.r2_buckets ?? [],
    durableObjects: production.durable_objects?.bindings ?? [],
    variables: expectedVariables,
  };
}

export function verifyProductionDeployContract({
  expected,
  remote,
  allowedPlannedChanges = [],
  allowedPlannedCronAdditions = [],
}) {
  const diagnostics = new Set();
  const allowed = new Set(allowedPlannedChanges);
  const plannedChanges = [];

  const remoteRoutes = remote.routes.map((route) => route.pattern);
  if (!sameSet(remoteRoutes, [expected.route])) fail('route_mismatch', diagnostics);
  if (remote.customDomains.length !== 0) fail('custom_domain_mismatch', diagnostics);
  if (remote.subdomain?.enabled !== false) fail('workers_dev_enabled', diagnostics);
  if (remote.subdomain?.previews_enabled !== false) fail('preview_urls_enabled', diagnostics);

  const remoteObservability = remote.observability ?? {};
  const topLevelSampling = remoteObservability.head_sampling_rate;
  const logsSampling = remoteObservability.logs?.head_sampling_rate ?? topLevelSampling ?? 1;
  const tracesSampling = remoteObservability.traces?.head_sampling_rate ?? topLevelSampling ?? 1;
  if (remoteObservability.enabled !== expected.observability.enabled) {
    fail('observability_enabled_mismatch', diagnostics);
  }
  if ((remoteObservability.logs?.enabled ?? remoteObservability.enabled) !== expected.observability.logsEnabled) {
    fail('observability_logs_enabled_mismatch', diagnostics);
  }
  if (topLevelSampling !== expected.observability.samplingRate
    || logsSampling !== expected.observability.samplingRate
    || tracesSampling !== expected.observability.samplingRate) {
    fail('observability_sampling_mismatch', diagnostics);
  }
  if (remoteObservability.traces?.enabled !== expected.observability.tracesEnabled) {
    fail('observability_traces_enabled_mismatch', diagnostics);
  }
  if (remoteObservability.redact_query_string !== expected.observability.redactQueryString) {
    fail('observability_redaction_mismatch', diagnostics);
  }

  const remoteServiceBindings = remote.bindings.filter((binding) => binding.type === 'service');
  const expectedServices = expected.services
    .map((binding) => `${binding.binding}:${binding.service}:${binding.entrypoint ?? ''}`)
    .sort();
  const actualServices = remoteServiceBindings
    .map((binding) => `${binding.name}:${binding.service}:${binding.entrypoint ?? ''}`)
    .sort();
  if (!sameSet(actualServices, expectedServices)) fail('service_binding_mismatch', diagnostics);

  const expectedProducers = expected.queueProducers
    .map((binding) => `${binding.binding}:${binding.queue}`)
    .sort();
  const actualProducers = remote.bindings
    .filter((binding) => binding.type === 'queue')
    .map((binding) => `${binding.name}:${binding.queue_name}`)
    .sort();
  if (!sameSet(actualProducers, expectedProducers)) fail('queue_producer_mismatch', diagnostics);

  const expectedConsumers = [...expected.queueConsumers].sort((a, b) => a.queue.localeCompare(b.queue));
  const actualConsumers = remote.queueConsumers
    .filter((consumer) => consumer.script === expected.workerName || consumer.service === expected.workerName)
    .map(remoteQueueConsumer)
    .sort((a, b) => a.queue.localeCompare(b.queue));
  if (expectedConsumers.length !== actualConsumers.length
    || expectedConsumers.some((consumer, index) => !equalQueueConsumer(consumer, actualConsumers[index]))) {
    fail('queue_consumer_mismatch', diagnostics);
  }

  const expectedCrons = new Set(expected.crons);
  const remoteCrons = new Set(remote.crons);
  const allowedCronAdditions = new Set(allowedPlannedCronAdditions);
  if ([...allowedCronAdditions].some((cron) => !expectedCrons.has(cron))) {
    fail('allowed_cron_addition_not_expected', diagnostics);
  }
  const unexpectedRemoteCrons = [...remoteCrons].filter((cron) => !expectedCrons.has(cron));
  const missingExpectedCrons = [...expectedCrons].filter((cron) => !remoteCrons.has(cron));
  if (unexpectedRemoteCrons.length > 0) fail('cron_mismatch', diagnostics);
  for (const cron of missingExpectedCrons) {
    if (allowedCronAdditions.has(cron)) {
      plannedChanges.push(`cron:${cron}`);
    } else {
      fail('cron_mismatch', diagnostics);
    }
  }

  const expectedR2 = expected.r2.map((binding) => `${binding.binding}:${binding.bucket_name}`);
  const actualR2 = remote.bindings
    .filter((binding) => binding.type === 'r2_bucket')
    .map((binding) => bindingKey(binding, 'bucket_name'));
  if (!sameSet(actualR2, expectedR2)) fail('r2_binding_mismatch', diagnostics);

  const expectedDurableObjects = expected.durableObjects.map((binding) => bindingKey(binding, 'class_name'));
  const actualDurableObjects = remote.bindings
    .filter((binding) => binding.type === 'durable_object_namespace')
    .map((binding) => bindingKey(binding, 'class_name'));
  if (!sameSet(actualDurableObjects, expectedDurableObjects)) {
    fail('durable_object_binding_mismatch', diagnostics);
  }

  const remotePlainVariables = new Map(
    remote.bindings
      .filter((binding) => binding.type === 'plain_text')
      .map((binding) => [binding.name, binding.text])
  );
  for (const [name, expectedValue] of Object.entries(expected.variables)) {
    let actualValue = remotePlainVariables.get(name);
    if (actualValue === undefined && expectedValue === 'false' && MANAGED_FEATURE_VARIABLE.test(name)) {
      actualValue = 'false';
    }
    if (actualValue === expectedValue) continue;
    const booleanTransition = (actualValue === undefined || actualValue === 'true' || actualValue === 'false')
      && (expectedValue === 'true' || expectedValue === 'false');
    if (allowed.has(name) && booleanTransition) {
      plannedChanges.push(name);
      continue;
    }
    if (allowed.has(name) && name === 'PUBLIC_EXPERIENCE_MEDIA_PRODUCER_EXPERIENCE_IDS') {
      plannedChanges.push(name);
      continue;
    }
    fail(`variable_mismatch:${name}`, diagnostics);
  }
  for (const [name] of remotePlainVariables) {
    if (MANAGED_FEATURE_VARIABLE.test(name) && !(name in expected.variables)) {
      fail(`unexpected_managed_variable:${name}`, diagnostics);
    }
  }

  if (diagnostics.size > 0) {
    throw new Error(`PRODUCTION_DEPLOY_SEMANTIC_PREFLIGHT_FAILED:${[...diagnostics].sort().join(',')}`);
  }

  return {
    status: 'PRODUCTION_DEPLOY_SEMANTIC_PREFLIGHT_PASS',
    route: 'pass',
    observability: 'pass',
    serviceBinding: 'pass',
    queues: 'pass',
    crons: 'pass',
    r2: 'pass',
    durableObjects: 'pass',
    vars: 'pass',
    allowedPlannedChanges: plannedChanges.sort(),
  };
}

async function cloudflareGet(fetchImplementation, apiToken, pathname) {
  const response = await fetchImplementation(`https://api.cloudflare.com/client/v4${pathname}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(`cloudflare_read_failed:${response.status}`);
  }
  return payload.result;
}

export async function readProductionSnapshot({
  accountId,
  apiToken,
  workerName,
  fetchImplementation = fetch,
}) {
  const get = (pathname) => cloudflareGet(fetchImplementation, apiToken, pathname);
  const encodedWorkerName = encodeURIComponent(workerName);
  const serviceEnvironmentBase = `/accounts/${accountId}/workers/services/${encodedWorkerName}/environments/${EXPECTED_ENVIRONMENT}`;
  const scriptBase = `/accounts/${accountId}/workers/scripts/${encodedWorkerName}`;

  const [settings, schedules, routes, subdomain, customDomains, queues] = await Promise.all([
    get(`${scriptBase}/settings`),
    get(`${scriptBase}/schedules`),
    get(`${serviceEnvironmentBase}/routes?show_zonename=true`),
    get(`${serviceEnvironmentBase}/subdomain`),
    get(`/accounts/${accountId}/workers/domains/records?page=0&per_page=100&service=${encodedWorkerName}&environment=${EXPECTED_ENVIRONMENT}`),
    get(`/accounts/${accountId}/queues?per_page=100`),
  ]);

  const queueConsumers = (await Promise.all((queues ?? []).map(async (queue) => {
    const consumers = await get(`/accounts/${accountId}/queues/${queue.queue_id}/consumers`);
    return consumers ?? [];
  }))).flat();

  return {
    routes: (routes ?? []).map((route) => ({ pattern: route.pattern })),
    customDomains: (customDomains ?? []).map((domain) => ({ hostname: domain.hostname })),
    subdomain,
    observability: settings?.observability,
    bindings: (settings?.bindings ?? []).map((binding) => {
      const result = { name: binding.name, type: binding.type };
      for (const key of ['service', 'environment', 'entrypoint', 'queue_name', 'bucket_name', 'class_name']) {
        if (binding[key] !== undefined) result[key] = binding[key];
      }
      if (binding.type === 'plain_text' && MANAGED_FEATURE_VARIABLE.test(binding.name)) {
        result.text = binding.text;
      } else if (binding.type === 'plain_text' && binding.name === 'CLOUDFLARE_DEPLOYMENT_ENV') {
        result.text = binding.text;
      } else if (binding.type === 'plain_text' && binding.name === 'PUBLIC_EXPERIENCE_MEDIA_PRODUCER_EXPERIENCE_IDS') {
        result.text = binding.text;
      }
      return result;
    }),
    crons: (schedules?.schedules ?? []).map((schedule) => schedule.cron),
    queueConsumers,
  };
}

function readWranglerJson(wranglerCommand, argumentsList) {
  const result = spawnSync(wranglerCommand, argumentsList, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error || result.status !== 0) {
    throw new Error('cloudflare_read_credentials_unavailable');
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error('cloudflare_read_credentials_invalid');
  }
}

export function resolveCloudflareReadCredentials({
  environment = process.env,
  wranglerCommand = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler'),
} = {}) {
  const token = environment.CLOUDFLARE_API_TOKEN?.trim()
    || environment.CF_API_TOKEN?.trim()
    || readWranglerJson(wranglerCommand, ['auth', 'token', '--json']).token;
  if (!token) throw new Error('cloudflare_read_credentials_unavailable');

  let accountId = environment.CLOUDFLARE_ACCOUNT_ID?.trim();
  if (!accountId) {
    const whoami = readWranglerJson(wranglerCommand, ['whoami', '--json']);
    if (!Array.isArray(whoami.accounts) || whoami.accounts.length !== 1) {
      throw new Error('cloudflare_account_id_required');
    }
    accountId = whoami.accounts[0].id;
  }
  return { accountId, apiToken: token };
}

export async function runProductionDeploySemanticPreflight({
  expectedVariables,
  allowedPlannedChanges = [],
  allowedPlannedCronAdditions = [],
  configPath = DEFAULT_CONFIG_PATH,
  credentials,
  environment = process.env,
  wranglerCommand,
  fetchImplementation = fetch,
  log = console.log,
}) {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const expected = buildExpectedProductionContract(config, expectedVariables);
  const resolvedCredentials = credentials ?? resolveCloudflareReadCredentials({
    environment,
    ...(wranglerCommand ? { wranglerCommand } : {}),
  });
  const remote = await readProductionSnapshot({
    ...resolvedCredentials,
    workerName: expected.workerName,
    fetchImplementation,
  });
  const result = verifyProductionDeployContract({
    expected,
    remote,
    allowedPlannedChanges,
    allowedPlannedCronAdditions,
  });
  log(JSON.stringify(result));
  return result;
}
