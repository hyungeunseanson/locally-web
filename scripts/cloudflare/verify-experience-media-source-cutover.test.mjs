import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCutoverProof } from './verify-experience-media-source-cutover.mjs';
import { sha256 } from './plan-public-experience-media-repair.mjs';

const owner = '11111111-1111-4111-8111-111111111111';
const key = `experience/${owner}/hero/a.png`;
const url = `https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/experiences/${key}`;
const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const backupIdentity = sha256(`experiences\0${key}`);
const rows = [{ id: 1, status: 'active', is_active: true, photos: [url], image_url: null, itinerary: [] }];
const storage = [{ key, size: bytes.length, contentType: 'image/png', etag: 'e' }];
const baseline = { schema: 'locally.supabase-storage-snapshot.v1', status: 'complete', recoverableUntil: '2026-10-20T00:00:00Z', objects: [{ bucket: 'experiences', key, identity: backupIdentity, sourceSha256: sha256(bytes), size: bytes.length }] };

test('proves current source, encrypted backup, and corresponding R2 bytes independently', async () => {
  const result = await buildCutoverProof({ rows, storageObjects: storage, baselineManifest: baseline,
    fetchSource: async () => ({ bytes, contentType: 'image/png' }),
    fetchR2Object: async () => ({ bytes, contentType: 'image/png' }) });
  assert.equal(result.proofs.length, 1);
  assert.equal(result.backupExactCount, 1);
  assert.equal(result.missingR2.length, 0);
});

test('does not treat a missing R2 object as proof and rejects changed bytes', async () => {
  const missing = await buildCutoverProof({ rows, storageObjects: storage, baselineManifest: baseline,
    fetchSource: async () => ({ bytes, contentType: 'image/png' }), fetchR2Object: async () => null });
  assert.equal(missing.proofs.length, 0);
  assert.equal(missing.missingR2.length, 1);
  assert.equal(missing.backupExactCount, 1);
  await assert.rejects(() => buildCutoverProof({ rows, storageObjects: storage, baselineManifest: baseline,
    fetchSource: async () => ({ bytes, contentType: 'image/png' }), fetchR2Object: async () => ({ bytes: Buffer.from('different'), contentType: 'image/png' }) }), /conflicts/);
});
