import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, 'config/cloudflare/migration-manifest.json');

function assertNumericAllowlist(experienceIds, profileName) {
  assert(Array.isArray(experienceIds), `${profileName} experience IDs must be an array.`);
  assert(
    experienceIds.every((id) => Number.isSafeInteger(id) && id > 0),
    `${profileName} experience IDs must be positive integers.`
  );
  assert.equal(
    new Set(experienceIds).size,
    experienceIds.length,
    `${profileName} experience IDs must be unique.`
  );
  assert.deepEqual(
    experienceIds,
    [...experienceIds].sort((left, right) => left - right),
    `${profileName} experience IDs must be sorted.`
  );
}

export function validateReleasePolicy(policy) {
  assert(policy && typeof policy === 'object', 'Public media release policy is missing.');
  assert.equal(
    policy.defaultProductionProfile,
    'approved-cohort',
    'The canonical Production deploy must select the approved cohort.'
  );
  assert.deepEqual(
    Object.keys(policy.profiles ?? {}).sort(),
    ['approved-cohort', 'off', 'single-3309'],
    'Only the reviewed public media release profiles are allowed.'
  );

  for (const [profileName, profile] of Object.entries(policy.profiles)) {
    assert(
      profile.enabled === 'true' || profile.enabled === 'false',
      `${profileName} enabled must be exactly true or false.`
    );
    assertNumericAllowlist(profile.experienceIds, profileName);
    assert(
      (profile.enabled === 'true' && profile.experienceIds.length > 0)
        || (profile.enabled === 'false' && profile.experienceIds.length === 0),
      `${profileName} must be enabled with an allowlist or fully OFF.`
    );
  }

  assert.deepEqual(policy.profiles.off, { enabled: 'false', experienceIds: [] });
  assert.deepEqual(policy.profiles['single-3309'], {
    enabled: 'true',
    experienceIds: [3309],
  });
  assert(policy.profiles['approved-cohort'].experienceIds.includes(3309));
  return policy;
}

export async function readReleasePolicy() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  return validateReleasePolicy(manifest.publicExperienceMediaReleasePolicy);
}

export function resolveReleaseProfile(policy, requestedProfile) {
  validateReleasePolicy(policy);
  const profileName = requestedProfile ?? policy.defaultProductionProfile;
  const profile = policy.profiles[profileName];
  assert(profile, `Unknown public media release profile: ${profileName}`);
  return {
    name: profileName,
    enabled: profile.enabled,
    experienceIds: profile.experienceIds.join(','),
    experienceCount: profile.experienceIds.length,
  };
}
