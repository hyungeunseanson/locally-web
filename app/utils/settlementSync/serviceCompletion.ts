import {
  SERVICE_BOOKING_ACTIVE_STATUSES,
  SERVICE_REQUEST_ACTIVE_STATUSES,
  SERVICE_REQUEST_COMPLETED_STATUSES,
} from '@/app/constants/serviceStatus';

import {
  finishSettlementSyncRunFailure,
  finishSettlementSyncRunSuccess,
  startSettlementSyncRun,
} from './jobRuns';
import type {
  SettlementSyncAdminClient,
  SettlementSyncForceOneParams,
  SettlementSyncRunDueParams,
  SettlementSyncRunResult,
  SettlementSyncTarget,
} from './types';

type ServiceCompletionRequestRow = {
  id: string;
  service_date: string | null;
  status: string;
  selected_host_id: string | null;
};

type ServiceCompletionBookingRow = {
  id: string;
  order_id: string | null;
  request_id: string | null;
  status: string;
  host_id: string | null;
};

type ServiceCompletionTargetRow = {
  id: string;
  order_id: string | null;
  request_id: string | null;
  status: string;
  host_id: string | null;
  service_requests:
    | { id: string; service_date: string | null; status: string | null }
    | Array<{ id: string; service_date: string | null; status: string | null }>
    | null;
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
  | { kind: 'missing' }
  | { kind: 'error'; status: 404 | 409 | 500; error: string };

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

function normalizeServiceRequestMeta(value: ServiceCompletionTargetRow['service_requests']) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

function isServiceDue(serviceDate: string | null) {
  if (!serviceDate) return false;
  return serviceDate < getTodayKSTDateString();
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
  bookingId: string
): Promise<AtomicCompletionResult> {
  const rpcName = 'complete_service_booking_if_due_atomic';
  const { data, error } = await supabaseAdmin
    .rpc(rpcName, { p_booking_id: bookingId })
    .maybeSingle<AtomicCompleteServiceBookingRow>();

  if (error) {
    if (isMissingServiceCompletionRpcError(error, rpcName)) {
      return { kind: 'missing' };
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

  const requestRows = ((requestRowsRaw || []) as ServiceCompletionRequestRow[]).filter(
    (row) => row.selected_host_id
  );
  if (requestRows.length === 0) {
    return [] as Array<ServiceCompletionBookingRow & { service_date: string | null; request_status: string }>;
  }

  const requestMap = new Map(requestRows.map((row) => [row.id, row]));
  const { data: bookingRowsRaw, error: bookingError } = await supabaseAdmin
    .from('service_bookings')
    .select('id, order_id, request_id, status, host_id')
    .in('request_id', requestRows.map((row) => row.id))
    .in('status', [...SERVICE_BOOKING_ACTIVE_STATUSES]);

  if (bookingError) throw bookingError;

  return ((bookingRowsRaw || []) as ServiceCompletionBookingRow[])
    .filter((row) => row.host_id && row.request_id)
    .map((row) => {
      const request = row.request_id ? requestMap.get(row.request_id) : null;
      return {
        ...row,
        service_date: request?.service_date || null,
        request_status: request?.status || '',
      };
    });
}

async function fetchServiceCompletionTarget(
  supabaseAdmin: SettlementSyncAdminClient,
  bookingId: string
) {
  const { data, error } = await supabaseAdmin
    .from('service_bookings')
    .select(`
      id,
      order_id,
      request_id,
      status,
      host_id,
      service_requests(id, service_date, status)
    `)
    .eq('id', bookingId)
    .maybeSingle();

  if (error || !data) return null;
  return data as ServiceCompletionTargetRow;
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
    const requestMeta = normalizeServiceRequestMeta(
      (idMatch.data as ServiceCompletionTargetRow).service_requests
    );
    return {
      ...(idMatch.data as ServiceCompletionTargetRow),
      booking_id: idMatch.data.id,
      order_id: idMatch.data.order_id,
      request_id: idMatch.data.request_id,
      service_date: requestMeta?.service_date || null,
      request_status: requestMeta?.status || null,
    };
  }

  const orderMatch = await query('order_id');
  if (orderMatch.error) throw orderMatch.error;
  if (!orderMatch.data) return null;

  const requestMeta = normalizeServiceRequestMeta(
    (orderMatch.data as ServiceCompletionTargetRow).service_requests
  );

  return {
    ...(orderMatch.data as ServiceCompletionTargetRow),
    booking_id: orderMatch.data.id,
    order_id: orderMatch.data.order_id,
    request_id: orderMatch.data.request_id,
    service_date: requestMeta?.service_date || null,
    request_status: requestMeta?.status || null,
  };
}

async function completeServiceBookingFallback(
  supabaseAdmin: SettlementSyncAdminClient,
  bookingId: string
): Promise<SettlementSyncRunResult> {
  const booking = await fetchServiceCompletionTarget(supabaseAdmin, bookingId);
  if (!booking) {
    return { success: false, status: 404, error: '서비스 예약을 찾을 수 없습니다.' };
  }

  const requestMeta = normalizeServiceRequestMeta(booking.service_requests);
  const target: SettlementSyncTarget = {
    booking_id: booking.id,
    order_id: booking.order_id,
    request_id: booking.request_id,
  };

  if (!requestMeta?.id) {
    return {
      success: false,
      status: 409,
      error: '현재 상태에서는 서비스 완료 동기화를 실행할 수 없습니다.',
      target,
    };
  }

  if (String(booking.status || '').toLowerCase() === 'completed') {
    return {
      success: true,
      runId: 0,
      outcome: 'already_processed',
      processedCount: 0,
      skippedCount: 1,
      target,
    };
  }

  if (!SERVICE_BOOKING_ACTIVE_STATUSES.includes(booking.status as (typeof SERVICE_BOOKING_ACTIVE_STATUSES)[number])) {
    return {
      success: false,
      status: 409,
      error: '현재 상태에서는 서비스 완료 동기화를 실행할 수 없습니다.',
      target,
    };
  }

  if (!isServiceDue(requestMeta.service_date)) {
    return {
      success: true,
      runId: 0,
      outcome: 'not_due',
      processedCount: 0,
      skippedCount: 1,
      target,
    };
  }

  const { data: updatedBooking, error: bookingUpdateError } = await supabaseAdmin
    .from('service_bookings')
    .update({ status: 'completed' })
    .eq('id', booking.id)
    .in('status', [...SERVICE_BOOKING_ACTIVE_STATUSES])
    .select('id')
    .maybeSingle();

  if (bookingUpdateError) {
    throw new Error(`[settlement sync] service booking update failed: ${bookingUpdateError.message}`);
  }

  if (!updatedBooking) {
    const latest = await fetchServiceCompletionTarget(supabaseAdmin, booking.id);
    const latestStatus = String(latest?.status || '').toLowerCase();
    return {
      success: true,
      runId: 0,
      outcome: latestStatus === 'completed' ? 'already_processed' : 'not_due',
      processedCount: 0,
      skippedCount: 1,
      target,
    };
  }

  if (requestMeta.status === 'completed') {
    return {
      success: true,
      runId: 0,
      outcome: 'completed',
      processedCount: 1,
      skippedCount: 0,
      target,
    };
  }

  const { data: updatedRequest, error: requestUpdateError } = await supabaseAdmin
    .from('service_requests')
    .update({ status: 'completed' })
    .eq('id', requestMeta.id)
    .in('status', [...SERVICE_REQUEST_ACTIVE_STATUSES])
    .select('id')
    .maybeSingle();

  if (requestUpdateError) {
    const rollbackResult = await supabaseAdmin
      .from('service_bookings')
      .update({ status: booking.status })
      .eq('id', booking.id)
      .eq('status', 'completed');

    if (rollbackResult.error) {
      console.error('[settlement sync] service completion rollback failed:', rollbackResult.error);
    }

    throw new Error(`[settlement sync] service request update failed: ${requestUpdateError.message}`);
  }

  if (!updatedRequest) {
    const latestRequest = await supabaseAdmin
      .from('service_requests')
      .select('status')
      .eq('id', requestMeta.id)
      .maybeSingle();

    if (latestRequest.error) {
      throw latestRequest.error;
    }

    if (latestRequest.data?.status !== 'completed') {
      const rollbackResult = await supabaseAdmin
        .from('service_bookings')
        .update({ status: booking.status })
        .eq('id', booking.id)
        .eq('status', 'completed');

      if (rollbackResult.error) {
        console.error('[settlement sync] service completion rollback after request miss failed:', rollbackResult.error);
      }

      return {
        success: false,
        status: 409,
        error: '현재 상태에서는 서비스 완료 동기화를 실행할 수 없습니다.',
        target,
      };
    }
  }

  return {
    success: true,
    runId: 0,
    outcome: 'completed',
    processedCount: 1,
    skippedCount: 0,
    target,
  };
}

async function completeServiceBookingOnce(
  supabaseAdmin: SettlementSyncAdminClient,
  bookingId: string
): Promise<SettlementSyncRunResult> {
  const atomic = await tryCompleteServiceBookingAtomic(supabaseAdmin, bookingId);

  if (atomic.kind === 'error') {
    return {
      success: false,
      status: atomic.status,
      error: atomic.error,
    };
  }

  if (atomic.kind === 'missing') {
    return completeServiceBookingFallback(supabaseAdmin, bookingId);
  }

  const target: SettlementSyncTarget = {
    booking_id: atomic.data.booking_id,
    order_id: atomic.data.order_id || null,
    request_id: atomic.data.request_id,
  };

  if (atomic.data.not_due) {
    return {
      success: true,
      runId: 0,
      outcome: 'not_due',
      processedCount: 0,
      skippedCount: 1,
      target,
    };
  }

  if (atomic.data.already_processed) {
    return {
      success: true,
      runId: 0,
      outcome: 'already_processed',
      processedCount: 0,
      skippedCount: 1,
      target,
    };
  }

  return {
    success: true,
    runId: 0,
    outcome: 'completed',
    processedCount: atomic.data.completed ? 1 : 0,
    skippedCount: atomic.data.completed ? 0 : 1,
    target,
  };
}

export async function runServiceCompletionSync(
  params: SettlementSyncRunDueParams
): Promise<SettlementSyncRunResult> {
  const started = await startSettlementSyncRun({
    supabaseAdmin: params.supabaseAdmin,
    jobName: 'service_completion_sync',
    scope: 'service',
    triggerSource: params.triggerSource,
    initiatedByAdminId: params.initiatedByAdminId,
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
    const candidates = await fetchServiceCompletionCandidates(params.supabaseAdmin);
    if (candidates.length === 0) {
      await finishSettlementSyncRunSuccess({
        supabaseAdmin: params.supabaseAdmin,
        runId: started.runId,
        jobName: 'service_completion_sync',
        startedAt: started.startedAt,
        processedCount: 0,
        skippedCount: 0,
        details: { mode: 'run_due', candidate_count: 0 },
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

    await delay(params.testDelayMs);

    const completedIds: string[] = [];
    const requestIds = new Set<string>();
    let skippedCount = 0;

    for (const candidate of candidates) {
      const result = await completeServiceBookingOnce(params.supabaseAdmin, candidate.id);
      if (!result.success) {
        throw new Error(result.error);
      }

      if (result.outcome === 'completed') {
        completedIds.push(candidate.id);
        if (candidate.request_id) requestIds.add(candidate.request_id);
      } else {
        skippedCount += 1;
      }
    }

    await finishSettlementSyncRunSuccess({
      supabaseAdmin: params.supabaseAdmin,
      runId: started.runId,
      jobName: 'service_completion_sync',
      startedAt: started.startedAt,
      processedCount: completedIds.length,
      skippedCount,
      details: {
        mode: 'run_due',
        booking_ids: completedIds,
        request_ids: Array.from(requestIds),
      },
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
      jobName: 'service_completion_sync',
      startedAt: started.startedAt,
      processedCount: 0,
      skippedCount: 0,
      errorMessage: message,
    });

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
    jobName: 'service_completion_sync_force_one',
    scope: 'service',
    triggerSource: params.triggerSource,
    initiatedByAdminId: params.initiatedByAdminId,
    targetIdentifier: params.identifier,
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
    await delay(params.testDelayMs);
    const result = await completeServiceBookingOnce(params.supabaseAdmin, target.booking_id);
    if (!result.success) {
      await finishSettlementSyncRunFailure({
        supabaseAdmin: params.supabaseAdmin,
        runId: started.runId,
        jobName: 'service_completion_sync_force_one',
        startedAt: started.startedAt,
        processedCount: 0,
        skippedCount: 0,
        errorMessage: result.error,
      });

      return {
        ...result,
        runId: started.runId,
        target: targetSummary,
      };
    }

    await finishSettlementSyncRunSuccess({
      supabaseAdmin: params.supabaseAdmin,
      runId: started.runId,
      jobName: 'service_completion_sync_force_one',
      startedAt: started.startedAt,
      processedCount: result.processedCount,
      skippedCount: result.skippedCount,
      details: {
        mode: 'force_one',
        target: targetSummary,
        outcome: result.outcome,
      },
    });

    return {
      ...result,
      runId: started.runId,
      target: targetSummary,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '서비스 완료 동기화 중 오류가 발생했습니다.';
    await finishSettlementSyncRunFailure({
      supabaseAdmin: params.supabaseAdmin,
      runId: started.runId,
      jobName: 'service_completion_sync_force_one',
      startedAt: started.startedAt,
      processedCount: 0,
      skippedCount: 0,
      errorMessage: message,
    });

    return {
      success: false,
      status: 500,
      error: message,
      runId: started.runId,
      target: targetSummary,
    };
  }
}
