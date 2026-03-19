import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { spawnSync } from 'child_process';

function loadEnvFile(path) {
  if (!existsSync(path)) return {};

  return readFileSync(path, 'utf8')
    .split(/\n/)
    .reduce((acc, line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (!match) return acc;
      acc[match[1]] = match[2];
      return acc;
    }, {});
}

const argv = process.argv.slice(2);

function getArgValue(flag) {
  const index = argv.indexOf(flag);
  if (index === -1) return null;
  return argv[index + 1] || null;
}

const bundle = getArgValue('--bundle');
const ackSharedSurface = argv.includes('--ack-shared-surface');
const ackNoisy = argv.includes('--ack-noisy');

const BUNDLES = {
  gate: {
    description: 'Production-safe deploy gate bundle.',
    specs: [
      'tests/e2e/43-guest-search-detail-ingress.spec.ts',
      'tests/e2e/56-notification-read-route.spec.ts',
      'tests/e2e/67-analytics-ingest-routes.spec.ts',
      'tests/e2e/09-admin-analytics.spec.ts',
      'tests/e2e/69-admin-role-access.spec.ts',
      'tests/e2e/71-public-host-profile.spec.ts',
    ],
    sideEffects: 'Ephemeral rows only. Cleanup must return codex.* state to zero.',
    cleanupExpectation: 'No shared-surface rows or codex.* leftovers.',
    requires: null,
  },
  shared: {
    description: 'Shared production surfaces with cleanup-only writes.',
    specs: [
      'tests/e2e/17-admin-sidebar.spec.ts',
      'tests/e2e/13-admin-alerts.spec.ts',
      'tests/e2e/15-admin-team.spec.ts',
      'tests/e2e/16-admin-team-chat.spec.ts',
      'tests/e2e/18-admin-team-badge.spec.ts',
      'tests/e2e/54-mobile-notification-badges.spec.ts',
      'tests/e2e/70-admin-audit-logs.spec.ts',
      'tests/e2e/72-review-host-notification.spec.ts',
    ],
    sideEffects: 'Temporary shared-surface rows. Cleanup is required before completion.',
    cleanupExpectation: 'Zero codex.* rows and zero seeded shared-surface rows after cleanup.',
    requires: 'shared-surface',
  },
  noisy: {
    description: 'Production-touching flows that can leave operational noise.',
    specs: [
      'tests/e2e/68-booking-rpc-public-guard.spec.ts',
      'tests/e2e/31-live-guest-trip-cancel.spec.ts',
      'tests/e2e/23-live-guest-post-booking.spec.ts',
      'tests/e2e/05-live-guest-booking-messaging-support.spec.ts',
      'tests/e2e/03-live-host-signup-registration.spec.ts',
      'tests/e2e/04-live-host-experience-create.spec.ts',
    ],
    sideEffects: 'Real operational noise may remain even after cleanup.',
    cleanupExpectation: 'Cleanup best-effort only. Report any remaining booking, notification, or email noise.',
    requires: 'noisy',
  },
};

if (!bundle || !BUNDLES[bundle]) {
  console.error('Usage: node scripts/run-live-smoke.mjs --bundle <gate|shared|noisy> [--ack-shared-surface] [--ack-noisy]');
  process.exit(1);
}

if (BUNDLES[bundle].requires === 'shared-surface' && !ackSharedSurface) {
  console.error('Refusing to run shared bundle without --ack-shared-surface');
  process.exit(1);
}

if (BUNDLES[bundle].requires === 'noisy' && !ackNoisy) {
  console.error('Refusing to run noisy bundle without --ack-noisy');
  process.exit(1);
}

const envFromFile = loadEnvFile(resolve('.env.local'));
const childEnv = { ...process.env, ...envFromFile };
const liveBaseUrl = childEnv.PLAYWRIGHT_LIVE_BASE_URL || childEnv.NEXT_PUBLIC_SITE_URL || null;

if (!liveBaseUrl) {
  console.error('Missing PLAYWRIGHT_LIVE_BASE_URL or NEXT_PUBLIC_SITE_URL.');
  process.exit(1);
}

mkdirSync(resolve('test-results/live'), { recursive: true });

const selectedBundle = BUNDLES[bundle];
const command = [
  'playwright',
  'test',
  ...selectedBundle.specs,
  '--config=playwright.live.config.ts',
  '--project=chromium',
];

console.log(`[live-smoke] baseURL=${liveBaseUrl}`);
console.log(`[live-smoke] bundle=${bundle}`);
console.log(`[live-smoke] specs=${selectedBundle.specs.length}`);
console.log(`[live-smoke] command=npx ${command.join(' ')}`);

const startedAt = new Date().toISOString();
const result = spawnSync('npx', command, {
  stdio: 'inherit',
  env: childEnv,
});
const finishedAt = new Date().toISOString();

const summary = {
  baseURL: liveBaseUrl,
  bundle,
  command: `npx ${command.join(' ')}`,
  description: selectedBundle.description,
  createdSideEffects: selectedBundle.sideEffects,
  cleanupExpectation: selectedBundle.cleanupExpectation,
  pass: result.status === 0,
  exitCode: result.status,
  startedAt,
  finishedAt,
  specs: selectedBundle.specs,
};

writeFileSync(
  resolve('test-results/live/run-summary.json'),
  `${JSON.stringify(summary, null, 2)}\n`,
  'utf8'
);

process.exit(result.status ?? 1);
