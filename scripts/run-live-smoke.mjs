import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { spawnSync } from 'child_process';

import { BUNDLES, assertSmokeTarget } from './live-smoke-policy.mjs';

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  return readFileSync(path, 'utf8').split(/\n/).reduce((acc, line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) acc[match[1]] = match[2];
    return acc;
  }, {});
}

const argv = process.argv.slice(2);
const bundleIndex = argv.indexOf('--bundle');
const bundle = bundleIndex >= 0 ? argv[bundleIndex + 1] : undefined;
const selectedBundle = BUNDLES[bundle];

if (!selectedBundle) {
  console.error('Usage: node scripts/run-live-smoke.mjs --bundle <gate|baseline|shared|noisy>');
  process.exit(1);
}
if (selectedBundle.requires === 'shared-surface' && !argv.includes('--ack-shared-surface')) {
  console.error('Refusing to run shared bundle without --ack-shared-surface');
  process.exit(1);
}
if (selectedBundle.requires === 'noisy' && !argv.includes('--ack-noisy')) {
  console.error('Refusing to run noisy bundle without --ack-noisy');
  process.exit(1);
}

const fileEnv = loadEnvFile(resolve('.env.local'));
const isReadOnly = bundle === 'gate';
if (!isReadOnly && Object.keys(fileEnv).some((key) =>
  /(NICEPAY|CLOUDFLARE|DATABASE|PAYPAL|RESEND|STRIPE|PRODUCTION)/i.test(key))) {
  console.error('[live-smoke] isolated .env.local contains provider or production credentials.');
  process.exit(1);
}
const baseURL = isReadOnly
  ? process.env.PLAYWRIGHT_LIVE_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || fileEnv.NEXT_PUBLIC_SITE_URL
  : 'http://127.0.0.1:3100';

try {
  assertSmokeTarget({
    bundle,
    baseURL,
    fileSupabaseURL: fileEnv.NEXT_PUBLIC_SUPABASE_URL,
    fileSiteURL: fileEnv.NEXT_PUBLIC_SITE_URL,
    fileAnonKey: fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    fileServiceRoleKey: fileEnv.SUPABASE_SERVICE_ROLE_KEY,
  });
} catch (error) {
  console.error(`[live-smoke] target blocked: ${error.message}`);
  process.exit(1);
}

// The production smoke process never receives database or provider credentials.
const readOnlyEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  !/(SUPABASE|DATABASE|NICEPAY|SERVICE_ROLE|SECRET|TOKEN|KEY)/i.test(key)));
const childEnv = isReadOnly
  ? { ...readOnlyEnv, PLAYWRIGHT_LIVE_BASE_URL: baseURL }
  : { ...readOnlyEnv,
      NEXT_PUBLIC_SUPABASE_URL: fileEnv.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: fileEnv.SUPABASE_SERVICE_ROLE_KEY,
      CI: '1', NEXT_PUBLIC_SITE_URL: baseURL,
      PLAYWRIGHT_LIVE_BASE_URL: baseURL, E2E_ALLOW_ADMIN_WHITELIST_CLEANUP: 'false' };

mkdirSync(resolve('test-results/live'), { recursive: true });
const command = ['playwright', 'test', ...selectedBundle.specs,
  `--config=${selectedBundle.config}`, '--project=chromium'];

console.log(`[live-smoke] baseURL=${baseURL}`);
console.log(`[live-smoke] bundle=${bundle}`);
console.log(`[live-smoke] specs=${selectedBundle.specs.length}`);
console.log(`[live-smoke] command=npx ${command.join(' ')}`);

const startedAt = new Date().toISOString();
const result = spawnSync('npx', command, { stdio: 'inherit', env: childEnv });
const summary = {
  baseURL, bundle, command: `npx ${command.join(' ')}`,
  description: selectedBundle.description,
  createdSideEffects: selectedBundle.sideEffects,
  cleanupExpectation: selectedBundle.cleanupExpectation,
  pass: result.status === 0,
  exitCode: result.status,
  startedAt, finishedAt: new Date().toISOString(),
  specs: selectedBundle.specs,
};
writeFileSync(resolve('test-results/live/run-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.exit(result.status ?? 1);
