import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildExpectedManifest,
  buildSpecifications,
  normalizeInventory,
  pickLatestRowsByUser,
  selectMissingSpecifications,
  validateHostId,
} from './reconcile-public-host-profile-images.mjs';

const hostA = '11111111-1111-4111-8111-111111111111';
const hostB = '22222222-2222-4222-8222-222222222222';
const profileUrl = (hostId, suffix = '1') =>
  `https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/images/profile/${hostId}_${suffix}`;

test('selects the latest application before applying public visibility', () => {
  const rows = [
    { id: 1, user_id: hostA, status: 'approved', profile_photo: profileUrl(hostA), created_at: '2026-01-01T00:00:00Z' },
    { id: 2, user_id: hostA, status: 'rejected', profile_photo: profileUrl(hostA, '2'), created_at: '2026-02-01T00:00:00Z' },
    { id: 3, user_id: hostB, status: 'approved', profile_photo: profileUrl(hostB), created_at: '2026-01-01T00:00:00Z' },
  ];
  assert.equal(pickLatestRowsByUser(rows).length, 2);
  const state = normalizeInventory(rows, []);
  assert.deepEqual(state.inventory.map((item) => item.hostId), [hostB]);
  assert.equal(state.summary.visibleHostCount, 1);
});

test('fails closed to the exact Supabase public images/profile boundary', () => {
  const rows = [
    { id: 1, user_id: hostA, status: 'approved', profile_photo: profileUrl(hostA), created_at: '2026-01-01T00:00:00Z' },
    { id: 2, user_id: hostB, status: 'approved', profile_photo: 'https://lh3.googleusercontent.com/oauth-avatar', created_at: '2026-01-01T00:00:00Z' },
  ];
  const state = normalizeInventory(rows, []);
  assert.deepEqual(state.inventory.map((item) => item.hostId), [hostA]);
  assert.equal(state.summary.unexpectedPhotoCount, 1);
});

test('exclusions prevent a still-public host from being reconciled', () => {
  const rows = [{ id: 1, user_id: hostA, status: 'approved', profile_photo: profileUrl(hostA), created_at: '2026-01-01T00:00:00Z' }];
  const state = normalizeInventory(rows, [hostA]);
  assert.equal(state.inventory.length, 0);
  assert.equal(state.summary.excludedHostCount, 1);
});

test('generates exactly two immutable variants inside the host namespace', () => {
  const manifest = buildExpectedManifest([{ hostId: hostA, originUrl: profileUrl(hostA) }]);
  const specifications = buildSpecifications(manifest);
  assert.equal(specifications.length, 2);
  assert.deepEqual(specifications.map((item) => item.width), [128, 256]);
  for (const item of specifications) {
    assert.match(item.key, new RegExp(`^hosts/${hostA}/[a-f0-9]{12}/avatar-w(?:128|256)-q80\\.webp$`));
  }
});

test('downloads and transforms only explicitly missing expected keys', () => {
  const manifest = buildExpectedManifest([{ hostId: hostA, originUrl: profileUrl(hostA) }]);
  const specifications = buildSpecifications(manifest);
  assert.deepEqual(selectMissingSpecifications(specifications, [specifications[1].key]), [specifications[1]]);
  assert.throws(() => selectMissingSpecifications(specifications, [`hosts/${hostB}/legacy.webp`]), /unexpected key/);
});

test('requires canonical lowercase UUID host namespace', () => {
  assert.equal(validateHostId(hostA), hostA);
  assert.throws(() => validateHostId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'.toUpperCase()), /canonical lowercase UUID/);
  assert.throws(() => validateHostId('../hosts/other'), /canonical lowercase UUID/);
});
