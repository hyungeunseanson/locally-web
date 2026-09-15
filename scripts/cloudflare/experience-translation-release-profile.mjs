import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const POLICY_PATH = path.join(process.cwd(), 'config/cloudflare/experience-translation-release-policy.json');
export async function readTranslationReleasePolicy() { return JSON.parse(await readFile(POLICY_PATH, 'utf8')); }
export function resolveTranslationReleaseProfile(policy, requested) {
  assert.equal(policy.schemaVersion, 1);
  const name = requested || policy.defaultProductionProfile;
  const profile = policy.profiles[name];
  assert(profile, `Unknown experience translation release profile: ${name}`);
  assert(['true', 'false'].includes(profile.queueEnabled));
  assert(['true', 'false'].includes(profile.scheduledRecoveryEnabled));
  return { name, ...profile };
}
