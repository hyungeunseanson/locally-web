import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { validateReleasePolicy } from './public-experience-media-release-profile.mjs';

const ROOT = process.cwd();
const readJson = async (file) => JSON.parse(await readFile(path.join(ROOT, file), 'utf8'));
const readText = async (file) => readFile(path.join(ROOT, file), 'utf8');

async function listSourceFiles(directory) {
  const entries = await readdir(path.join(ROOT, directory), { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(relative);
    return /\.(?:[cm]?[jt]sx?)$/.test(entry.name) ? [relative] : [];
  }));
  return files.flat();
}

function flattenSecretGroups(secrets) {
  return [
    ...secrets.workerAlways,
    ...secrets.workerCanaryAlways,
    ...Object.values(secrets.workerFeatureStaged).flat(),
    ...secrets.buildOnly,
    ...secrets.runnerOnly,
  ];
}

function collectEnvReferences(source) {
  const names = new Set();
  for (const match of source.matchAll(/process\.env(?:\.([A-Z][A-Z0-9_]*)|\[['"]([A-Z][A-Z0-9_]*)['"]\])/g)) {
    names.add(match[1] || match[2]);
  }
  return names;
}

const [packageJson, lockfile, wrangler, manifest, openNextConfig] = await Promise.all([
  readJson('package.json'),
  readJson('package-lock.json'),
  readJson('wrangler.jsonc'),
  readJson('config/cloudflare/migration-manifest.json'),
  readText('open-next.config.ts'),
]);

assert.equal(packageJson.engines?.node, '24.x');
assert.equal(packageJson.dependencies.next, manifest.runtimePins.next);
assert.equal(packageJson.dependencies.react, manifest.runtimePins.react);
assert.equal(packageJson.dependencies['react-dom'], manifest.runtimePins.reactDom);
assert.equal(packageJson.devDependencies['@opennextjs/cloudflare'], manifest.runtimePins.openNextCloudflare);
assert.equal(packageJson.devDependencies.wrangler, manifest.runtimePins.wrangler);
assert.equal(packageJson.dependencies['@vercel/analytics'], undefined);
assert.equal(lockfile.packages['node_modules/@vercel/analytics'], undefined);
assert.equal(wrangler.compatibility_date, manifest.runtimePins.compatibilityDate);
assert.deepEqual(wrangler.compatibility_flags, ['nodejs_compat', 'global_fetch_strictly_public']);
assert.equal(wrangler.keep_vars, true);
assert.equal(
  manifest.environments.production.publicExperienceMediaBaseUrl,
  'https://media-canary.locally-travel.com'
);
assert.deepEqual(manifest.environmentVariables.productionBuildRequired, [
  'NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL',
  'NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED',
  'NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_EXPERIENCE_IDS',
]);
assert.deepEqual(manifest.publicExperienceMediaReaderPolicy, {
  enabledVariable: 'NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED',
  experienceIdsVariable: 'NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_EXPERIENCE_IDS',
  defaultEnabled: 'false',
  defaultExperienceIds: '',
});
validateReleasePolicy(manifest.publicExperienceMediaReleasePolicy);
assert.equal(packageJson.scripts['cloudflare:build:production'], 'node scripts/cloudflare/run-production-build.mjs');
assert.equal(packageJson.scripts['precloudflare:deploy:production'], undefined);
assert.equal(
  packageJson.scripts['cloudflare:deploy:production'],
  'node scripts/cloudflare/run-production-deploy.mjs'
);
assert.deepEqual(wrangler.assets, {
  directory: '.open-next/assets',
  binding: manifest.bindings.staticAssets,
});

for (const environmentName of ['canary', 'production']) {
  const environment = wrangler.env[environmentName];
  const expected = manifest.environments[environmentName];
  assert.equal(environment.name, expected.worker);
  assert.equal(environment.workers_dev, false);
  assert.equal(environment.preview_urls, false);
  assert.deepEqual(environment.images, { binding: manifest.bindings.images });
  const incrementalCacheBinding = environment.r2_buckets.find(
    (binding) => binding.binding === manifest.bindings.incrementalCacheR2
  );
  assert.equal(incrementalCacheBinding?.bucket_name, expected.incrementalCacheR2);
  assert.equal(environment.services.length, 1);
  assert.equal(environment.services[0].binding, manifest.bindings.selfService);
  assert.equal(environment.services[0].service, expected.worker);
  assert.deepEqual(environment.durable_objects.bindings, [
    {
      name: manifest.bindings.queueDurableObject.binding,
      class_name: manifest.bindings.queueDurableObject.className,
    },
    {
      name: manifest.bindings.tagCacheDurableObject.binding,
      class_name: manifest.bindings.tagCacheDurableObject.className,
    },
  ]);
  assert.deepEqual(environment.migrations[0].new_sqlite_classes, [
    manifest.bindings.queueDurableObject.className,
    manifest.bindings.tagCacheDurableObject.className,
  ]);
  assert.equal(environment.observability.enabled, true);
  assert.equal(environment.observability.redact_query_string, true);
}

assert.equal(wrangler.env.canary.r2_buckets.length, 1);
assert.equal(wrangler.env.canary.queues, undefined);
assert.deepEqual(wrangler.env.production.r2_buckets, [
  {
    binding: manifest.bindings.incrementalCacheR2,
    bucket_name: manifest.environments.production.incrementalCacheR2,
  },
  {
    binding: manifest.bindings.publicExperienceMediaR2,
    bucket_name: manifest.environments.production.publicExperienceMediaR2,
  },
]);
assert.deepEqual(wrangler.env.production.queues, {
  producers: [
    {
      binding: manifest.bindings.publicExperienceMediaQueueProducer,
      queue: manifest.environments.production.publicExperienceMediaQueue,
    },
  ],
  consumers: [
    {
      queue: manifest.environments.production.publicExperienceMediaQueue,
      max_batch_size: manifest.publicExperienceMediaQueuePolicy.maxBatchSize,
      max_retries: manifest.publicExperienceMediaQueuePolicy.maxRetries,
      dead_letter_queue:
        manifest.environments.production.publicExperienceMediaDeadLetterQueue,
      max_concurrency: manifest.publicExperienceMediaQueuePolicy.maxConcurrency,
      retry_delay: manifest.publicExperienceMediaQueuePolicy.retryDelaySeconds,
    },
  ],
});
assert.equal(
  wrangler.env.production.vars[manifest.publicExperienceMediaProducerPolicy.enabledVariable],
  manifest.publicExperienceMediaProducerPolicy.defaultEnabled
);
assert.equal(
  wrangler.env.production.vars[
    manifest.publicExperienceMediaProducerPolicy.experienceIdsVariable
  ],
  manifest.publicExperienceMediaProducerPolicy.defaultExperienceIds
);
assert.equal(
  wrangler.env.canary.vars[manifest.publicExperienceMediaProducerPolicy.enabledVariable],
  undefined
);
assert.equal(
  wrangler.env.canary.vars[
    manifest.publicExperienceMediaProducerPolicy.experienceIdsVariable
  ],
  undefined
);

const incrementalCacheBuckets = Object.values(wrangler.env).map((environment) =>
  environment.r2_buckets.find(
    (binding) => binding.binding === manifest.bindings.incrementalCacheR2
  )?.bucket_name
);
for (const forbiddenBucket of manifest.forbiddenIncrementalCacheR2Buckets) {
  assert(
    !incrementalCacheBuckets.includes(forbiddenBucket),
    `Forbidden incremental-cache R2 bucket is bound: ${forbiddenBucket}`
  );
}

const configuredBuckets = Object.values(wrangler.env)
  .flatMap((environment) => environment.r2_buckets ?? [])
  .map((binding) => binding.bucket_name);

assert(openNextConfig.includes('incrementalCache: r2IncrementalCache'));
assert(openNextConfig.includes('queue: doQueue'));
assert(openNextConfig.includes('tagCache: doShardedTagCache'));
assert(openNextConfig.includes(`baseShardSize: ${manifest.cachePolicy.baseShardSize}`));
assert(openNextConfig.includes('regionalCache: false'));
assert(openNextConfig.includes('enableCacheInterception: false'));
assert(!openNextConfig.includes('purgeCache'));

const applicationSources = await listSourceFiles('app');
const sourceEntries = await Promise.all(applicationSources.map(async (file) => [file, await readText(file)]));
const applicationSource = sourceEntries.map(([, source]) => source).join('\n');
assert(!applicationSource.includes('@vercel/analytics'));
assert(!applicationSource.includes('NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED'));

for (const file of [
  'app/about/aboutLandingAssets.ts',
  'app/become-a-host2/hostLandingAssets.ts',
  'app/sitemap.ts',
]) {
  const source = await readText(file);
  assert(!/(?:node:)?fs(?:\/promises)?/.test(source), `${file} must not inspect the runtime filesystem`);
  assert(!source.includes('process.cwd()'), `${file} must not depend on a Worker working directory`);
}

const declaredEnvNames = new Set([
  ...Object.values(manifest.environmentVariables).flat(),
  ...flattenSecretGroups(manifest.secrets),
  'NODE_ENV',
  'VERCEL_ENV',
  'MOCK_ADMIN_ALERT_EMAILS_FILE',
]);
const referencedEnvNames = new Set();
for (const [, source] of sourceEntries) {
  for (const name of collectEnvReferences(source)) referencedEnvNames.add(name);
}
for (const name of collectEnvReferences(await readText('next.config.ts'))) referencedEnvNames.add(name);

const undeclared = [...referencedEnvNames].filter((name) => !declaredEnvNames.has(name)).sort();
assert.deepEqual(undeclared, [], `Undeclared environment variables: ${undeclared.join(', ')}`);

const result = {
  status: 'LOCALLY_CLOUDFLARE_MIGRATION_READINESS_PASS',
  runtimePins: manifest.runtimePins,
  workers: Object.fromEntries(
    Object.entries(manifest.environments).map(([name, value]) => [name, value.worker])
  ),
  configuredBuckets,
  applicationSourceFilesAudited: applicationSources.length,
  environmentReferencesAudited: referencedEnvNames.size,
};

console.log(JSON.stringify(result, null, 2));
