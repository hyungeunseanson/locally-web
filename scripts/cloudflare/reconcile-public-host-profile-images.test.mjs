import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildExpectedManifest,
  buildSpecifications,
  normalizeInventory,
  normalizePublicHostProfileSourceUrl,
  pickLatestRowsByUser,
  selectMissingSpecifications,
  validateHostId,
  verifySourceBytes,
} from './reconcile-public-host-profile-images.mjs';

const hostA = '11111111-1111-4111-8111-111111111111';
const hostB = '22222222-2222-4222-8222-222222222222';
const profileUrl = (hostId, suffix = '1') =>
  `https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/images/profile/${hostId}_${suffix}`;
const avatarUrl = (hostId, suffix = 'avatar.jpg') =>
  `https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/avatars/${hostId}/${suffix}`;

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

test('uses the public profile avatar only when the latest visible application has no photo', () => {
  const rows = [
    { id: 1, user_id: hostA, status: 'active', profile_photo: null, created_at: '2026-01-01T00:00:00Z' },
    { id: 2, user_id: hostB, status: 'approved', profile_photo: profileUrl(hostB), created_at: '2026-01-01T00:00:00Z' },
  ];
  const profiles = [
    { id: hostA, avatar_url: avatarUrl(hostA) },
    { id: hostB, avatar_url: avatarUrl(hostB, 'must-not-win.png') },
  ];
  const state = normalizeInventory(rows, [], profiles);
  assert.deepEqual(state.inventory, [
    { hostId: hostA, originUrl: avatarUrl(hostA), sourceKind: 'public-profile-avatar' },
    { hostId: hostB, originUrl: profileUrl(hostB), sourceKind: 'application-profile' },
  ]);
  assert.equal(state.summary.applicationProfileCount, 1);
  assert.equal(state.summary.publicProfileAvatarCount, 1);
});

test('excludes OAuth fallback and rejects URL ambiguity or a different Storage bucket', () => {
  const rows = [
    { id: 1, user_id: hostA, status: 'active', profile_photo: null, created_at: '2026-01-01T00:00:00Z' },
    { id: 2, user_id: hostB, status: 'approved', profile_photo: null, created_at: '2026-01-01T00:00:00Z' },
  ];
  const state = normalizeInventory(rows, [], [
    { id: hostA, avatar_url: 'https://lh3.googleusercontent.com/oauth-avatar' },
    { id: hostB, avatar_url: null },
  ]);
  assert.equal(state.inventory.length, 0);
  assert.equal(state.summary.externalAvatarExcludedCount, 1);
  assert.equal(state.summary.missingPhotoCount, 1);
  for (const unsafe of [
    `${avatarUrl(hostA)}?token=x`,
    `${avatarUrl(hostA)}#fragment`,
    'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/chat-images/private.jpg',
    'https://other.supabase.co/storage/v1/object/public/avatars/user/avatar.jpg',
    'https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/avatars/user/%2e%2e/private.jpg',
  ]) assert.equal(normalizePublicHostProfileSourceUrl(unsafe), null);
});

