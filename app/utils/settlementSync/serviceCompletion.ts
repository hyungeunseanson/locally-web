import {
  SERVICE_BOOKING_ACTIVE_STATUSES,
  SERVICE_REQUEST_ACTIVE_STATUSES,
  SERVICE_REQUEST_COMPLETED_STATUSES,
} from '@/app/constants/serviceStatus';

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
} from './rowHelpers';

type ServiceCompletionRequestRow = {
  id: string;
  service_date: string | null;
  status: string;
  selected_host_id: string | null;
};

type ServiceCompletionBookingRow = {
  id: string;
  order_id: string | null;
  request_id: string;
  status: string;
  host_id: string;
};

type ServiceCompletionCandidate = ServiceCompletionBookingRow & {
  service_date: string | null;
  request_status: string;
};

type ServiceCompletionTarget = {
  booking_id: string;
  order_id: string | null;
  request_id: string | null;
  status: string;
  host_id: string | null;
  service_date: string | null;
  request_status: string | null;
};

type AtomicCompleteServiceBookingRow = {
  booking_id: string;
  order_id: string;
  request_id: string;
  host_id: string;
  service_date: string | null;
  already_processed: boolean;
  not_due: boolean;
  completed: boolean;
};

type ServiceRpcErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

type AtomicCompletionResult =
  | { kind: 'success'; data: AtomicCompleteServiceBookingRow }
  | { kind: 'error'; status: 404 | 409 | 500; error: string };

type ServiceCompletionAttemptResult =
  | { kind: 'completed'; target: SettlementSyncTarget }
  | { kind: 'already_processed'; target: SettlementSyncTarget }
  | { kind: 'not_due'; target: SettlementSyncTarget }
  | { kind: 'error'; status: 404 | 409 | 500; error: string };

const SERVICE_SYNC_JOB_NAME = 'service_completion_sync';
const SERVICE_FORCE_ONE_JOB_NAME = 'service_completion_sync_force_one';

function getTodayKSTDateString() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date());
}

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

