import { BOOKING_ACTIVE_STATUS_FOR_CAPACITY } from '@/app/constants/bookingStatus';

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

type ExperienceCompletionRow = {
  id: string;
  order_id: string | null;
  user_id: string | null;
  date: string | null;
  time: string | null;
  status: string;
  experiences: { title?: string | null } | Array<{ title?: string | null }> | null;
};

function normalizeExperienceTitle(value: ExperienceCompletionRow['experiences']) {
  if (Array.isArray(value)) {
    return value[0]?.title || '체험';
  }

  return value?.title || '체험';
}

function getExperienceDueDate(row: Pick<ExperienceCompletionRow, 'date' | 'time'>) {
  if (!row.date) return null;
  const dueDate = new Date(`${row.date}T${row.time || '00:00'}`);
  if (Number.isNaN(dueDate.getTime())) return null;
  return dueDate;
}

function isExperienceDue(row: Pick<ExperienceCompletionRow, 'date' | 'time'>) {
  const dueDate = getExperienceDueDate(row);
  return Boolean(dueDate && dueDate < new Date());
}

function delay(ms?: number) {
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendReviewRequestNotifications(
  supabaseAdmin: SettlementSyncAdminClient,
  rows: Array<ExperienceCompletionRow>
) {
  if (rows.length === 0) return;

  const createdAt = new Date().toISOString();
  const notifications = rows
    .filter((row) => row.user_id)
    .map((row) => ({
      user_id: row.user_id,
      type: 'review_request',
      title: '후기를 남겨주세요!',
      message: `'${normalizeExperienceTitle(row.experiences)}' 어떠셨나요? 소중한 후기를 남겨주세요.`,
      link: '/guest/trips',
      is_read: false,
      created_at: createdAt,
    }));

  if (notifications.length === 0) return;

  const { error } = await supabaseAdmin.from('notifications').insert(notifications);
  if (error) {
    console.error('[settlement sync] experience review_request insert failed:', error);
  }
}

async function fetchExperienceCompletionCandidates(
  supabaseAdmin: SettlementSyncAdminClient
) {
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select('id, order_id, user_id, date, time, status, experiences(title)')
    .in('status', [...BOOKING_ACTIVE_STATUS_FOR_CAPACITY]);

  if (error) throw error;
  return (data || []) as ExperienceCompletionRow[];
}

export async function resolveExperienceCompletionTarget(
  supabaseAdmin: SettlementSyncAdminClient,
  identifier: string
): Promise<(SettlementSyncTarget & Pick<ExperienceCompletionRow, 'date' | 'time' | 'status' | 'user_id' | 'experiences'>) | null> {
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
    return {
      ...(idMatch.data as ExperienceCompletionRow),
      booking_id: idMatch.data.id,
      order_id: idMatch.data.order_id,
    };
  }

  const orderMatch = await query('order_id');
  if (orderMatch.error) throw orderMatch.error;
  if (!orderMatch.data) return null;

  return {
    ...(orderMatch.data as ExperienceCompletionRow),
    booking_id: orderMatch.data.id,
    order_id: orderMatch.data.order_id,
  };
}

