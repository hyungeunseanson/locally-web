import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const POLICY_PATH = path.join(
  process.cwd(),
  'config/cloudflare/experience-completion-release-policy.json'
);

export async function readExperienceCompletionReleasePolicy() {
  return JSON.parse(await readFile(POLICY_PATH, 'utf8'));
}

export function resolveExperienceCompletionReleaseProfile(policy, requested) {
  assert.equal(policy.schemaVersion, 1);
  const name = requested || policy.defaultProductionProfile;
  const profile = policy.profiles[name];
  assert(profile, `Unknown Experience completion release profile: ${name}`);
  assert(['true', 'false'].includes(profile.scheduledEnabled));
  return { name, ...profile };
}
