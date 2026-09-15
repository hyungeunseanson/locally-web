import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const MANIFEST_PATH = path.join(process.cwd(), 'config/cloudflare/migration-manifest.json');

export function validateExperienceMediaSourceReleasePolicy(policy) {
  assert(policy && typeof policy === 'object', 'Experience media source release policy is missing.');
  assert(policy.defaultProductionProfile === 'off' || policy.defaultProductionProfile === 'on');
  assert.equal(policy.enabledVariable, 'EXPERIENCE_MEDIA_R2_SOURCE_ENABLED');
  assert.equal(policy.rawDefault, 'false');
  return policy;
}

export async function readExperienceMediaSourceReleasePolicy() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  return validateExperienceMediaSourceReleasePolicy(manifest.experienceMediaSourceReleasePolicy);
}

export function resolveExperienceMediaSourceReleaseProfile(policy, requestedProfile) {
  validateExperienceMediaSourceReleasePolicy(policy);
  const name = requestedProfile ?? policy.defaultProductionProfile;
  assert(name === 'off' || name === 'on', `Unknown Experience media source release profile: ${name}`);
  return { name, enabled: name === 'on' ? 'true' : 'false' };
}
