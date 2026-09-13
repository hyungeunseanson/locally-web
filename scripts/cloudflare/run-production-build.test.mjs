import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildProductionEnvironment,
  readProductionMediaBaseUrl,
  verifyProductionClientBundle,
} from './run-production-build.mjs';

const EXPECTED_URL = 'https://media-canary.locally-travel.com';

test('owns the exact Production media URL and injects it only through the Production wrapper', async () => {
  assert.equal(await readProductionMediaBaseUrl(), EXPECTED_URL);
  assert.equal(
    buildProductionEnvironment({}, EXPECTED_URL).NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL,
    EXPECTED_URL
  );
  assert.throws(
    () => buildProductionEnvironment({
      NEXT_PUBLIC_CLOUDFLARE_IMAGE_CANARY_BASE_URL: 'https://unexpected.example.com',
    }, EXPECTED_URL),
    /conflicting Production/
  );
});

test('fails closed unless the exact URL is present in a generated client bundle', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'locally-production-build-'));
  try {
    await mkdir(path.join(directory, 'chunks'));
    await writeFile(path.join(directory, 'chunks', 'missing.js'), 'globalThis.__media="missing";');
    await assert.rejects(() => verifyProductionClientBundle(EXPECTED_URL, directory), /not compiled/);
    await writeFile(path.join(directory, 'chunks', 'present.js'), `globalThis.__media=${JSON.stringify(EXPECTED_URL)};`);
    await verifyProductionClientBundle(EXPECTED_URL, directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
