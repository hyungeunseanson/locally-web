import { BOOKING_ACTIVE_STATUS_FOR_CAPACITY } from '@/app/constants/bookingStatus';
import {
  completeExperienceBookingIfDueAtomic,
  completeExperienceBookingsIfDueAtomic,
} from '@/app/utils/bookings/completeExperienceBooking';
import { processSoloGuaranteeRefundsForCompletedBookings } from '@/app/utils/bookings/soloGuaranteeRefund';
import { deliverHostGuestReviewRequestsForCompletedBookings } from '@/app/utils/reviews/hostGuestReviewRequestNotification';

import {
  finishSettlementSyncRunFailure,
  finishSettlementSyncRunSuccess,
  renewSettlementSyncRunLease,
  startSettlementSyncRun,
} from './jobRuns';
import type {
  SettlementSyncAdminClient,
  SettlementSyncForceOneParams,
  SettlementSyncRunDueParams,
  SettlementSyncRunResult,
  SettlementSyncTarget,
} from './types';
import {
  isSettlementSyncInfrastructureError,
  SettlementSyncInfrastructureError,
} from './types';
import {
  readSettlementSyncNestedRowOrFirst,
  readSettlementSyncString,
  readSettlementSyncTrimmedString,
  toSettlementSyncRawRow,
  toSettlementSyncRawRows,
  type SettlementSyncRawRow,
} from './rowHelpers';

type ExperienceTitleMeta = {
  title: string | null;
} | null;

type ExperienceCompletionRow = {
  id: string;
  order_id: string | null;
  user_id: string | null;
  date: string | null;
  time: string | null;
  status: string;
  experiences: ExperienceTitleMeta;
};

type ExperienceCompletionTarget = {
  booking_id: string;
  order_id: string | null;
  user_id: string | null;
  date: string | null;
  time: string | null;
  status: string;
  experiences: ExperienceTitleMeta;
};

const EXPERIENCE_SYNC_JOB_NAME = 'experience_completion_sync';
const EXPERIENCE_FORCE_ONE_JOB_NAME = 'experience_completion_sync_force_one';
const EXPERIENCE_ACTIVE_STATUS_SET = new Set<string>(BOOKING_ACTIVE_STATUS_FOR_CAPACITY);

