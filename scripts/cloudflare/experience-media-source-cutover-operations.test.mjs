import assert from 'node:assert/strict';
import test from 'node:test';

import { applyDeletePlan } from './apply-experience-media-source-delete.mjs';
import { buildDeleteCandidatePlan } from './plan-experience-media-source-delete.mjs';
import { parseLegacyExperienceSourceUrl, sha256 } from './experience-media-source-migration.mjs';

const sourceUrl = 'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/experiences/experience/11111111-1111-4111-8111-111111111111/hero/a.jpg';
const source = parseLegacyExperienceSourceUrl(sourceUrl);
const bytes = Buffer.from('exact');
const proof = {
  rows: [{ id: 42, status: 'active', is_active: true, photos: [sourceUrl], image_url: null, itinerary: [], itinerary_i18n: null }],
  proofs: [{ sourceUrl, sourceByteSha256: sha256(bytes), r2ByteSha256: sha256(bytes), sourceSize: bytes.length, r2Size: bytes.length, backupExact: true }],
};
const storage = [{ key: source.key, size: bytes.length, contentType: 'image/jpeg' }];
const migratedRow = { id: 42, photos: ['https://media-canary.locally-travel.com/originals/v1/proof.jpg'], image_url: null, itinerary: [], itinerary_i18n: null };

test('plans only migrated current references with exact R2 and backup proofs', () => {
  const plan = buildDeleteCandidatePlan({ sourceProof: proof, liveRows: [migratedRow], storageObjects: storage, createdAt: 'ignored' });
  assert.equal(plan.objects.length, 1);
  assert.equal(plan.objects[0].classification, 'referenced-migrated');
  assert.equal(plan.objects[0].currentDbRefCount, 0);
  assert.throws(() => buildDeleteCandidatePlan({ sourceProof: proof, liveRows: proof.rows, storageObjects: storage }), /locators remain/);
  assert.throws(() => buildDeleteCandidatePlan({ sourceProof: { ...proof, proofs: [{ ...proof.proofs[0], backupExact: false }] }, liveRows: [migratedRow], storageObjects: storage }), /baseline proof/);
});

test('historical references are retained and canary scope is exact', () => {
  assert.throws(() => buildDeleteCandidatePlan({ sourceProof: proof, liveRows: [migratedRow], storageObjects: storage, historicalKeys: [source.key] }), /No proof-complete/);
  assert.throws(() => buildDeleteCandidatePlan({ sourceProof: proof, liveRows: [migratedRow], storageObjects: storage, experienceId: 99 }), /no approved legacy/);
});

test('preverifies every byte and refcount before the first official Storage delete', async () => {
  const plan = buildDeleteCandidatePlan({ sourceProof: proof, liveRows: [migratedRow], storageObjects: storage, createdAt: 'ignored' });
  let deletes = 0;
  const result = await applyDeletePlan({
    plan, confirmation: plan.planDigest,
    loadLiveObjects: async () => storage,
    loadRows: async () => [migratedRow],
    fetchObject: async () => bytes,
    removeBatch: async (names) => { deletes += names.length; return names.map((name) => ({ name })); },
    objectExists: async () => false,
  });
  assert.deepEqual(result, { planned: 1, preverified: 1, deleted: 1, absentVerified: 1, failed: 0 });
  assert.equal(deletes, 1);

  deletes = 0;
  await assert.rejects(() => applyDeletePlan({
    plan, confirmation: plan.planDigest,
    loadLiveObjects: async () => storage,
    loadRows: async () => [migratedRow],
    fetchObject: async () => Buffer.from('drift'),
    removeBatch: async () => { deletes += 1; },
    objectExists: async () => false,
  }), /SHA drift/);
  assert.equal(deletes, 0);
});

test('rejects plan tampering and live re-reference before deletion', async () => {
  const plan = buildDeleteCandidatePlan({ sourceProof: proof, liveRows: [migratedRow], storageObjects: storage, createdAt: 'ignored' });
  let deletes = 0;
  await assert.rejects(() => applyDeletePlan({
    plan, confirmation: '0'.repeat(64), loadLiveObjects: async () => storage, loadRows: async () => [migratedRow], fetchObject: async () => bytes,
    removeBatch: async () => { deletes += 1; }, objectExists: async () => false,
  }), /confirmation/);
  await assert.rejects(() => applyDeletePlan({
    plan, confirmation: plan.planDigest, loadLiveObjects: async () => storage, loadRows: async () => proof.rows, fetchObject: async () => bytes,
    removeBatch: async () => { deletes += 1; }, objectExists: async () => false,
  }), /became referenced/);
  assert.equal(deletes, 0);
});