function createServiceLeaseHeartbeat(
  params: SettlementSyncRunDueParams | SettlementSyncForceOneParams,
  started: { runId: number; leaseToken: string }
): () => Promise<void> {
  const jobName =
    params.triggerSource === 'manual_force_one'
      ? SERVICE_FORCE_ONE_JOB_NAME
      : SERVICE_SYNC_JOB_NAME;

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

function maybeThrowInjectedFailure(failPhase: SettlementSyncRunDueParams['failPhase']) {
  if (process.env.NODE_ENV !== 'production' && failPhase === 'after_lock') {
    throw new Error('Injected settlement sync failure after lock.');
  }
}

function normalizeServiceCompletionRequestRows(value: unknown): ServiceCompletionRequestRow[] {
  return toSettlementSyncRawRows(value).reduce<ServiceCompletionRequestRow[]>((acc, row) => {
    const id = readSettlementSyncTrimmedString(row, 'id');
    const status = readSettlementSyncTrimmedString(row, 'status');
    if (!id || !status) {
      return acc;
    }

    acc.push({
      id,
      service_date: readSettlementSyncString(row, 'service_date'),
      status,
      selected_host_id: readSettlementSyncTrimmedString(row, 'selected_host_id'),
    });
    return acc;
  }, []);
}

function normalizeServiceCompletionBookingRows(value: unknown): ServiceCompletionBookingRow[] {
  return toSettlementSyncRawRows(value).reduce<ServiceCompletionBookingRow[]>((acc, row) => {
    const id = readSettlementSyncTrimmedString(row, 'id');
    const requestId = readSettlementSyncTrimmedString(row, 'request_id');
    const status = readSettlementSyncTrimmedString(row, 'status');
    const hostId = readSettlementSyncTrimmedString(row, 'host_id');
    if (!id || !requestId || !status || !hostId) {
      return acc;
    }

    acc.push({
      id,
      order_id: readSettlementSyncTrimmedString(row, 'order_id'),
      request_id: requestId,
      status,
      host_id: hostId,
    });
    return acc;
  }, []);
}

function normalizeServiceCompletionTargetRow(value: unknown): ServiceCompletionTarget | null {
  const row = toSettlementSyncRawRow(value);
  if (!row) {
    return null;
  }

  const bookingId = readSettlementSyncTrimmedString(row, 'id');
  const status = readSettlementSyncTrimmedString(row, 'status');
  if (!bookingId || !status) {
    return null;
  }

  const requestMeta = readSettlementSyncNestedRowOrFirst(row, 'service_requests');

  return {
    booking_id: bookingId,
    order_id: readSettlementSyncTrimmedString(row, 'order_id'),
    request_id: readSettlementSyncTrimmedString(row, 'request_id'),
    status,
    host_id: readSettlementSyncTrimmedString(row, 'host_id'),
    service_date: requestMeta ? readSettlementSyncString(requestMeta, 'service_date') : null,
    request_status: requestMeta ? readSettlementSyncTrimmedString(requestMeta, 'status') : null,
  };
}

function isMissingServiceCompletionRpcError(
  error: ServiceRpcErrorLike | null | undefined,
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

function parseAtomicCompletionError(error: ServiceRpcErrorLike) {
  const combinedMessage = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;

  if (combinedMessage.includes('SVC_COMPLETE_NOT_FOUND')) {
    return { kind: 'error' as const, status: 404 as const, error: '서비스 예약을 찾을 수 없습니다.' };
  }

  if (
    combinedMessage.includes('SVC_COMPLETE_REQUEST_MISSING') ||
    combinedMessage.includes('SVC_COMPLETE_INVALID_BOOKING_STATUS') ||
    combinedMessage.includes('SVC_COMPLETE_INVALID_REQUEST_STATUS')
  ) {
    return {
      kind: 'error' as const,
      status: 409 as const,
      error: '현재 상태에서는 서비스 완료 동기화를 실행할 수 없습니다.',
    };
  }

  console.error('[settlement sync] service completion RPC error:', error);
  return {
    kind: 'error' as const,
    status: 500 as const,
    error: '서비스 완료 동기화 중 오류가 발생했습니다.',
  };
}

async function tryCompleteServiceBookingAtomic(
  supabaseAdmin: SettlementSyncAdminClient,
  bookingId: string,
  simulateMissingServiceCompletionRpc?: boolean
): Promise<AtomicCompletionResult> {
  if (simulateMissingServiceCompletionRpc) {
    throw new SettlementSyncInfrastructureError();
  }

  const rpcName = 'complete_service_booking_if_due_atomic';
  const { data, error } = await supabaseAdmin
    .rpc(rpcName, { p_booking_id: bookingId })
    .maybeSingle<AtomicCompleteServiceBookingRow>();

  if (error) {
    if (isMissingServiceCompletionRpcError(error, rpcName)) {
      throw new SettlementSyncInfrastructureError();
    }

    return parseAtomicCompletionError(error);
  }

  if (!data?.booking_id || !data.request_id) {
    return {
      kind: 'error',
      status: 500,
      error: '서비스 완료 동기화 중 오류가 발생했습니다.',
    };
  }

  return { kind: 'success', data };
}

async function fetchServiceCompletionCandidates(
  supabaseAdmin: SettlementSyncAdminClient
) {
  const todayKST = getTodayKSTDateString();
  const requestStatuses = [...SERVICE_REQUEST_ACTIVE_STATUSES, ...SERVICE_REQUEST_COMPLETED_STATUSES];

  const { data: requestRowsRaw, error: requestError } = await supabaseAdmin
    .from('service_requests')
    .select('id, service_date, status, selected_host_id')
    .lt('service_date', todayKST)
    .in('status', requestStatuses);

  if (requestError) throw requestError;

  const requestRows = normalizeServiceCompletionRequestRows(requestRowsRaw).filter(
    (row) => row.selected_host_id
  );
  if (requestRows.length === 0) {
    return [] as ServiceCompletionCandidate[];
  }

  const requestMap = new Map(requestRows.map((row) => [row.id, row]));
  const { data: bookingRowsRaw, error: bookingError } = await supabaseAdmin
    .from('service_bookings')
    .select('id, order_id, request_id, status, host_id')
    .in('request_id', requestRows.map((row) => row.id))
    .in('status', [...SERVICE_BOOKING_ACTIVE_STATUSES]);

  if (bookingError) throw bookingError;

  return normalizeServiceCompletionBookingRows(bookingRowsRaw)
    .map((row) => {
      const request = row.request_id ? requestMap.get(row.request_id) : null;
      return {
        ...row,
        service_date: request?.service_date || null,
        request_status: request?.status || '',
      };
    });
}

export async function resolveServiceCompletionTarget(
  supabaseAdmin: SettlementSyncAdminClient,
  identifier: string
) {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  const query = async (column: 'id' | 'order_id') =>
    supabaseAdmin
      .from('service_bookings')
      .select(`
        id,
        order_id,
        request_id,
        status,
        host_id,
        service_requests(id, service_date, status)
      `)
      .eq(column, trimmed)
      .maybeSingle();

  const idMatch = await query('id');
  if (idMatch.error) throw idMatch.error;
  if (idMatch.data) {
    return normalizeServiceCompletionTargetRow(idMatch.data);
  }

  const orderMatch = await query('order_id');
  if (orderMatch.error) throw orderMatch.error;
  return normalizeServiceCompletionTargetRow(orderMatch.data);
}

async function completeServiceBookingOnce(
  supabaseAdmin: SettlementSyncAdminClient,
  bookingId: string,
  simulateMissingServiceCompletionRpc?: boolean
): Promise<ServiceCompletionAttemptResult> {
  const atomic = await tryCompleteServiceBookingAtomic(
    supabaseAdmin,
    bookingId,
    simulateMissingServiceCompletionRpc
  );

  if (atomic.kind === 'error') {
    return {
      kind: 'error',
      status: atomic.status,
      error: atomic.error,
    };
  }

  const target: SettlementSyncTarget = {
    booking_id: atomic.data.booking_id,
    order_id: atomic.data.order_id || null,
    request_id: atomic.data.request_id,
  };

  if (atomic.data.not_due) {
    return {
      kind: 'not_due',
      target,
    };
  }

  if (atomic.data.already_processed) {
    return {
      kind: 'already_processed',
      target,
    };
  }

  return {
    kind: atomic.data.completed ? 'completed' : 'already_processed',
    target,
  };
}

export async function runServiceCompletionSync(
  params: SettlementSyncRunDueParams
): Promise<SettlementSyncRunResult> {
  const started = await startSettlementSyncRun({
    supabaseAdmin: params.supabaseAdmin,
    jobName: SERVICE_SYNC_JOB_NAME,
    scope: 'service',
    triggerSource: params.triggerSource,
    initiatedByAdminId: params.initiatedByAdminId,
    testLeaseMs: params.testLeaseMs,
    simulateMissingAdminJobRuns: params.simulateMissingAdminJobRuns,
  });

  if (!started.ok) {
    return {
      success: false,
      status: 409,
      error: '서비스 완료 동기화가 이미 실행 중입니다.',
      outcome: 'already_running',
      processedCount: 0,
      skippedCount: 0,
    };
  }

  try {
    const renewLease = createServiceLeaseHeartbeat(params, started);
    const candidates = await fetchServiceCompletionCandidates(params.supabaseAdmin);
    await renewLease();
    if (candidates.length === 0) {
      await finishSettlementSyncRunSuccess({
        supabaseAdmin: params.supabaseAdmin,
        runId: started.runId,
        jobName: SERVICE_SYNC_JOB_NAME,
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
        details: { booking_ids: [], request_ids: [] },
      };
    }

    await delayWithHeartbeat(params.testDelayMs, renewLease);
    maybeThrowInjectedFailure(params.failPhase);

    const completedIds: string[] = [];
    const requestIds = new Set<string>();
    let skippedCount = 0;

    for (const candidate of candidates) {
      await renewLease();
      const result = await completeServiceBookingOnce(
        params.supabaseAdmin,
        candidate.id,
        params.simulateMissingServiceCompletionRpc
      );
      switch (result.kind) {
        case 'completed':
          completedIds.push(candidate.id);
          requestIds.add(candidate.request_id);
          break;
        case 'already_processed':
        case 'not_due':
          skippedCount += 1;
          break;
        case 'error':
          throw new Error(result.error);
      }
    }

    await finishSettlementSyncRunSuccess({
      supabaseAdmin: params.supabaseAdmin,
      runId: started.runId,
      jobName: SERVICE_SYNC_JOB_NAME,
      startedAt: started.startedAt,
      leaseToken: started.leaseToken,
      processedCount: completedIds.length,
      skippedCount,
      details: {
        mode: 'run_due',
        booking_ids: completedIds,
        request_ids: Array.from(requestIds),
      },
      testLeaseMs: params.testLeaseMs,
      simulateMissingAdminJobRuns: params.simulateMissingAdminJobRuns,
    });

    return {
      success: true,
      runId: started.runId,
      outcome: completedIds.length > 0 ? 'completed' : 'no_candidates',
      processedCount: completedIds.length,
      skippedCount,
      details: {
        booking_ids: completedIds,
        request_ids: Array.from(requestIds),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '서비스 완료 동기화 중 오류가 발생했습니다.';
    await finishSettlementSyncRunFailure({
      supabaseAdmin: params.supabaseAdmin,
      runId: started.runId,
      jobName: SERVICE_SYNC_JOB_NAME,
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
    };
  }
}

export async function forceServiceCompletionSync(
  params: SettlementSyncForceOneParams
): Promise<SettlementSyncRunResult> {
  const target = await resolveServiceCompletionTarget(params.supabaseAdmin, params.identifier);
  if (!target) {
    return { success: false, status: 404, error: '서비스 예약을 찾을 수 없습니다.' };
  }

  const targetSummary: SettlementSyncTarget = {
    booking_id: target.booking_id,
    order_id: target.order_id,
    request_id: target.request_id,
  };

  const started = await startSettlementSyncRun({
    supabaseAdmin: params.supabaseAdmin,
    jobName: SERVICE_FORCE_ONE_JOB_NAME,
    scope: 'service',
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
      error: '서비스 완료 동기화가 이미 실행 중입니다.',
      outcome: 'already_running',
      processedCount: 0,
      skippedCount: 0,
      target: targetSummary,
    };
  }

  try {
    const renewLease = createServiceLeaseHeartbeat(params, started);
    await delayWithHeartbeat(params.testDelayMs, renewLease);
    await renewLease();
    maybeThrowInjectedFailure(params.failPhase);
    const result = await completeServiceBookingOnce(
      params.supabaseAdmin,
      target.booking_id,
      params.simulateMissingServiceCompletionRpc
    );
    if (result.kind === 'error') {
      await finishSettlementSyncRunFailure({
        supabaseAdmin: params.supabaseAdmin,
        runId: started.runId,
        jobName: SERVICE_FORCE_ONE_JOB_NAME,
        startedAt: started.startedAt,
        leaseToken: started.leaseToken,
        processedCount: 0,
        skippedCount: 0,
        errorMessage: result.error,
        testLeaseMs: params.testLeaseMs,
        simulateMissingAdminJobRuns: params.simulateMissingAdminJobRuns,
      });

      return {
        success: false,
        status: result.status,
        error: result.error,
        runId: started.runId,
        target: targetSummary,
      };
    }

    const outcome =
      result.kind === 'completed'
        ? 'completed'
        : result.kind === 'already_processed'
          ? 'already_processed'
          : 'not_due';
    const processedCount = result.kind === 'completed' ? 1 : 0;
    const skippedCount = result.kind === 'completed' ? 0 : 1;

    await finishSettlementSyncRunSuccess({
      supabaseAdmin: params.supabaseAdmin,
      runId: started.runId,
      jobName: SERVICE_FORCE_ONE_JOB_NAME,
      startedAt: started.startedAt,
      leaseToken: started.leaseToken,
      processedCount,
      skippedCount,
      details: {
        mode: 'force_one',
        target: targetSummary,
        outcome,
      },
      testLeaseMs: params.testLeaseMs,
      simulateMissingAdminJobRuns: params.simulateMissingAdminJobRuns,
    });

    return {
      success: true,
      runId: started.runId,
      outcome,
      processedCount,
      skippedCount,
      target: targetSummary,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '서비스 완료 동기화 중 오류가 발생했습니다.';
    await finishSettlementSyncRunFailure({
      supabaseAdmin: params.supabaseAdmin,
      runId: started.runId,
      jobName: SERVICE_FORCE_ONE_JOB_NAME,
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
      target: targetSummary,
    };
  }
}
