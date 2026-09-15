import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildAllReferencedInventory, buildSourceCopyPlan } from './plan-experience-media-source-copy.mjs';
import { sha256 } from './plan-public-experience-media-repair.mjs';

const owner = '11111111-1111-4111-8111-111111111111';
const base = 'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/experiences/';
const key = `experience/${owner}/hero/example.png`;
const url = `${base}${key}`;
const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1]);

function fixture() {
  const rows = [{ id: 1, status: 'revision', is_active: false, photos: [url], image_url: url, itinerary: [] }];
  const storage = [{ key, size: bytes.length, contentType: 'image/png', etag: 'e', cacheControl: '3600' }];
  return buildAllReferencedInventory(rows, storage);
}

test('all-current-reference source plan finds a missed nonpublic original', async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'source-copy-plan.'));
  try {
    const inventory = fixture();
    const plan = await buildSourceCopyPlan({
      inventory,
      r2Inspection: { originalsBySourceKeySha256: {} },
      outputDirectory: output,
      fetchSource: async () => ({ bytes, contentType: 'image/png' }),
    });
    assert.equal(plan.summary.referencedSources, 1);
    assert.equal(plan.summary.missing, 1);
    assert.equal(plan.summary.sourceBytes, bytes.length);
    assert.match(plan.planDigest, /^[0-9a-f]{64}$/);
    assert.deepEqual(Buffer.from(await readFile(path.join(output, plan.execution.originals[0].path))), bytes);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test('existing exact is skipped and contradictory metadata fails closed', async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'source-copy-plan.'));
  try {
    const inventory = fixture();
    const source = inventory.sources[0];
    const exact = { key: 'unused', size: bytes.length, contentType: 'image/png', cacheControl: 'public, max-age=31536000, immutable', customMetadata: {
      source_key_sha256: source.sourceKeySha256,
      source_byte_sha256: sha256(bytes), output_byte_sha256: sha256(bytes), source_size: String(bytes.length),
    } };
    const plan = await buildSourceCopyPlan({ inventory, r2Inspection: { originalsBySourceKeySha256: { [source.sourceKeySha256]: [exact] } }, outputDirectory: output, fetchSource: async () => { throw new Error('must not fetch'); } });
    assert.equal(plan.summary.existingExact, 1);
    assert.equal(plan.summary.sourceGets, 0);
    await assert.rejects(() => buildSourceCopyPlan({ inventory, r2Inspection: { originalsBySourceKeySha256: { [source.sourceKeySha256]: [{ ...exact, size: 1 }] } }, outputDirectory: output, fetchSource: async () => ({ bytes, contentType: 'image/png' }) }), /conflict/);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test('missing or invalid current references prevent planning', () => {
  assert.throws(() => buildAllReferencedInventory([{ id: 1, status: 'active', is_active: true, photos: [url], itinerary: [] }], []), /must resolve/);
});
