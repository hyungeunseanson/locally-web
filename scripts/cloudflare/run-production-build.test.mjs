import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assertProductionSupabasePublicBuildEnvironment,
  buildProductionEnvironment,
  readProductionMediaBaseUrl,
  readProductionHostProfileMediaBaseUrl,
  readProductionMediaReaderPolicy,
  verifyProductionClientBundle,
} from './run-production-build.mjs';

const EXPECTED_URL = 'https://media-canary.locally-travel.com';
const EXPECTED_PROFILE_URL = 'https://profiles-media.locally-travel.com';

test('fails closed when either required public Supabase build variable is missing', () => {
  const productionUrl = 'https://project.supabase.co';
  const productionAnonKey = 'production-anon-key-that-must-never-be-logged';

  assert.throws(
    () => assertProductionSupabasePublicBuildEnvironment({ NEXT_PUBLIC_SUPABASE_ANON_KEY: productionAnonKey }),
    (error) => error instanceof Error
      && error.message === 'Refusing Production build: required Supabase public build environment is missing.'
      && !error.message.includes(productionAnonKey)
  );
  assert.throws(
    () => assertProductionSupabasePublicBuildEnvironment({ NEXT_PUBLIC_SUPABASE_URL: productionUrl }),
    /Refusing Production build: required Supabase public build environment is missing\./
  );
  assert.throws(
    () => assertProductionSupabasePublicBuildEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: '  ',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: productionAnonKey,
    }),
    /Refusing Production build: required Supabase public build environment is missing\./
  );
});

test('accepts both required public Supabase build variables without exposing their values', () => {
  const environment = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'production-anon-key-that-must-never-be-logged',
  };

  assert.doesNotThrow(() => assertProductionSupabasePublicBuildEnvironment(environment));
});

test('owns the exact Production media URL and injects it only through the Production wrapper', async () => {
  assert.equal(await readProductionMediaBaseUrl(), EXPECTED_URL);
  assert.equal(await readProductionHostProfileMediaBaseUrl(), EXPECTED_PROFILE_URL);
  assert.equal(
    buildProductionEnvironment({}, EXPECTED_URL).NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL,
    EXPECTED_URL
  );
  assert.equal(
    buildProductionEnvironment({}, EXPECTED_URL).NEXT_PUBLIC_CLOUDFLARE_HOST_PROFILE_BASE_URL,
    EXPECTED_PROFILE_URL
  );
  assert.throws(
    () => buildProductionEnvironment({
      NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL: 'https://unexpected.example.com',
    }, EXPECTED_URL),
    /conflicting Production/
  );
  assert.throws(
    () => buildProductionEnvironment({
      NEXT_PUBLIC_CLOUDFLARE_HOST_PROFILE_BASE_URL: 'https://unexpected.example.com',
    }, EXPECTED_URL),
    /conflicting Production public host profile/
  );
});

test('defaults the deterministic reader OFF and validates an explicit build-time rollout', async () => {
  const policy = await readProductionMediaReaderPolicy();
  const disabled = buildProductionEnvironment({}, EXPECTED_URL, policy);
  assert.equal(disabled.NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED, 'false');
  assert.equal(disabled.NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_EXPERIENCE_IDS, '');

  const enabled = buildProductionEnvironment({
    NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED: 'true',
    NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_EXPERIENCE_IDS: '3309',
  }, EXPECTED_URL, policy);
  assert.equal(enabled.NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED, 'true');
  assert.equal(enabled.NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_EXPERIENCE_IDS, '3309');

  for (const invalid of [
    { NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED: 'true' },
    {
      NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED: 'false',
      NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_EXPERIENCE_IDS: '3309',
    },
    {
      NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED: 'true',
      NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_EXPERIENCE_IDS: '*',
    },
  ]) {
    assert.throws(
      () => buildProductionEnvironment(invalid, EXPECTED_URL, policy),
      /deterministic reader/
    );
  }
});

test('fails closed unless the exact URL is present in a generated client bundle', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'locally-production-build-'));
  try {
    await mkdir(path.join(directory, 'chunks'));
    await writeFile(path.join(directory, 'chunks', 'missing.js'), 'globalThis.__media="missing";');
    await assert.rejects(() => verifyProductionClientBundle([EXPECTED_URL, EXPECTED_PROFILE_URL], directory), /not compiled/);
    await writeFile(path.join(directory, 'chunks', 'present.js'), `globalThis.__media=${JSON.stringify(EXPECTED_URL)};`);
    await assert.rejects(() => verifyProductionClientBundle([EXPECTED_URL, EXPECTED_PROFILE_URL], directory), /not compiled/);
    await writeFile(path.join(directory, 'chunks', 'profile.js'), `globalThis.__profile=${JSON.stringify(EXPECTED_PROFILE_URL)};`);
    await verifyProductionClientBundle([EXPECTED_URL, EXPECTED_PROFILE_URL], directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
