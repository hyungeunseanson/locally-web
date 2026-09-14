import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readReleasePolicy,
  resolveReleaseProfile,
  validateReleasePolicy,
} from './public-experience-media-release-profile.mjs';
import {
  buildDeploymentContract,
  parseDeploymentArguments,
} from './run-production-deploy.mjs';

const APPROVED_IDS = [
  3071, 3081, 3188, 3253, 3307, 3308, 3309, 3331, 3343, 3402, 3403,
  3404, 3405, 3410, 3416, 3439, 3496, 3570, 3664, 3861, 4262, 4313,
  4397, 4413, 4414, 4424, 4523, 4597, 4659, 4660, 4811, 4837, 4838,
];

test('owns an exact approved cohort while retaining explicit single-ID and OFF profiles', async () => {
  const policy = await readReleasePolicy();
  assert.deepEqual(policy.profiles['approved-cohort'].experienceIds, APPROVED_IDS);
  assert.deepEqual(resolveReleaseProfile(policy, 'single-3309'), {
    name: 'single-3309',
    enabled: 'true',
    experienceIds: '3309',
    experienceCount: 1,
  });
  assert.deepEqual(resolveReleaseProfile(policy, 'off'), {
    name: 'off',
    enabled: 'false',
    experienceIds: '',
    experienceCount: 0,
  });
});

test('couples reader build values and producer runtime values for every profile', async () => {
  const policy = await readReleasePolicy();
  for (const name of Object.keys(policy.profiles)) {
    const profile = resolveReleaseProfile(policy, name);
    const contract = buildDeploymentContract(profile);
    assert.equal(
      contract.readerEnvironment.NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_ENABLED,
      profile.enabled
    );
    assert.equal(
      contract.readerEnvironment.NEXT_PUBLIC_PUBLIC_EXPERIENCE_MEDIA_READER_EXPERIENCE_IDS,
      profile.experienceIds
    );
    assert(contract.wranglerArguments.includes(
      `PUBLIC_EXPERIENCE_MEDIA_PRODUCER_ENABLED:${profile.enabled}`
    ));
    assert(contract.wranglerArguments.includes(
      `PUBLIC_EXPERIENCE_MEDIA_PRODUCER_EXPERIENCE_IDS:${profile.experienceIds}`
    ));
  }
});

test('defaults canonical Production deploy to the approved cohort and rejects ad-hoc flags', async () => {
  const policy = await readReleasePolicy();
  assert.equal(resolveReleaseProfile(policy).name, 'approved-cohort');
  assert.deepEqual(parseDeploymentArguments([]), {
    requestedProfile: undefined,
    dryRun: false,
  });
  assert.deepEqual(parseDeploymentArguments(['--media-profile=off', '--dry-run']), {
    requestedProfile: 'off',
    dryRun: true,
  });
  assert.throws(() => parseDeploymentArguments(['--var', 'X:Y']), /Unsupported/);
  assert.throws(() => resolveReleaseProfile(policy, 'wildcard'), /Unknown/);
});

test('fails closed for malformed, duplicate, unsorted, wildcard, or uncoupled profiles', () => {
  const base = {
    defaultProductionProfile: 'approved-cohort',
    profiles: {
      off: { enabled: 'false', experienceIds: [] },
      'single-3309': { enabled: 'true', experienceIds: [3309] },
      'approved-cohort': { enabled: 'true', experienceIds: [3309] },
    },
  };
  for (const invalidProfile of [
    { enabled: 'true', experienceIds: [] },
    { enabled: 'false', experienceIds: [3309] },
    { enabled: 'true', experienceIds: [3309, 3309] },
    { enabled: 'true', experienceIds: [3309, 3071] },
    { enabled: 'true', experienceIds: ['*'] },
  ]) {
    assert.throws(() => validateReleasePolicy({
      ...base,
      profiles: { ...base.profiles, 'approved-cohort': invalidProfile },
    }));
  }
});

test('dry-run preserves the exact deployment contract without changing the profile', async () => {
  const policy = await readReleasePolicy();
  const profile = resolveReleaseProfile(policy, 'single-3309');
  const contract = buildDeploymentContract(profile, { dryRun: true });
  assert.equal(contract.wranglerArguments.at(-1), '--dry-run');
  assert(contract.wranglerArguments.includes('CLOUDFLARE_DEPLOYMENT_ENV:production'));
  assert(!contract.wranglerArguments.some((argument) => argument.includes('*')));
});
