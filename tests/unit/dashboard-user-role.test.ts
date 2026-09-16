import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-expect-error The Node strip-types test runner requires the explicit TypeScript extension.
import { resolveDashboardUserRole } from '../../app/utils/dashboardUserRole.ts';

test('prioritizes admin over approved host state', () => {
  assert.equal(resolveDashboardUserRole('admin', 'approved'), 'admin');
  assert.equal(resolveDashboardUserRole(' ADMIN ', 'active'), 'admin');
  assert.equal(resolveDashboardUserRole('guest', 'approved', true), 'admin');
  assert.equal(resolveDashboardUserRole(null, null, true), 'admin');
});

test('recognizes role-based and latest approved or active hosts', () => {
  assert.equal(resolveDashboardUserRole('host', null), 'host');
  assert.equal(resolveDashboardUserRole(null, 'approved'), 'host');
  assert.equal(resolveDashboardUserRole('user', ' ACTIVE '), 'host');
});

test('keeps pending or unknown members as guests', () => {
  assert.equal(resolveDashboardUserRole(null, null), 'guest');
  assert.equal(resolveDashboardUserRole('user', 'pending'), 'guest');
  assert.equal(resolveDashboardUserRole('guest', 'rejected'), 'guest');
});
