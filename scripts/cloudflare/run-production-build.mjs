import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, 'config/cloudflare/migration-manifest.json');
const CLIENT_ASSET_ROOT = path.join(ROOT, '.open-next/assets/_next/static');

const PRODUCTION_SUPABASE_BUILD_ENV_ERROR =
  'Refusing Production build: required Supabase public build environment is missing.';

export function assertProductionSupabasePublicBuildEnvironment(currentEnvironment) {
  const requiredVariables = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  if (requiredVariables.some((variable) => !currentEnvironment[variable]?.trim())) {
    throw new Error(PRODUCTION_SUPABASE_BUILD_ENV_ERROR);
  }
}

export async function readProductionMediaBaseUrl() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const value = manifest.environments?.production?.publicExperienceMediaBaseUrl;
  assert.equal(
    value,
    'https://media-canary.locally-travel.com',
    'Production public experience media base URL contract is missing or unexpected.'
  );
  return value;
}

export async function readProductionHostProfileMediaBaseUrl() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const value = manifest.environments?.production?.publicHostProfileMediaBaseUrl;
  assert.equal(
    value,
    'https://profiles-media.locally-travel.com',
    'Production public host profile media base URL contract is missing or unexpected.'
  );
  return value;
}

export async function readProductionMediaReaderPolicy() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const policy = manifest.publicExperienceMediaReaderPolicy;
  assert.deepEqual(policy, {
    enabledVariable: 'NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED',
    experienceIdsVariable: 'NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_EXPERIENCE_IDS',
    defaultEnabled: 'false',
    defaultExperienceIds: '',
  }, 'Production deterministic reader defaults are missing or unexpected.');
  return policy;
}

function resolveProductionReaderConfiguration(currentEnvironment, policy) {
  const enabled = currentEnvironment[policy.enabledVariable] ?? policy.defaultEnabled;
  const experienceIds = currentEnvironment[policy.experienceIdsVariable]
    ?? policy.defaultExperienceIds;

  assert(
    enabled === 'true' || enabled === 'false',
    'Production deterministic reader enabled value must be exactly true or false.'
  );
  assert(
    experienceIds === '' || /^\d+(,\d+)*$/.test(experienceIds),
    'Production deterministic reader allowlist must be empty or comma-separated numeric IDs.'
  );
  assert(
    (enabled === 'true' && experienceIds !== '') || (enabled === 'false' && experienceIds === ''),
    'Production deterministic reader must be either enabled with an allowlist or fully OFF.'
  );

  return { enabled, experienceIds };
}

export function buildProductionEnvironment(currentEnvironment, mediaBaseUrl, readerPolicy = {
  enabledVariable: 'NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED',
  experienceIdsVariable: 'NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_EXPERIENCE_IDS',
  defaultEnabled: 'false',
  defaultExperienceIds: '',
}, hostProfileBaseUrl = 'https://profiles-media.locally-travel.com') {
  const configuredValue = currentEnvironment.NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL?.trim();
  if (configuredValue && configuredValue.replace(/\/$/, '') !== mediaBaseUrl) {
    throw new Error('Refusing a conflicting Production public experience media base URL.');
  }
  const configuredProfileValue = currentEnvironment.NEXT_PUBLIC_CLOUDFLARE_HOST_PROFILE_BASE_URL?.trim();
  if (configuredProfileValue && configuredProfileValue.replace(/\/$/, '') !== hostProfileBaseUrl) {
    throw new Error('Refusing a conflicting Production public host profile media base URL.');
  }
  const reader = resolveProductionReaderConfiguration(currentEnvironment, readerPolicy);
  return {
    ...currentEnvironment,
    NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL: mediaBaseUrl,
    NEXT_PUBLIC_CLOUDFLARE_HOST_PROFILE_BASE_URL: hostProfileBaseUrl,
    [readerPolicy.enabledVariable]: reader.enabled,
    [readerPolicy.experienceIdsVariable]: reader.experienceIds,
  };
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(file) : [file];
  }));
  return nested.flat();
}

export async function verifyProductionClientBundle(
  expectedValues,
  assetRoot = CLIENT_ASSET_ROOT,
  valueDescription = 'Production public media base URL'
) {
  const values = Array.isArray(expectedValues) ? expectedValues : [expectedValues];
  const files = (await listFiles(assetRoot)).filter((file) => file.endsWith('.js'));
  assert(files.length > 0, 'Production OpenNext client bundle contains no JavaScript assets.');
  const sources = await Promise.all(files.map((file) => readFile(file, 'utf8')));
  for (const expectedValue of values) {
    assert(
      sources.some((source) => source.includes(expectedValue)),
      `${valueDescription} was not compiled into the client bundle.`
    );
  }
}

export function runOpenNextBuild(environment) {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCommand, ['run', 'cloudflare:build'], {
    cwd: ROOT,
    env: environment,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Production OpenNext build failed with exit code ${result.status}.`);
}

export async function main() {
  assertProductionSupabasePublicBuildEnvironment(process.env);
  const mediaBaseUrl = await readProductionMediaBaseUrl();
  const hostProfileMediaBaseUrl = await readProductionHostProfileMediaBaseUrl();
  const readerPolicy = await readProductionMediaReaderPolicy();
  const environment = buildProductionEnvironment(process.env, mediaBaseUrl, readerPolicy, hostProfileMediaBaseUrl);
  runOpenNextBuild(environment);
  await verifyProductionClientBundle([mediaBaseUrl, hostProfileMediaBaseUrl]);
  await verifyProductionClientBundle(
    environment.NEXT_PUBLIC_SUPABASE_URL.trim(),
    CLIENT_ASSET_ROOT,
    'Production Supabase public URL'
  );
  console.log(JSON.stringify({
    status: 'LOCALLY_CLOUDFLARE_PRODUCTION_BUILD_CONTRACT_PASS',
    publicExperienceMediaBaseUrl: mediaBaseUrl,
    publicHostProfileMediaBaseUrl: hostProfileMediaBaseUrl,
    deterministicReaderEnabled: environment[readerPolicy.enabledVariable],
    deterministicReaderExperienceCount:
      environment[readerPolicy.experienceIdsVariable] === ''
        ? 0
        : environment[readerPolicy.experienceIdsVariable].split(',').length,
  }));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  await main();
}
