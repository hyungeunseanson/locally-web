import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const POLICY_PATH = path.join(
  process.cwd(),
  'config/cloudflare/cancel-pending-bookings-release-policy.json'
);

export async function readCancelPendingBookingsReleasePolicy() {
  return JSON.parse(await readFile(POLICY_PATH, 'utf8'));
}

export function resolveCancelPendingBookingsReleaseProfile(policy, requested) {
  assert.equal(policy.schemaVersion, 1);
  const name = requested || policy.defaultProductionProfile;
  const profile = policy.profiles[name];
  assert(profile, `Unknown Cancel Pending Bookings release profile: ${name}`);
  assert(['true', 'false'].includes(profile.scheduledEnabled));
  return { name, ...profile };
}
