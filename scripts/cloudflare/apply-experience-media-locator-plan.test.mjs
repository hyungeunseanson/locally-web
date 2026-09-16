import assert from 'node:assert/strict';
import test from 'node:test';

import { applyLocatorPlan, buildLocatorCasRpcBody } from './apply-experience-media-locator-plan.mjs';
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
    patchRow: async (change) => { writes += 1; return { outcome: 'updated', row: { id: 42, ...change.after } }; },
  });
  assert.deepEqual(result, {
    selected: 1,
    plannedUpdates: 1,
    alreadyExact: 0,
    updated: 1,
    conflicts: 0,
    notFound: 0,
    verified: 1,
  });
  assert.equal(writes, 1);
  await assert.rejects(() => applyLocatorPlan({
    plan, confirmation: plan.planDigest,
    loadRows: async () => [{ ...row, photos: [] }],
    patchRow: async () => { writes += 1; },
  }), /stale/);
  assert.equal(writes, 1);
});

test('treats rows already at the approved next digest as verified without another write', async () => {
  let writes = 0;
  const result = await applyLocatorPlan({
    plan,
    confirmation: plan.planDigest,
    loadRows: async () => [{ id: row.id, ...plan.changes[0].after }],
    patchRow: async () => { writes += 1; },
  });
  assert.deepEqual(result, {
    selected: 1,
    plannedUpdates: 0,
    alreadyExact: 1,
    updated: 0,
    conflicts: 0,
    notFound: 0,
    verified: 1,
  });
  assert.equal(writes, 0);
});

test('prevalidates a mixed already-exact and pending batch before writing', async () => {
  const secondRow = { ...row, id: 43 };
  const mixedPlan = buildExperienceLocatorMigrationPlan({ rows: [row, secondRow], proofs: [proof], createdAt: 'ignored' });
  let writes = 0;
  const result = await applyLocatorPlan({
    plan: mixedPlan,
    confirmation: mixedPlan.planDigest,
    loadRows: async () => [
      { id: row.id, ...mixedPlan.changes[0].after },
      secondRow,
    ],
    patchRow: async (change) => { writes += 1; return { outcome: 'updated', row: { id: 43, ...change.after } }; },
  });
  assert.deepEqual(result, {
    selected: 2,
    plannedUpdates: 1,
    alreadyExact: 1,
    updated: 1,
    conflicts: 0,
    notFound: 0,
    verified: 2,
  });
  assert.equal(writes, 1);
});

test('binds every approved before and after media field into the RPC body', () => {
  assert.deepEqual(buildLocatorCasRpcBody(plan.changes[0]), {
    p_experience_id: '42',
    p_before_photos: row.photos,
    p_before_image_url: null,
    p_before_itinerary: row.itinerary,
    p_before_itinerary_i18n: null,
    p_after_photos: plan.changes[0].after.photos,
    p_after_image_url: null,
    p_after_itinerary: plan.changes[0].after.itinerary,
    p_after_itinerary_i18n: null,
  });
});

test('rejects a tampered digest, conflict, not-found, and unknown RPC outcome', async () => {
  let writes = 0;
  await assert.rejects(() => applyLocatorPlan({ plan, confirmation: '0'.repeat(64), loadRows: async () => [row], patchRow: async () => { writes += 1; } }), /confirmation/);
  assert.equal(writes, 0);
  await assert.rejects(() => applyLocatorPlan({ plan, confirmation: plan.planDigest, loadRows: async () => [row], patchRow: async () => ({ outcome: 'conflict' }) }), /conflict/);
  await assert.rejects(() => applyLocatorPlan({ plan, confirmation: plan.planDigest, loadRows: async () => [row], patchRow: async () => ({ outcome: 'not_found' }) }), /not found/);
  await assert.rejects(() => applyLocatorPlan({ plan, confirmation: plan.planDigest, loadRows: async () => [row], patchRow: async () => ({ outcome: 'unexpected' }) }), /Unknown/);
  assert.equal(writes, 0);
});

test('accepts an RPC already-exact race as a verified no-op', async () => {
  const result = await applyLocatorPlan({
    plan,
    confirmation: plan.planDigest,
    loadRows: async () => [row],
    patchRow: async (change) => ({ outcome: 'already_exact', row: { id: row.id, ...change.after } }),
  });
  assert.deepEqual(result, {
    selected: 1,
    plannedUpdates: 1,
    alreadyExact: 1,
    updated: 0,
    conflicts: 0,
    notFound: 0,
    verified: 1,
  });
});