function delay(ms?: number) {
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function delayWithHeartbeat(ms: number | undefined, renew: () => Promise<void>) {
  if (!ms || ms <= 0) return;
  let remaining = ms;

  while (remaining > 0) {
    const chunk = Math.min(remaining, 100);
    await delay(chunk);
    remaining -= chunk;
    if (remaining > 0) {
      await renew();
    }
  }
}

function createExperienceLeaseHeartbeat(
  params:
    | SettlementSyncRunDueParams
    | SettlementSyncForceOneParams,
  started: { runId: number; leaseToken: string }
): () => Promise<void> {
  const jobName =
    params.triggerSource === 'manual_force_one'
      ? EXPERIENCE_FORCE_ONE_JOB_NAME
      : EXPERIENCE_SYNC_JOB_NAME;

  return async () => {
    await renewSettlementSyncRunLease({
      supabaseAdmin: params.supabaseAdmin,
      runId: started.runId,
      jobName,
      leaseToken: started.leaseToken,
      testLeaseMs: params.testLeaseMs,
      simulateMissingAdminJobRuns: params.simulateMissingAdminJobRuns,
    });
  };
}

function normalizeExperienceTitleMeta(row: SettlementSyncRawRow): ExperienceTitleMeta {
  const experienceRow = readSettlementSyncNestedRowOrFirst(row, 'experiences');
  if (!experienceRow) {
    return null;
  }

  return {
    title: readSettlementSyncString(experienceRow, 'title'),
  };
}

function normalizeExperienceDueCandidateRows(value: unknown): ExperienceCompletionRow[] {
  return toSettlementSyncRawRows(value).reduce<ExperienceCompletionRow[]>((acc, row) => {
    const id = readSettlementSyncTrimmedString(row, 'booking_id');
    const status = readSettlementSyncTrimmedString(row, 'status');
    if (!id || !status) {
      return acc;
    }

    acc.push({
      id,
      order_id: readSettlementSyncTrimmedString(row, 'order_id'),
      user_id: readSettlementSyncTrimmedString(row, 'user_id'),
      date: readSettlementSyncString(row, 'date'),
      time: readSettlementSyncString(row, 'time'),
      status,
      experiences: {
        title: readSettlementSyncString(row, 'experience_title'),
      },
    });
    return acc;
  }, []);
}

function normalizeExperienceCompletionTargetRow(value: unknown): ExperienceCompletionTarget | null {
  const row = toSettlementSyncRawRow(value);
  if (!row) {
    return null;
  }

  const bookingId = readSettlementSyncTrimmedString(row, 'id');
  const status = readSettlementSyncTrimmedString(row, 'status');
  if (!bookingId || !status) {
    return null;
  }

  return {
    booking_id: bookingId,
    order_id: readSettlementSyncTrimmedString(row, 'order_id'),
    user_id: readSettlementSyncTrimmedString(row, 'user_id'),
    date: readSettlementSyncString(row, 'date'),
    time: readSettlementSyncString(row, 'time'),
    status,
    experiences: normalizeExperienceTitleMeta(row),
  };
}

function isExperienceActiveStatus(status: string): status is (typeof BOOKING_ACTIVE_STATUS_FOR_CAPACITY)[number] {
  return EXPERIENCE_ACTIVE_STATUS_SET.has(status);
}

function maybeThrowInjectedFailure(failPhase: SettlementSyncRunDueParams['failPhase']) {
  // The route gate already restricts this hook to localhost/non-production callers.
  if (failPhase === 'after_lock') {
    throw new Error('Injected settlement sync failure after lock.');
  }
}

function isMissingExperienceDueRpcError(
  error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | null | undefined,
  functionName: string
) {
  if (!error) return false;
  const combinedMessage = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
  return (
    error.code === 'PGRST202' ||
    (combinedMessage.includes(functionName) &&
      (combinedMessage.includes('Could not find the function') ||
        combinedMessage.includes('No function matches') ||
        combinedMessage.includes('does not exist')))
  );
}

async function listDueExperienceCompletionCandidates(
  supabaseAdmin: SettlementSyncAdminClient,
  params?: {
    bookingId?: string;
    simulateMissingExperienceDueRpc?: boolean;
  }
) {
  if (params?.simulateMissingExperienceDueRpc) {
    throw new SettlementSyncInfrastructureError();
  }

  const rpcName = 'list_due_experience_completion_candidates';
  const { data, error } = await supabaseAdmin.rpc(rpcName, {
    p_booking_id: params?.bookingId || null,
  });

  if (error) {
    if (isMissingExperienceDueRpcError(error, rpcName)) {
      throw new SettlementSyncInfrastructureError();
    }

    throw error;
  }

  return normalizeExperienceDueCandidateRows(data);
}

async function processSoloGuaranteeRefundSideEffects(
  supabaseAdmin: SettlementSyncAdminClient,
  bookingIds: string[]
) {
  if (bookingIds.length === 0) return;

  try {
    await processSoloGuaranteeRefundsForCompletedBookings({
      supabaseAdmin,
      completedBookingIds: bookingIds,
    });
  } catch (error) {
    console.error('[settlement sync] solo guarantee refund processing failed:', error);
  }
}

async function processHostGuestReviewRequestSideEffects(
  supabaseAdmin: SettlementSyncAdminClient,
  bookingIds: string[]
) {
  if (bookingIds.length === 0) return;

  try {
    await deliverHostGuestReviewRequestsForCompletedBookings({
      supabaseAdmin,
      completedBookingIds: bookingIds,
    });
  } catch (error) {
    console.error('[settlement sync] host guest review request delivery failed:', error);
  }
}

export async function resolveExperienceCompletionTarget(
  supabaseAdmin: SettlementSyncAdminClient,
  identifier: string
): Promise<ExperienceCompletionTarget | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  const query = async (column: 'id' | 'order_id') =>
    supabaseAdmin
      .from('bookings')
      .select('id, order_id, user_id, date, time, status, experiences(title)')
      .eq(column, trimmed)
      .maybeSingle();

  const idMatch = await query('id');
  if (idMatch.error) throw idMatch.error;
  if (idMatch.data) {
    return normalizeExperienceCompletionTargetRow(idMatch.data);
  }

  const orderMatch = await query('order_id');
  if (orderMatch.error) throw orderMatch.error;
  return normalizeExperienceCompletionTargetRow(orderMatch.data);
}

