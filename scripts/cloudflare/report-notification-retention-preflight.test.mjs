import assert from 'node:assert/strict';
import test from 'node:test';

import { summarizeNotificationRetentionPreflight } from './report-notification-retention-preflight.mjs';

test('summarizes the exact protected predicate without exposing candidate identities', () => {
  const rows = [
    { id: 'protected-id', type: 'profile_demographics_required', is_read: false, created_at: '2026-08-01T00:00:00.000Z' },
    { id: 'read-demographics-id', type: 'profile_demographics_required', is_read: true, created_at: '2026-08-01T00:00:01.000Z' },
    { id: 'admin-id', type: 'admin_alert', is_read: false, created_at: '2026-08-01T00:00:02.000Z' },
    { id: 'message-id', type: 'new_message', is_read: true, created_at: '2026-08-01T00:00:03.000Z' },
    { id: 'recent-id', type: 'admin_alert', is_read: true, created_at: '2026-09-01T00:00:00.000Z' },
  ];
  const summary = summarizeNotificationRetentionPreflight(
    rows,
    '2026-08-16T12:00:00.000Z',
    1997
  );
  assert.deepEqual(summary, {
    totalCount: 1997,
    eligibleCount: 3,
    protectedOldUnreadDemographicsCount: 1,
    eligibleTypeCounts: {
      admin_alert: 1,
      new_message: 1,
      profile_demographics_required: 1,
    },
    eligibleReadCount: 2,
    eligibleUnreadCount: 1,
    oldestEligibleAt: '2026-08-01T00:00:01.000Z',
    newestEligibleAt: '2026-08-01T00:00:03.000Z',
    candidateDigest: summary.candidateDigest,
  });
  assert.match(summary.candidateDigest, /^[a-f0-9]{64}$/);
  const serialized = JSON.stringify(summary);
  for (const row of rows) assert(!serialized.includes(row.id));
});
