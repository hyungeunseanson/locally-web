import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';

// @ts-expect-error The Node strip-types test runner requires the explicit TypeScript extension.
import { calculateServicePricing, SERVICE_MAX_TOTAL_HOURS, validateServiceSchedule } from '../../app/utils/services/concierge.ts';

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = `${directory}/${name}`;
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    return /\.(?:ts|tsx)$/.test(name) ? [path] : [];
  });
}

test('uses KRW 35,000/hour only for general requests with 1–5 guests', () => {
  const oneGuest = calculateServicePricing({ serviceType: 'general', guestCount: 1, totalHours: 40 });
  const fiveGuests = calculateServicePricing({ serviceType: 'general', guestCount: 5, totalHours: 40 });

  assert.deepEqual(oneGuest, {
    tier: 'standard',
    reason: 'standard',
    hourlyRate: 35_000,
    totalPrice: 1_400_000,
  });
  assert.equal(fiveGuests.hourlyRate, 35_000);
  assert.equal(fiveGuests.totalPrice, 1_400_000);
});

test('uses KRW 55,000/hour for business or 6+ guests without stacking', () => {
  const business = calculateServicePricing({ serviceType: 'business', guestCount: 2, totalHours: 40 });
  const group = calculateServicePricing({ serviceType: 'general', guestCount: 6, totalHours: 40 });
  const both = calculateServicePricing({ serviceType: 'business', guestCount: 6, totalHours: 40 });

  assert.equal(business.hourlyRate, 55_000);
  assert.equal(group.hourlyRate, 55_000);
  assert.equal(both.hourlyRate, 55_000);
  assert.equal(both.totalPrice, 2_200_000);
  assert.equal(both.reason, 'business_and_group_6_plus');
});

test('accepts a 40-hour multi-date request and the 168-hour upper boundary', () => {
  const fortyHours = validateServiceSchedule([
    { serviceDate: '2030-01-02', startTime: '09:00', durationHours: 20 },
    { serviceDate: '2030-01-03', startTime: '09:30', durationHours: 20 },
  ], { today: '2030-01-01' });
  const maxHours = validateServiceSchedule(
    Array.from({ length: 7 }, (_, index) => ({
      serviceDate: `2030-02-0${index + 1}`,
      startTime: '00:00',
      durationHours: 24,
    })),
    { today: '2030-01-01' }
  );

  assert.equal(fortyHours.success, true);
  if (fortyHours.success) assert.equal(fortyHours.totalHours, 40);
  assert.equal(maxHours.success, true);
  if (maxHours.success) assert.equal(maxHours.totalHours, SERVICE_MAX_TOTAL_HOURS);
});

test('rejects invalid duration, duplicate or overlapping dates, invalid starts, and totals over 168 hours', () => {
  const cases = [
    [{ serviceDate: '2030-01-02', startTime: '09:00', durationHours: 25 }],
    [
      { serviceDate: '2030-01-02', startTime: '09:00', durationHours: 3 },
      { serviceDate: '2030-01-02', startTime: '13:00', durationHours: 3 },
    ],
    [{ serviceDate: '2030-01-02', startTime: '09:15', durationHours: 3 }],
    [
      { serviceDate: '2030-01-02', startTime: '09:30', durationHours: 24 },
      { serviceDate: '2030-01-03', startTime: '09:00', durationHours: 3 },
    ],
    Array.from({ length: 8 }, (_, index) => ({
      serviceDate: `2030-03-${String(index + 1).padStart(2, '0')}`,
      startTime: '00:00',
      durationHours: index === 7 ? 3 : 24,
    })),
  ];

  for (const schedule of cases) {
    assert.equal(validateServiceSchedule(schedule, { today: '2030-01-01' }).success, false);
  }
});

