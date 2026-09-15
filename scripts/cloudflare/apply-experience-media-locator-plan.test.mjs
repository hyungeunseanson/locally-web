import assert from 'node:assert/strict';
import test from 'node:test';

import { applyLocatorPlan, buildOptimisticPatchUrl } from './apply-experience-media-locator-plan.mjs';
import { buildExperienceLocatorMigrationPlan, parseLegacyExperienceSourceUrl } from './experience-media-source-migration.mjs';

const sourceUrl = 'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/experiences/experience/11111111-1111-4111-8111-111111111111/hero/a.jpg';
const sourceKeySha256 = parseLegacyExperienceSourceUrl(sourceUrl).sourceKeySha256;
const sourceByteSha256 = 'a'.repeat(64);
const proof = { sourceUrl, r2Key: `originals/v1/${sourceKeySha256.slice(0, 2)}/${sourceKeySha256}/${sourceByteSha256}.jpg`, sourceByteSha256, r2ByteSha256: sourceByteSha256, sourceSize: 4, r2Size: 4 };
const row = { id: 42, photos: [sourceUrl], image_url: null, itinerary: [{ title: 'kept', image_url: sourceUrl }], itinerary_i18n: null };
const plan = buildExperienceLocatorMigrationPlan({ rows: [row], proofs: [proof], createdAt: 'ignored' });

test('prevalidates every selected row before the first optimistic write', async () => {
  let writes = 0;
  const result = await applyLocatorPlan({
    plan, confirmation: plan.planDigest,
    loadRows: async () => [row],
    patchRow: async (change) => { writes += 1; return { id: 42, ...change.after }; },
  });
  assert.deepEqual(result, { selected: 1, updated: 1, conflicts: 0, verified: 1 });
  assert.equal(writes, 1);
  await assert.rejects(() => applyLocatorPlan({
    plan, confirmation: plan.planDigest,
    loadRows: async () => [{ ...row, photos: [] }],
    patchRow: async () => { writes += 1; },
  }), /stale/);
  assert.equal(writes, 1);
});

test('binds the write to all approved old media fields', () => {
  const url = new URL(buildOptimisticPatchUrl('https://example.test', plan.changes[0]));
  assert.equal(url.searchParams.get('id'), 'eq.42');
  assert.equal(url.searchParams.get('photos'), `eq.${JSON.stringify(row.photos)}`);
  assert.equal(url.searchParams.get('image_url'), 'is.null');
  assert.equal(url.searchParams.get('itinerary'), `eq.${JSON.stringify(row.itinerary)}`);
});

test('rejects a tampered digest and optimistic conflict', async () => {
  let writes = 0;
  await assert.rejects(() => applyLocatorPlan({ plan, confirmation: '0'.repeat(64), loadRows: async () => [row], patchRow: async () => { writes += 1; } }), /confirmation/);
  assert.equal(writes, 0);
  await assert.rejects(() => applyLocatorPlan({ plan, confirmation: plan.planDigest, loadRows: async () => [row], patchRow: async () => null }), /conflict/);
  assert.equal(writes, 0);
});
