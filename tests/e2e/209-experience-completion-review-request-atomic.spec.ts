import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  completeExperienceBookingsIfDueAtomic,
} from '@/app/utils/bookings/completeExperienceBooking';
import { SettlementSyncInfrastructureError } from '@/app/utils/settlementSync/types';

const baseMigrationSource = readFileSync(
  'docs/migrations/v3_40_27_experience_completion_review_request_atomic.sql',
  'utf8'
);
const guardMigrationSource = readFileSync(
  'docs/migrations/v3_40_28_experience_completion_review_request_conflict_guard.sql',
  'utf8'
);
const hostRequestMigrationSource = readFileSync(
  'docs/migrations/v3_40_29_experience_completion_host_guest_review_request.sql',
  'utf8'
);

test.describe('Experience completion review request atomic contract', () => {
  test('keeps completion and the keyed review request in one locked function', () => {
    expect(baseMigrationSource).toMatch(
      /ALTER\s+TABLE\s+public\.notifications[\s\S]*ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+booking_id\s+TEXT/i
    );
    expect(baseMigrationSource).toMatch(
      /CREATE\s+UNIQUE\s+INDEX[\s\S]*ON\s+public\.notifications\s*\(\s*booking_id\s*\)[\s\S]*WHERE\s+type\s*=\s*'review_request'[\s\S]*booking_id\s+IS\s+NOT\s+NULL/i
    );
    expect(guardMigrationSource).toMatch(/FROM\s+public\.bookings[\s\S]*FOR\s+UPDATE/i);
    expect(guardMigrationSource).toMatch(
      /UPDATE\s+public\.bookings[\s\S]*SET\s+status\s*=\s*'completed'[\s\S]*INSERT\s+INTO\s+public\.notifications/i
    );
    expect(guardMigrationSource).toContain("AT TIME ZONE 'Asia/Seoul'");
    expect(guardMigrationSource).toContain("v_due_at >= now()");
    expect(guardMigrationSource).toMatch(
      /IF\s+EXISTS\s*\([\s\S]*FROM\s+public\.notifications\s+AS\s+n[\s\S]*n\.type\s*=\s*'review_request'[\s\S]*n\.booking_id\s*=\s*v_booking\.id[\s\S]*\)\s+THEN/i
    );
    expect(guardMigrationSource).not.toMatch(/ON\s+CONFLICT/i);
  });

  test('exposes the completion function only to service_role', () => {
    expect(guardMigrationSource).toMatch(/LANGUAGE\s+plpgsql[\s\S]*SECURITY\s+DEFINER/i);
    expect(guardMigrationSource).toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.complete_experience_booking_if_due_atomic\(TEXT\)\s+FROM\s+PUBLIC/i
    );
    expect(guardMigrationSource).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.complete_experience_booking_if_due_atomic\(TEXT\)\s+TO\s+service_role/i
    );
    expect(guardMigrationSource).toMatch(
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.complete_experience_booking_if_due_atomic\(TEXT\)\s+FROM\s+anon,\s*authenticated/i
    );
  });

  test('adds the host guest-review request without changing the completion RPC contract', () => {
    expect(hostRequestMigrationSource).toMatch(
      /CREATE\s+UNIQUE\s+INDEX[\s\S]*ON\s+public\.notifications\s*\(\s*booking_id\s*\)[\s\S]*WHERE\s+type\s*=\s*'guest_review_request'[\s\S]*booking_id\s+IS\s+NOT\s+NULL/i
    );
    expect(hostRequestMigrationSource).toMatch(
      /RETURNS\s+TABLE\s*\(\s*booking_id\s+TEXT,\s*order_id\s+TEXT,\s*user_id\s+UUID,\s*already_processed\s+BOOLEAN,\s*not_due\s+BOOLEAN,\s*completed\s+BOOLEAN,\s*notification_created\s+BOOLEAN\s*\)/i
    );
    expect(hostRequestMigrationSource).not.toMatch(
      /DROP\s+FUNCTION[\s\S]*complete_experience_booking_if_due_atomic/i
    );
    expect(hostRequestMigrationSource).toMatch(
      /v_booking\.user_id\s+IS\s+NOT\s+NULL[\s\S]*v_experience_host_id\s+IS\s+NOT\s+NULL[\s\S]*NOT\s+EXISTS\s*\([\s\S]*FROM\s+public\.guest_reviews/i
    );
    expect(hostRequestMigrationSource).toMatch(
      /INSERT\s+INTO\s+public\.notifications[\s\S]*'guest_review_request'[\s\S]*'\/host\/dashboard\?tab=reservations'/i
    );
    expect(hostRequestMigrationSource).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.complete_experience_booking_if_due_atomic\(TEXT\)\s+TO\s+service_role/i
    );
  });

  test('routes every experience completion writer through the shared RPC helpers', () => {
    const batchRoutePaths = [
      'app/api/guest/trips/sync-completed/route.ts',
      'app/api/host/reservations/sync-completed/route.ts',
    ];

    for (const routePath of batchRoutePaths) {
      const source = readFileSync(routePath, 'utf8');
      expect(source).toContain('completeExperienceBookingsIfDueAtomic');
      expect(source).not.toMatch(/\.update\(\{\s*status:\s*'completed'\s*\}\)/);
    }

    const settlementSource = readFileSync(
      'app/utils/settlementSync/experienceCompletion.ts',
      'utf8'
    );
    expect(settlementSource).toContain('completeExperienceBookingsIfDueAtomic');
    expect(settlementSource).toContain('completeExperienceBookingIfDueAtomic');
    expect(settlementSource).not.toMatch(/\.update\(\{\s*status:\s*'completed'\s*\}\)/);

    const helperSource = readFileSync(
      'app/utils/bookings/completeExperienceBooking.ts',
      'utf8'
    );
    expect(helperSource).toContain("'complete_experience_booking_if_due_atomic'");
    expect(helperSource).not.toMatch(/from\('bookings'\)[\s\S]*\.update/);
  });

  test('preserves fulfilled completion results when a sibling RPC fails', async () => {
    const injectedError = { code: 'P0001', message: 'injected completion failure' };
    const fakeClient = {
      rpc: async (_name: string, params: { p_booking_id: string }) => {
        if (params.p_booking_id === 'booking-failed') {
          return { data: null, error: injectedError };
        }

        return {
          data: [{
            booking_id: params.p_booking_id,
            order_id: params.p_booking_id,
            user_id: null,
            already_processed: false,
            not_due: false,
            completed: true,
            notification_created: false,
          }],
          error: null,
        };
      },
    } as unknown as SupabaseClient;

    const result = await completeExperienceBookingsIfDueAtomic(fakeClient, [
      'booking-completed',
      'booking-failed',
    ]);

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      bookingId: 'booking-completed',
      completed: true,
    });
    expect(result.failures).toEqual([{
      bookingId: 'booking-failed',
      error: injectedError,
    }]);
  });

  test('preserves the missing RPC infrastructure error classification in batch results', async () => {
    const fakeClient = {
      rpc: async () => ({
        data: null,
        error: {
          code: 'PGRST202',
          message: 'Could not find the function complete_experience_booking_if_due_atomic',
        },
      }),
    } as unknown as SupabaseClient;

    const result = await completeExperienceBookingsIfDueAtomic(fakeClient, ['booking-1']);

    expect(result.results).toEqual([]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].error).toBeInstanceOf(SettlementSyncInfrastructureError);
  });

  test('processes successful booking refunds before surfacing a sibling completion failure', () => {
    const routePaths = [
      'app/api/guest/trips/sync-completed/route.ts',
      'app/api/host/reservations/sync-completed/route.ts',
    ];

    for (const routePath of routePaths) {
      const source = readFileSync(routePath, 'utf8');
      const batchIndex = source.indexOf('const completionBatch = await');
      const refundIndex = source.indexOf('processSoloGuaranteeRefundsForCompletedBookings({');
      const hostRequestIndex = source.indexOf(
        'deliverHostGuestReviewRequestsForCompletedBookings({'
      );
      const failureIndex = source.indexOf('if (completionBatch.failures.length > 0)');

      expect(batchIndex).toBeGreaterThanOrEqual(0);
      expect(refundIndex).toBeGreaterThan(batchIndex);
      expect(hostRequestIndex).toBeGreaterThan(refundIndex);
      expect(failureIndex).toBeGreaterThan(hostRequestIndex);
    }

    const settlementSource = readFileSync(
      'app/utils/settlementSync/experienceCompletion.ts',
      'utf8'
    );
    const runDueSource = settlementSource.slice(
      settlementSource.indexOf('export async function runExperienceCompletionSync'),
      settlementSource.indexOf('export async function forceExperienceCompletionSync')
    );
    const batchIndex = runDueSource.indexOf('const completionBatch = await');
    const refundIndex = runDueSource.indexOf('processSoloGuaranteeRefundSideEffects');
    const hostRequestIndex = runDueSource.indexOf(
      'processHostGuestReviewRequestSideEffects',
      refundIndex
    );
    const renewIndex = runDueSource.indexOf('await renewLease();', hostRequestIndex);
    const failureIndex = runDueSource.indexOf('if (completionBatch.failures.length > 0)');

    expect(batchIndex).toBeGreaterThanOrEqual(0);
    expect(refundIndex).toBeGreaterThan(batchIndex);
    expect(hostRequestIndex).toBeGreaterThan(refundIndex);
    expect(renewIndex).toBeGreaterThan(hostRequestIndex);
    expect(failureIndex).toBeGreaterThan(renewIndex);
    expect(runDueSource).toContain('candidate_count: candidateCount');
    expect(runDueSource).toContain('booking_ids: completedBookingIds');
    expect(runDueSource).toContain('failed_booking_ids: failedBookingIds');
    expect(runDueSource).toContain('processedCount,');
    expect(runDueSource).toContain('skippedCount,');
  });

  test('processes force-one refunds before renewing its lease', () => {
    const settlementSource = readFileSync(
      'app/utils/settlementSync/experienceCompletion.ts',
      'utf8'
    );
    const forceSource = settlementSource.slice(
      settlementSource.indexOf('export async function forceExperienceCompletionSync')
    );
    const completedBranch = forceSource.slice(
      forceSource.indexOf('if (completionResult.completed)')
    );
    const refundIndex = completedBranch.indexOf('processSoloGuaranteeRefundSideEffects');
    const hostRequestIndex = completedBranch.indexOf(
      'processHostGuestReviewRequestSideEffects'
    );
    const renewIndex = completedBranch.indexOf('await renewLease();');

    expect(refundIndex).toBeGreaterThanOrEqual(0);
    expect(hostRequestIndex).toBeGreaterThan(refundIndex);
    expect(renewIndex).toBeGreaterThan(hostRequestIndex);
  });
});