test('release contract keeps marketplace disabled and the application on server DTO boundaries', () => {
  const migration = readFileSync('supabase/migrations/20260912050655_service_concierge_assignment.sql', 'utf8');
  const applicationRoute = readFileSync('app/api/services/applications/route.ts', 'utf8');
  const selectHostRoute = readFileSync('app/api/services/select-host/route.ts', 'utf8');
  const refundReconciliationRoute = readFileSync('app/api/admin/service-refunds/reconcile/route.ts', 'utf8');
  const requestReadRoute = readFileSync('app/api/services/requests/route.ts', 'utf8');
  const membershipHook = readFileSync('app/hooks/useLocallyMembership.ts', 'utf8');
  const serviceDetail = readFileSync('app/services/[requestId]/ServiceRequestClient.tsx', 'utf8');
  const releaseJourney = readFileSync(
    'tests/e2e/191-service-bank-open-match-chat-journey.spec.ts',
    'utf8'
  );
  const directClientTableAccess = listSourceFiles('app').filter((path) => {
    const source = readFileSync(path, 'utf8');
    return (
      source.trimStart().startsWith("'use client'") &&
      /\.from\(['"]service_(?:requests|bookings|applications)['"]\)/.test(source)
    );
  });

  assert.match(migration, /premium' THEN 55000 ELSE 35000/);
  assert.match(migration, /pricing_tier = 'standard' THEN 20000/);
  assert.match(migration, /CHECK \(guest_count BETWEEN 1 AND 100\)/);
  assert.match(migration, /IF p_guest_count NOT BETWEEN 1 AND 10 THEN/);
  assert.match(
    migration,
    /legacy_imported AND duration_hours BETWEEN 3 AND 168[\s\S]*?NOT legacy_imported AND duration_hours BETWEEN 3 AND 24/
  );
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.create_service_request_with_booking_atomic[\s\S]*?INSERT INTO public\.service_request_schedule_items/
  );
  assert.match(migration, /already_assigned BOOLEAN/);
  assert.match(migration, /SVC_ALREADY_ASSIGNED/);
  assert.match(migration, /confirm_service_concierge_payment_atomic/);
  assert.match(migration, /jsonb_to_recordset\(v_parsed_schedule\)/);
  assert.doesNotMatch(migration, /tmp_service_schedule/);
  assert.match(migration, /INSERT INTO public\.inquiries AS target_inquiry/);
  assert.match(migration, /SVC_REFUND_FORBIDDEN/);
  assert.match(migration, /lower\(trim\(p_payment_method\)\) = 'bank'/);
  assert.match(migration, /RAISE EXCEPTION 'SVC_INVALID_PAYMENT_METHOD'/);
  assert.match(migration, /JOIN auth\.users au ON lower\(au\.email\) = lower\(aw\.email\)/);
  assert.match(migration, /COMMENT ON COLUMN public\.service_assignment_history\.host_id IS/);
  assert.match(migration, /COMMENT ON COLUMN public\.service_assignment_history\.assigned_by IS/);
  assert.match(migration, /COMMENT ON COLUMN public\.service_refund_operations\.initiated_by IS/);
  assert.match(applicationRoute, /status: 410/);
  assert.match(selectHostRoute, /status: 410/);
  assert.match(refundReconciliationRoute, /providerVerified !== true/);
  assert.match(refundReconciliationRoute, /finish_service_refund_operation_atomic/);
  assert.doesNotMatch(refundReconciliationRoute, /cancelCardPayment|refundPayPalCapture/);
  assert.match(requestReadRoute, /user_id: undefined/);
  assert.match(requestReadRoute, /selected_host_id: undefined/);
  assert.match(membershipHook, /fetch\('\/api\/account\/membership'/);
  assert.doesNotMatch(membershipHook, /createClient|fetchLocallyMembershipSummary/);
  assert.match(serviceDetail, /CUSTOMER_CHAT_COPY/);
  assert.match(serviceDetail, /isOwner \? copy\.hostChat : CUSTOMER_CHAT_COPY\[lang\]/);
  assert.match(releaseJourney, /manager inquiry, direct host assignment, and dedicated chat/);
  assert.match(releaseJourney, /\/api\/admin\/service-requests\/\$\{fixture\.requestId\}\/assign-host/);
  assert.doesNotMatch(releaseJourney, /\/services\/\$\{fixture\.requestId\}\/apply/);
  assert.doesNotMatch(releaseJourney, /\/api\/services\/select-host/);
  assert.deepEqual(directClientTableAccess, []);
  assert.equal(existsSync('app/services/ServiceJobBoardClient.tsx'), false);
});
