import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const POLICY_PATH = path.join(
  process.cwd(),
  'config/cloudflare/home-popularity-release-policy.json'
);

export async function readHomePopularityReleasePolicy() {
  return JSON.parse(await readFile(POLICY_PATH, 'utf8'));
}

export function resolveHomePopularityReleaseProfile(policy, requested) {
  assert.equal(policy.schemaVersion, 1);
  const name = requested || policy.defaultProductionProfile;
  const profile = policy.profiles[name];
  assert(profile, `Unknown Home popularity release profile: ${name}`);
  assert(['true', 'false'].includes(profile.scheduledEnabled));
  return { name, ...profile };
}