test('binds every mirrored source path to the public host namespace', () => {
  const crossHostApplication = normalizeInventory([
    { id: 1, user_id: hostA, status: 'approved', profile_photo: profileUrl(hostB), created_at: '2026-01-01T00:00:00Z' },
  ]);
  assert.equal(crossHostApplication.inventory.length, 0);
  assert.equal(crossHostApplication.summary.unexpectedPhotoCount, 1);

  const crossHostAvatar = normalizeInventory([
    { id: 1, user_id: hostA, status: 'active', profile_photo: null, created_at: '2026-01-01T00:00:00Z' },
  ], [], [{ id: hostA, avatar_url: avatarUrl(hostB) }]);
  assert.equal(crossHostAvatar.inventory.length, 0);
  assert.equal(crossHostAvatar.summary.externalAvatarExcludedCount, 1);

  assert.equal(
    normalizePublicHostProfileSourceUrl(avatarUrl(hostB), ['public-profile-avatar'], hostA),
    null,
  );
  assert.equal(
    normalizePublicHostProfileSourceUrl(
      `https://uhinvcydgzqlpnvieyal.supabase.co/storage/v1/object/public/avatars/${hostA}-legacy.jpg`,
      ['public-profile-avatar'],
      hostA,
    )?.sourceKind,
    'public-profile-avatar',
  );
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

test('post-write source verification shares the byte budget and detects same-URL drift', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'locally-profile-source-proof-'));
  const originUrl = avatarUrl(hostA);
  const body = Buffer.from('source-image-fixture');
  const key = buildSpecifications(buildExpectedManifest([{ hostId: hostA, originUrl }]))[0].key;
  const specifications = [{ hostId: hostA, originUrl, sourceKind: 'public-profile-avatar', key, width: 128, quality: 80 }];
  const objects = [{ key, sourceKind: 'public-profile-avatar', sourceBytes: body.length, sourceSha256: createHash('sha256').update(body).digest('hex') }];
  const specificationsPath = path.join(directory, 'specifications.json');
  const objectsPath = path.join(directory, 'objects.json');
  await Promise.all([
    writeFile(specificationsPath, JSON.stringify(specifications)),
    writeFile(objectsPath, JSON.stringify(objects)),
  ]);
  const originalFetch = globalThis.fetch;
  const responseFor = (bytes, includeLength = true) => {
    const response = new Response(bytes, { status: 200, headers: {
      'content-type': 'image/jpeg',
      ...(includeLength ? { 'content-length': String(bytes.length) } : {}),
    } });
    return { ok: response.ok, status: response.status, url: originUrl, headers: response.headers, body: response.body };
  };
  try {
    globalThis.fetch = async () => responseFor(body);
    assert.deepEqual(await verifySourceBytes(specificationsPath, objectsPath, 100), {
      verifiedSourceCount: 1,
      verificationSourceBytes: body.length,
      totalSourceBytes: 100 + body.length,
      verificationSourceAttempts: 1,
    });
    globalThis.fetch = async () => responseFor(Buffer.from('changed'), false);
    await assert.rejects(() => verifySourceBytes(specificationsPath, objectsPath, 0), /source bytes changed/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('managed originals require canonical owner-bound keys and never enter the legacy writer', async () => {
  const { HOST_PROFILE_BASE_URL, hostProfileKey } = await import('../../app/utils/hostProfileMediaContract.mjs');
  const { AVATAR_BASE_URL, avatarKey } = await import('../../app/utils/avatarMediaContract.mjs');
  const url = `${HOST_PROFILE_BASE_URL}/${hostProfileKey(hostA, hostB)}`;
  const avatar = `${AVATAR_BASE_URL}/${avatarKey(hostA, hostB, 'image/webp')}`;
  assert.equal(normalizePublicHostProfileSourceUrl(url, ['application-profile'], hostA)?.sourceKind, 'managed-host-original');
  assert.equal(normalizePublicHostProfileSourceUrl(avatar, ['public-profile-avatar'], hostA)?.sourceKind, 'managed-avatar-original');
  for (const unsafe of [url+'?signature=x',url+'#fragment',url.replace('/profile','/avatar-w128.webp'),url.replace('https://','http://'),url.replace('host-profile-media.', 'evil.'),url.replace('/v1/','/v2/'),url.replace('/profile','/%70rofile'),url+'/',url.replace('https://','https://user@')]) {
    assert.equal(normalizePublicHostProfileSourceUrl(unsafe, ['application-profile'], hostA), null);
  }
  assert.equal(normalizePublicHostProfileSourceUrl(url, ['application-profile'], hostB), null);
  assert.equal(normalizePublicHostProfileSourceUrl(url), null, 'owner is mandatory for R2');
  assert.equal(normalizePublicHostProfileSourceUrl(avatar, ['public-profile-avatar'], hostB), null);
  const state = normalizeInventory([{id:1,user_id:hostA,status:'approved',profile_photo:url}]);
  assert.equal(state.summary.managedOriginalCount,1);
  assert.equal(state.summary.unexpectedPhotoCount,0);
  const legacy = buildExpectedManifest([{hostId:hostA,originUrl:profileUrl(hostA)}]);
  assert.deepEqual(buildExpectedManifest(state.inventory,legacy),legacy);
  assert.throws(()=>buildSpecifications({[hostA]:{...legacy[hostA],originUrl:url}}),/Refusing/);
});

test('scheduled host reconciliation is audit-only after source authority cutover', async () => {
  const {readFile} = await import('node:fs/promises');
  const source = await readFile('.github/workflows/public-host-profile-image-reconciliation.yml','utf8');
  const condition = source.split('  reconcile:')[1].split('runs-on:')[0];
  assert.match(condition,/github.event_name == 'workflow_dispatch' && inputs.action != 'audit'/);
  assert.doesNotMatch(condition,/schedule/);
});

test('managed availability audit is HEAD-only, bounded, and refuses redirects or missing originals', async () => {
  const {verifyManagedOriginals} = await import('./reconcile-public-host-profile-images.mjs');
  const {HOST_PROFILE_BASE_URL,hostProfileKey} = await import('../../app/utils/hostProfileMediaContract.mjs');
  const inventory=[{hostId:hostA,originUrl:`${HOST_PROFILE_BASE_URL}/${hostProfileKey(hostA,hostB)}`,sourceKind:'managed-host-original'}];
  const result=await verifyManagedOriginals(inventory,async(url,options)=>{
    assert.equal(options.method,'HEAD');assert.equal(options.redirect,'manual');
    return new Response(null,{status:200,headers:{'content-length':'10','content-type':'image/jpeg'}});
  });
  assert.equal(result.managedOriginalHeadVerifiedCount,1);
  for(const status of [301,404,503]) await assert.rejects(verifyManagedOriginals(inventory,async()=>new Response(null,{status})),/availability/);
});