export async function runExperienceCompletionSync(
  params: SettlementSyncRunDueParams
): Promise<SettlementSyncRunResult> {
  const started = await startSettlementSyncRun({
    supabaseAdmin: params.supabaseAdmin,
    jobName: EXPERIENCE_SYNC_JOB_NAME,
    scope: 'experience',
    triggerSource: params.triggerSource,
    initiatedByAdminId: params.initiatedByAdminId,
    testLeaseMs: params.testLeaseMs,
    simulateMissingAdminJobRuns: params.simulateMissingAdminJobRuns,
  });

  if (!started.ok) {
    return {
      success: false,
      status: 409,
      error: '체험 완료 동기화가 이미 실행 중입니다.',
      outcome: 'already_running',
      processedCount: 0,
      skippedCount: 0,
    };
  }

  let candidateCount = 0;
  let completedBookingIds: string[] = [];
  let failedBookingIds: string[] = [];

  try {
    const renewLease = createExperienceLeaseHeartbeat(params, started);
    const dueCandidates = await listDueExperienceCompletionCandidates(params.supabaseAdmin, {
      simulateMissingExperienceDueRpc: params.simulateMissingExperienceDueRpc,
    });
    candidateCount = dueCandidates.length;
    await renewLease();

    if (dueCandidates.length === 0) {
      await finishSettlementSyncRunSuccess({
        supabaseAdmin: params.supabaseAdmin,
        runId: started.runId,
        jobName: EXPERIENCE_SYNC_JOB_NAME,
        startedAt: started.startedAt,
        leaseToken: started.leaseToken,
        processedCount: 0,
        skippedCount: 0,
        details: { mode: 'run_due', candidate_count: 0 },
        testLeaseMs: params.testLeaseMs,
        simulateMissingAdminJobRuns: params.simulateMissingAdminJobRuns,
      });

      return {
        success: true,
        runId: started.runId,
        outcome: 'no_candidates',
        processedCount: 0,
        skippedCount: 0,
        details: { booking_ids: [] },
      };
    }

    await delayWithHeartbeat(params.testDelayMs, renewLease);
    maybeThrowInjectedFailure(params.failPhase);

    const completionBatch = await completeExperienceBookingsIfDueAtomic(
      params.supabaseAdmin,
      dueCandidates.map((row) => row.id)
    );
    completedBookingIds = completionBatch.results
      .filter((result) => result.completed)
      .map((result) => result.bookingId);
    failedBookingIds = completionBatch.failures.map((failure) => failure.bookingId);

    await processSoloGuaranteeRefundSideEffects(params.supabaseAdmin, completedBookingIds);
    await processHostGuestReviewRequestSideEffects(params.supabaseAdmin, completedBookingIds);
    await renewLease();

    if (completionBatch.failures.length > 0) {
      throw completionBatch.failures[0].error;
    }

    await finishSettlementSyncRunSuccess({
      supabaseAdmin: params.supabaseAdmin,
      runId: started.runId,
      jobName: EXPERIENCE_SYNC_JOB_NAME,
      startedAt: started.startedAt,
      leaseToken: started.leaseToken,
      processedCount: completedBookingIds.length,
      skippedCount: Math.max(0, dueCandidates.length - completedBookingIds.length),
      details: {
        mode: 'run_due',
        booking_ids: completedBookingIds,
      },
      testLeaseMs: params.testLeaseMs,
      simulateMissingAdminJobRuns: params.simulateMissingAdminJobRuns,
    });

    return {
      success: true,
      runId: started.runId,
      outcome: 'completed',
      processedCount: completedBookingIds.length,
      skippedCount: Math.max(0, dueCandidates.length - completedBookingIds.length),
      details: { booking_ids: completedBookingIds },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '체험 완료 동기화 중 오류가 발생했습니다.';
    const processedCount = completedBookingIds.length;
    const skippedCount = Math.max(0, candidateCount - processedCount);
    await finishSettlementSyncRunFailure({
      supabaseAdmin: params.supabaseAdmin,
      runId: started.runId,
      jobName: EXPERIENCE_SYNC_JOB_NAME,
      startedAt: started.startedAt,
      leaseToken: started.leaseToken,
      processedCount,
      skippedCount,
      errorMessage: message,
      details: {
        mode: 'run_due',
        candidate_count: candidateCount,
        booking_ids: completedBookingIds,
        failed_booking_ids: failedBookingIds,
      },
      testLeaseMs: params.testLeaseMs,
      simulateMissingAdminJobRuns: params.simulateMissingAdminJobRuns,
    });

    if (isSettlementSyncInfrastructureError(error)) {
      throw error;
    }

    return {
      success: false,
      status: 500,
      error: message,
      runId: started.runId,
      processedCount,
      skippedCount,
    };
  }
}

export async function forceExperienceCompletionSync(
  params: SettlementSyncForceOneParams
): Promise<SettlementSyncRunResult> {
  const target = await resolveExperienceCompletionTarget(params.supabaseAdmin, params.identifier);
  if (!target) {
    return { success: false, status: 404, error: '체험 예약을 찾을 수 없습니다.' };
  }

  const started = await startSettlementSyncRun({
    supabaseAdmin: params.supabaseAdmin,
    jobName: EXPERIENCE_FORCE_ONE_JOB_NAME,
    scope: 'experience',
    triggerSource: params.triggerSource,
    initiatedByAdminId: params.initiatedByAdminId,
    targetIdentifier: params.identifier,
    testLeaseMs: params.testLeaseMs,
    simulateMissingAdminJobRuns: params.simulateMissingAdminJobRuns,
  });

  if (!started.ok) {
    return {
      success: false,
      status: 409,
      error: '체험 완료 동기화가 이미 실행 중입니다.',
      outcome: 'already_running',
      processedCount: 0,
      skippedCount: 0,
      target: {
        booking_id: target.booking_id,
        order_id: target.order_id,
      },
    };
  }

  try {
    const renewLease = createExperienceLeaseHeartbeat(params, started);
    const targetSummary: SettlementSyncTarget = {
      booking_id: target.booking_id,
      order_id: target.order_id,
    };

    if (String(target.status || '').toLowerCase() === 'completed') {
      await finishSettlementSyncRunSuccess({
        supabaseAdmin: params.supabaseAdmin,
        runId: started.runId,
        jobName: EXPERIENCE_FORCE_ONE_JOB_NAME,
        startedAt: started.startedAt,
        leaseToken: started.leaseToken,
        processedCount: 0,
        skippedCount: 1,
        details: { mode: 'force_one', target: targetSummary, outcome: 'already_processed' },
        testLeaseMs: params.testLeaseMs,
        simulateMissingAdminJobRuns: params.simulateMissingAdminJobRuns,
      });

      return {
        success: true,
        runId: started.runId,
        outcome: 'already_processed',
        processedCount: 0,
        skippedCount: 1,
        target: targetSummary,
      };
    }

    if (!isExperienceActiveStatus(target.status)) {
      await finishSettlementSyncRunFailure({
        supabaseAdmin: params.supabaseAdmin,
        runId: started.runId,
        jobName: EXPERIENCE_FORCE_ONE_JOB_NAME,
        startedAt: started.startedAt,
        leaseToken: started.leaseToken,
        processedCount: 0,
        skippedCount: 1,
        errorMessage: '현재 상태에서는 체험 완료 동기화를 실행할 수 없습니다.',
        testLeaseMs: params.testLeaseMs,
        simulateMissingAdminJobRuns: params.simulateMissingAdminJobRuns,
      });

      return {
        success: false,
        status: 409,
        error: '현재 상태에서는 체험 완료 동기화를 실행할 수 없습니다.',
        runId: started.runId,
        target: targetSummary,
      };
    }

    await renewLease();

    const dueRows = await listDueExperienceCompletionCandidates(params.supabaseAdmin, {
      bookingId: target.booking_id,
      simulateMissingExperienceDueRpc: params.simulateMissingExperienceDueRpc,
    });

    if (dueRows.length === 0) {
      await finishSettlementSyncRunSuccess({
        supabaseAdmin: params.supabaseAdmin,
        runId: started.runId,
        jobName: EXPERIENCE_FORCE_ONE_JOB_NAME,
        startedAt: started.startedAt,
        leaseToken: started.leaseToken,
        processedCount: 0,
        skippedCount: 1,
        details: { mode: 'force_one', target: targetSummary, outcome: 'not_due' },
        testLeaseMs: params.testLeaseMs,
        simulateMissingAdminJobRuns: params.simulateMissingAdminJobRuns,
      });

      return {
        success: true,
        runId: started.runId,
        outcome: 'not_due',
        processedCount: 0,
        skippedCount: 1,
        target: targetSummary,
      };
    }

    await delayWithHeartbeat(params.testDelayMs, renewLease);
    maybeThrowInjectedFailure(params.failPhase);

    const completionResult = await completeExperienceBookingIfDueAtomic(
      params.supabaseAdmin,
      target.booking_id
    );

    if (completionResult.completed) {
      await processSoloGuaranteeRefundSideEffects(params.supabaseAdmin, [target.booking_id]);
      await processHostGuestReviewRequestSideEffects(params.supabaseAdmin, [target.booking_id]);
      await renewLease();
      await finishSettlementSyncRunSuccess({
        supabaseAdmin: params.supabaseAdmin,
        runId: started.runId,
        jobName: EXPERIENCE_FORCE_ONE_JOB_NAME,
        startedAt: started.startedAt,
        leaseToken: started.leaseToken,
        processedCount: 1,
        skippedCount: 0,
        details: { mode: 'force_one', target: targetSummary, outcome: 'completed' },
        testLeaseMs: params.testLeaseMs,
        simulateMissingAdminJobRuns: params.simulateMissingAdminJobRuns,
      });

      return {
        success: true,
        runId: started.runId,
        outcome: 'completed',
        processedCount: 1,
        skippedCount: 0,
        target: targetSummary,
      };
    }

    await renewLease();
    const outcome = completionResult.alreadyProcessed ? 'already_processed' : 'not_due';

    await finishSettlementSyncRunSuccess({
      supabaseAdmin: params.supabaseAdmin,
      runId: started.runId,
      jobName: EXPERIENCE_FORCE_ONE_JOB_NAME,
      startedAt: started.startedAt,
      leaseToken: started.leaseToken,
      processedCount: 0,
      skippedCount: 1,
      details: { mode: 'force_one', target: targetSummary, outcome },
      testLeaseMs: params.testLeaseMs,
      simulateMissingAdminJobRuns: params.simulateMissingAdminJobRuns,
    });

    return {
      success: true,
      runId: started.runId,
      outcome,
      processedCount: 0,
      skippedCount: 1,
      target: targetSummary,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '체험 완료 동기화 중 오류가 발생했습니다.';
    await finishSettlementSyncRunFailure({
      supabaseAdmin: params.supabaseAdmin,
      runId: started.runId,
      jobName: EXPERIENCE_FORCE_ONE_JOB_NAME,
      startedAt: started.startedAt,
      leaseToken: started.leaseToken,
      processedCount: 0,
      skippedCount: 0,
      errorMessage: message,
      testLeaseMs: params.testLeaseMs,
      simulateMissingAdminJobRuns: params.simulateMissingAdminJobRuns,
    });

    if (isSettlementSyncInfrastructureError(error)) {
      throw error;
    }

    return {
      success: false,
      status: 500,
      error: message,
      runId: started.runId,
      target: {
        booking_id: target.booking_id,
        order_id: target.order_id,
      },
    };
  }
}