export async function runExperienceCompletionSync(
  params: SettlementSyncRunDueParams
): Promise<SettlementSyncRunResult> {
  const started = await startSettlementSyncRun({
    supabaseAdmin: params.supabaseAdmin,
    jobName: 'experience_completion_sync',
    scope: 'experience',
    triggerSource: params.triggerSource,
    initiatedByAdminId: params.initiatedByAdminId,
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

  try {
    const candidates = await fetchExperienceCompletionCandidates(params.supabaseAdmin);
    const dueCandidates = candidates.filter((row) => isExperienceDue(row));

    if (dueCandidates.length === 0) {
      await finishSettlementSyncRunSuccess({
        supabaseAdmin: params.supabaseAdmin,
        runId: started.runId,
        jobName: 'experience_completion_sync',
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
        details: { booking_ids: [] },
      };
    }

    await delay(params.testDelayMs);

    const dueMap = new Map(dueCandidates.map((row) => [row.id, row]));
    const { data: updatedRowsRaw, error: updateError } = await params.supabaseAdmin
      .from('bookings')
      .update({ status: 'completed' })
      .in('id', dueCandidates.map((row) => row.id))
      .in('status', [...BOOKING_ACTIVE_STATUS_FOR_CAPACITY])
      .select('id, order_id, user_id');

    if (updateError) throw updateError;

    const updatedIds = ((updatedRowsRaw || []) as Array<Pick<ExperienceCompletionRow, 'id' | 'order_id' | 'user_id'>>).map((row) => row.id);
    const updatedRows = updatedIds
      .map((id) => dueMap.get(id))
      .filter(Boolean) as ExperienceCompletionRow[];

    await sendReviewRequestNotifications(params.supabaseAdmin, updatedRows);

    await finishSettlementSyncRunSuccess({
      supabaseAdmin: params.supabaseAdmin,
      runId: started.runId,
      jobName: 'experience_completion_sync',
      startedAt: started.startedAt,
      processedCount: updatedRows.length,
      skippedCount: Math.max(0, dueCandidates.length - updatedRows.length),
      details: {
        mode: 'run_due',
        booking_ids: updatedIds,
      },
    });

    return {
      success: true,
      runId: started.runId,
      outcome: 'completed',
      processedCount: updatedRows.length,
      skippedCount: Math.max(0, dueCandidates.length - updatedRows.length),
      details: { booking_ids: updatedIds },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '체험 완료 동기화 중 오류가 발생했습니다.';
    await finishSettlementSyncRunFailure({
      supabaseAdmin: params.supabaseAdmin,
      runId: started.runId,
      jobName: 'experience_completion_sync_force_one',
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

export async function forceExperienceCompletionSync(
  params: SettlementSyncForceOneParams
): Promise<SettlementSyncRunResult> {
  const target = await resolveExperienceCompletionTarget(params.supabaseAdmin, params.identifier);
  if (!target) {
    return { success: false, status: 404, error: '체험 예약을 찾을 수 없습니다.' };
  }

  const started = await startSettlementSyncRun({
    supabaseAdmin: params.supabaseAdmin,
    jobName: 'experience_completion_sync_force_one',
    scope: 'experience',
    triggerSource: params.triggerSource,
    initiatedByAdminId: params.initiatedByAdminId,
    targetIdentifier: params.identifier,
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
    const targetSummary: SettlementSyncTarget = {
      booking_id: target.booking_id,
      order_id: target.order_id,
    };

    if (String(target.status || '').toLowerCase() === 'completed') {
      await finishSettlementSyncRunSuccess({
        supabaseAdmin: params.supabaseAdmin,
        runId: started.runId,
        jobName: 'experience_completion_sync_force_one',
        startedAt: started.startedAt,
        processedCount: 0,
        skippedCount: 1,
        details: { mode: 'force_one', target: targetSummary, outcome: 'already_processed' },
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

    if (!BOOKING_ACTIVE_STATUS_FOR_CAPACITY.includes(target.status as (typeof BOOKING_ACTIVE_STATUS_FOR_CAPACITY)[number])) {
      await finishSettlementSyncRunFailure({
        supabaseAdmin: params.supabaseAdmin,
        runId: started.runId,
        jobName: 'experience_completion_sync_force_one',
        startedAt: started.startedAt,
        processedCount: 0,
        skippedCount: 1,
        errorMessage: '현재 상태에서는 체험 완료 동기화를 실행할 수 없습니다.',
      });

      return {
        success: false,
        status: 409,
        error: '현재 상태에서는 체험 완료 동기화를 실행할 수 없습니다.',
        runId: started.runId,
        target: targetSummary,
      };
    }

    if (!isExperienceDue(target)) {
      await finishSettlementSyncRunSuccess({
        supabaseAdmin: params.supabaseAdmin,
        runId: started.runId,
        jobName: 'experience_completion_sync_force_one',
        startedAt: started.startedAt,
        processedCount: 0,
        skippedCount: 1,
        details: { mode: 'force_one', target: targetSummary, outcome: 'not_due' },
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

    await delay(params.testDelayMs);

    const { data: updatedRowsRaw, error: updateError } = await params.supabaseAdmin
      .from('bookings')
      .update({ status: 'completed' })
      .eq('id', target.booking_id)
      .in('status', [...BOOKING_ACTIVE_STATUS_FOR_CAPACITY])
      .select('id, order_id, user_id');

    if (updateError) throw updateError;

    if ((updatedRowsRaw || []).length === 1) {
      await sendReviewRequestNotifications(params.supabaseAdmin, [target]);
      await finishSettlementSyncRunSuccess({
        supabaseAdmin: params.supabaseAdmin,
        runId: started.runId,
        jobName: 'experience_completion_sync_force_one',
        startedAt: started.startedAt,
        processedCount: 1,
        skippedCount: 0,
        details: { mode: 'force_one', target: targetSummary, outcome: 'completed' },
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

    const latestTarget = await resolveExperienceCompletionTarget(params.supabaseAdmin, target.booking_id);
    const latestStatus = String(latestTarget?.status || '').toLowerCase();
    const outcome = latestStatus === 'completed' ? 'already_processed' : 'not_due';

    await finishSettlementSyncRunSuccess({
      supabaseAdmin: params.supabaseAdmin,
      runId: started.runId,
      jobName: 'experience_completion_sync_force_one',
      startedAt: started.startedAt,
      processedCount: 0,
      skippedCount: 1,
      details: { mode: 'force_one', target: targetSummary, outcome },
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
      jobName: 'experience_completion_sync',
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
      target: {
        booking_id: target.booking_id,
        order_id: target.order_id,
      },
    };
  }
}
