import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const POLICY_PATH = path.join(
  process.cwd(),
  'config/cloudflare/notification-retention-release-policy.json'
);

export async function readNotificationRetentionReleasePolicy() {
  return JSON.parse(await readFile(POLICY_PATH, 'utf8'));
}

export function resolveNotificationRetentionReleaseProfile(policy, requested) {
  assert.equal(policy.schemaVersion, 1);
  const name = requested || policy.defaultProductionProfile;
  const profile = policy.profiles[name];
  assert(profile, `Unknown Notification retention release profile: ${name}`);
  assert(['true', 'false'].includes(profile.scheduledEnabled));
  return { name, ...profile };
}
