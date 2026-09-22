import type { SupabaseClient } from '@supabase/supabase-js';

import {
  finishSettlementSyncRunFailure,
  finishSettlementSyncRunSuccess,
  renewSettlementSyncRunLease,
  startSettlementSyncRun,
} from '@/app/utils/settlementSync/jobRuns';

const JOB_NAME = 'cancel_pending_bookings';
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_MAX_BATCHES = 10;

type CleanupBatchRow = {
  cancelled_count: number;
  active_skipped_count: number;
  reconciliation_required_count: number;
  already_terminal_count: number;
  has_more: boolean;
};

export type CancelPendingBookingsResult =
  | {
      success: true;
      runId: number;
      outcome: 'completed' | 'no_candidates';
      cancelledCount: number;
      activeSkippedCount: number;
      reconciliationRequiredCount: number;
      alreadyTerminalCount: number;
      batchCount: number;
      hasMore: boolean;
    }
  | {
      success: false;
      status: 409 | 500;
      outcome: 'already_running' | 'failed';
      error: string;
      runId?: number;
    };

export async function runCancelPendingBookings(params: {
  supabaseAdmin: SupabaseClient;
  triggerSource: 'cron';
  batchSize?: number;
  maxBatches?: number;
  testLeaseMs?: number;
  simulateMissingAdminJobRuns?: boolean;
}): Promise<CancelPendingBookingsResult> {
  const batchSize = Math.min(Math.max(Math.floor(params.batchSize || DEFAULT_BATCH_SIZE), 1), 100);
  const maxBatches = Math.min(Math.max(Math.floor(params.maxBatches || DEFAULT_MAX_BATCHES), 1), 10);
  const started = await startSettlementSyncRun({
    supabaseAdmin: params.supabaseAdmin,
    jobName: JOB_NAME,
    scope: 'experience',
    triggerSource: params.triggerSource,
    testLeaseMs: params.testLeaseMs,
    simulateMissingAdminJobRuns: params.simulateMissingAdminJobRuns,
  });

  if (!started.ok) {
    return {
      success: false,
      status: 409,
      outcome: 'already_running',
      error: 'Pending booking cleanup is already running.',
    };
  }

  let cancelledCount = 0;
  let activeSkippedCount = 0;
  let reconciliationRequiredCount = 0;
  let alreadyTerminalCount = 0;
  let batchCount = 0;
  let hasMore = false;

  const renewLease = () => renewSettlementSyncRunLease({
    supabaseAdmin: params.supabaseAdmin,
    runId: started.runId,
    jobName: JOB_NAME,
    leaseToken: started.leaseToken,
    testLeaseMs: params.testLeaseMs,
    simulateMissingAdminJobRuns: params.simulateMissingAdminJobRuns,
  });

  try {
    do {
      await renewLease();
      const { data, error } = await params.supabaseAdmin
        .rpc('cancel_expired_pending_bookings_atomic', { p_batch_size: batchSize })
        .maybeSingle<CleanupBatchRow>();

      if (error || !data) {
        throw new Error('PENDING_CLEANUP_RPC_FAILED');
      }

      batchCount += 1;
      cancelledCount += Number(data.cancelled_count || 0);
      activeSkippedCount += Number(data.active_skipped_count || 0);
      reconciliationRequiredCount += Number(data.reconciliation_required_count || 0);
      alreadyTerminalCount += Number(data.already_terminal_count || 0);
      hasMore = Boolean(data.has_more);

      if (
        Number(data.cancelled_count || 0) === 0 &&
        Number(data.reconciliation_required_count || 0) === 0
      ) {
        hasMore = false;
      }
    } while (hasMore && batchCount < maxBatches);

    await renewLease();
    const processedCount = cancelledCount + reconciliationRequiredCount;
    const skippedCount = activeSkippedCount + alreadyTerminalCount;
    await finishSettlementSyncRunSuccess({
      supabaseAdmin: params.supabaseAdmin,
      runId: started.runId,
      jobName: JOB_NAME,
      startedAt: started.startedAt,
      leaseToken: started.leaseToken,
      processedCount,
      skippedCount,
      details: {
        cancelled_count: cancelledCount,
        active_skipped_count: activeSkippedCount,
        reconciliation_required_count: reconciliationRequiredCount,
        already_terminal_count: alreadyTerminalCount,
        batch_count: batchCount,
        has_more: hasMore,
      },
      testLeaseMs: params.testLeaseMs,
      simulateMissingAdminJobRuns: params.simulateMissingAdminJobRuns,
    });

    return {
      success: true,
      runId: started.runId,
      outcome: processedCount === 0 ? 'no_candidates' : 'completed',
      cancelledCount,
      activeSkippedCount,
      reconciliationRequiredCount,
      alreadyTerminalCount,
      batchCount,
      hasMore,
    };
  } catch {
    await finishSettlementSyncRunFailure({
      supabaseAdmin: params.supabaseAdmin,
      runId: started.runId,
      jobName: JOB_NAME,
      startedAt: started.startedAt,
      leaseToken: started.leaseToken,
      processedCount: cancelledCount + reconciliationRequiredCount,
      skippedCount: activeSkippedCount + alreadyTerminalCount,
      errorMessage: 'Pending booking cleanup failed.',
      details: {
        cancelled_count: cancelledCount,
        reconciliation_required_count: reconciliationRequiredCount,
        batch_count: batchCount,
      },
      testLeaseMs: params.testLeaseMs,
      simulateMissingAdminJobRuns: params.simulateMissingAdminJobRuns,
    });

    return {
      success: false,
      status: 500,
      outcome: 'failed',
      error: 'Pending booking cleanup failed.',
      runId: started.runId,
    };
  }
}
