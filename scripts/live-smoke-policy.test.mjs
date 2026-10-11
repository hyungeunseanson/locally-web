import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BUNDLES, assertSmokeTarget } from './live-smoke-policy.mjs';

const isolated = {
  bundle: 'baseline',
  baseURL: 'http://127.0.0.1:3100',
  fileSupabaseURL: 'http://127.0.0.1:54321',
  fileSiteURL: 'http://127.0.0.1:3100',
  fileAnonKey: 'local-anon-key',
  fileServiceRoleKey: 'local-service-role-key',
};

test('Production gate contains only the read-only smoke and retains all prior specs in isolated baseline', () => {
  assert.deepEqual(BUNDLES.gate.specs, ['tests/e2e/271-production-readonly-smoke.spec.ts']);
  assert.deepEqual(BUNDLES.baseline.specs, [
    'tests/e2e/43-guest-search-detail-ingress.spec.ts',
    'tests/e2e/56-notification-read-route.spec.ts',
    'tests/e2e/67-analytics-ingest-routes.spec.ts',
    'tests/e2e/09-admin-analytics.spec.ts',
    'tests/e2e/69-admin-role-access.spec.ts',
    'tests/e2e/71-public-host-profile.spec.ts',
  ]);
  assert.equal(BUNDLES.baseline.config, 'playwright.isolated-release.config.ts');
});

test('Production smoke cannot start a browser or call a write request method', () => {
  const source = readFileSync(new URL('../tests/e2e/271-production-readonly-smoke.spec.ts', import.meta.url), 'utf8');
  const config = readFileSync(new URL('../playwright.production-readonly.config.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\b(?:page|context|browser)\s*\.|\b(?:post|put|patch|delete|fetch)\s*\(/);
  assert.doesNotMatch(config, /globalSetup|webServer/);
});

test('read-only gate requires HTTPS', () => {
  assert.doesNotThrow(() => assertSmokeTarget({ bundle: 'gate', baseURL: 'https://www.locally-travel.com' }));
  assert.throws(() => assertSmokeTarget({ bundle: 'gate', baseURL: 'http://127.0.0.1:3100' }), /HTTPS/);
});

test('write-bearing E2E requires one local app and local Supabase', () => {
  assert.doesNotThrow(() => assertSmokeTarget(isolated));
  for (const changed of [
    { baseURL: 'https://www.locally-travel.com' },
    { fileSupabaseURL: 'https://uhinvcydgzqlpnvieyal.supabase.co' },
    { fileSiteURL: 'https://www.locally-travel.com' },
    { fileAnonKey: '' },
    { fileServiceRoleKey: '' },
  ]) {
    assert.throws(() => assertSmokeTarget({ ...isolated, ...changed }));
  }
});

test('isolated setup rejects a production browser or Supabase target before creating users', async () => {
  const { assertIsolatedReleaseTarget } = await import('../tests/e2e/helpers/productionSupabaseGuard.ts');
  const directory = mkdtempSync(join(tmpdir(), 'locally-isolated-release-'));
  const previousDirectory = process.cwd();
  const names = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SITE_URL', 'PLAYWRIGHT_LIVE_BASE_URL'];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  const values = {
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'local-service-role-key',
    NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3100',
    PLAYWRIGHT_LIVE_BASE_URL: 'http://127.0.0.1:3100',
  };
  try {
    writeFileSync(join(directory, '.env.local'), Object.entries(values)
      .filter(([name]) => name !== 'PLAYWRIGHT_LIVE_BASE_URL')
      .map(([name, value]) => `${name}=${value}`).join('\n'));
    process.chdir(directory);
    Object.assign(process.env, values);
    assert.doesNotThrow(assertIsolatedReleaseTarget);
    process.env.PLAYWRIGHT_LIVE_BASE_URL = 'https://www.locally-travel.com';
    assert.throws(assertIsolatedReleaseTarget, /share the local origin/);
    process.env.PLAYWRIGHT_LIVE_BASE_URL = values.PLAYWRIGHT_LIVE_BASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://uhinvcydgzqlpnvieyal.supabase.co';
    assert.throws(assertIsolatedReleaseTarget, /Production Supabase/);
  } finally {
    process.chdir(previousDirectory);
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
    rmSync(directory, { recursive: true, force: true });
  }
});
