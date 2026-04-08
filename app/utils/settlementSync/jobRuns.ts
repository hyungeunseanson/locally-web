import type {
  SettlementSyncHealthState,
  SettlementSyncJobHealth,
  SettlementSyncJobName,
  SettlementSyncScope,
  SettlementSyncTriggerSource,
} from '@/app/types/admin';

import type {
  SettlementSyncAdminClient,
  SettlementSyncDueBacklog,
  SettlementSyncJobRunRecord,
} from './types';

type JobRunStartParams = {
  supabaseAdmin: SettlementSyncAdminClient;
  jobName: string;
  scope: SettlementSyncScope;
  triggerSource: SettlementSyncTriggerSource;
  initiatedByAdminId?: string | null;
  targetIdentifier?: string | null;
};

type JobRunFinishParams = {
  supabaseAdmin: SettlementSyncAdminClient;
  runId: number;
  jobName: string;
  startedAt: string;
  processedCount: number;
  skippedCount: number;
  errorMessage?: string | null;
  details?: Record<string, unknown>;
};

type JobRunStartResult =
  | {
      ok: true;
      runId: number;
      startedAt: string;
      store: 'table' | 'audit_fallback';
    }
  | {
      ok: false;
      alreadyRunning: true;
    };

type JobRunsTableRow = {
  id: number;
  job_name: string;
  scope: SettlementSyncScope;
  trigger_source: SettlementSyncTriggerSource;
  status: SettlementSyncJobRunRecord['status'];
  started_at: string;
  finished_at: string | null;
  processed_count: number;
  skipped_count: number;
  error_message: string | null;
};

type AuditLogRow = {
  id: number;
  action_type: string;
  target_id: string;
  created_at: string;
  details: Record<string, unknown> | null;
};

type FallbackLockEntry = {
  runId: number;
  startedAt: string;
};

const JOB_RUN_START_ACTION = 'SETTLEMENT_SYNC_START';
const JOB_RUN_SUCCESS_ACTION = 'SETTLEMENT_SYNC_SUCCESS';
const JOB_RUN_FAILED_ACTION = 'SETTLEMENT_SYNC_FAILED';
const JOB_RUN_ABANDONED_ACTION = 'SETTLEMENT_SYNC_ABANDONED';
const JOB_RUN_AUDIT_TARGET = 'settlement_sync';
const DEFAULT_RUNNING_STALE_MINUTES = 15;
const DEFAULT_DELAY_WARNING_MINUTES = 120;
const fallbackLocks = new Map<string, FallbackLockEntry>();

function getCombinedErrorMessage(error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null }) {
  return `${error.code || ''} ${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
}

function isMissingAdminJobRunsError(error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | null | undefined) {
  if (!error) return false;
  const combined = getCombinedErrorMessage(error);
  return (
    error.code === 'PGRST205' ||
    (combined.includes('admin_job_runs') &&
      (combined.includes('does not exist') ||
        combined.includes('Could not find') ||
        combined.includes('No function matches')))
  );
}

function isUniqueViolationError(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) return false;
  return error.code === '23505' || String(error.message || '').toLowerCase().includes('duplicate key');
}

export function getSettlementSyncRunningStaleMinutes() {
  const parsed = Number(process.env.SETTLEMENT_SYNC_RUNNING_STALE_MINUTES || DEFAULT_RUNNING_STALE_MINUTES);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RUNNING_STALE_MINUTES;
}

export function getSettlementSyncDelayWarningMinutes() {
  const parsed = Number(process.env.SETTLEMENT_SYNC_DELAY_WARNING_MINUTES || DEFAULT_DELAY_WARNING_MINUTES);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DELAY_WARNING_MINUTES;
}

function isStaleStartedAt(startedAt: string, staleMinutes: number) {
  const started = new Date(startedAt);
  if (Number.isNaN(started.getTime())) return true;
  return Date.now() - started.getTime() > staleMinutes * 60 * 1000;
}

async function insertAuditEvent(params: {
  supabaseAdmin: SettlementSyncAdminClient;
  actionType: string;
  targetId: string;
  details: Record<string, unknown>;
}) {
  const { data, error } = await params.supabaseAdmin
    .from('admin_audit_logs')
    .insert({
      action_type: params.actionType,
      target_type: JOB_RUN_AUDIT_TARGET,
      target_id: params.targetId,
      details: params.details,
    })
    .select('id, created_at')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Failed to write settlement sync audit event.');
  }

  return {
    id: Number(data.id),
    createdAt: String(data.created_at),
  };
}

async function markStaleTableRunsAbandoned(
  supabaseAdmin: SettlementSyncAdminClient,
  jobName: string
) {
  const staleCutoff = new Date(Date.now() - getSettlementSyncRunningStaleMinutes() * 60 * 1000).toISOString();

  const { data: staleRows, error: fetchError } = await supabaseAdmin
    .from('admin_job_runs')
    .select('id, started_at')
    .eq('job_name', jobName)
    .eq('status', 'running')
    .lt('started_at', staleCutoff);

  if (fetchError) {
    if (isMissingAdminJobRunsError(fetchError)) {
      return { missingTable: true as const };
    }

    throw fetchError;
  }

  const staleIds = (staleRows || []).map((row) => Number((row as { id: number }).id)).filter(Number.isFinite);
  if (staleIds.length === 0) {
    return { missingTable: false as const };
  }

  const { error: updateError } = await supabaseAdmin
    .from('admin_job_runs')
    .update({
      status: 'abandoned',
      finished_at: new Date().toISOString(),
      error_message: 'Stale running settlement sync abandoned before new execution.',
    })
    .in('id', staleIds)
    .eq('status', 'running');

  if (updateError) throw updateError;
  return { missingTable: false as const };
}

async function startTableRun(params: JobRunStartParams): Promise<JobRunStartResult | null> {
  const staleResult = await markStaleTableRunsAbandoned(params.supabaseAdmin, params.jobName);
  if (staleResult.missingTable) {
    return null;
  }

  const startedAt = new Date().toISOString();
  const { data, error } = await params.supabaseAdmin
    .from('admin_job_runs')
    .insert({
      job_name: params.jobName,
      trigger_source: params.triggerSource,
      scope: params.scope,
      status: 'running',
      started_at: startedAt,
      initiated_by_admin_id: params.initiatedByAdminId || null,
      target_identifier: params.targetIdentifier || null,
      details: {},
    })
    .select('id, started_at')
    .single();

  if (error) {
    if (isMissingAdminJobRunsError(error)) {
      return null;
    }

    if (isUniqueViolationError(error)) {
      return { ok: false, alreadyRunning: true };
    }

    throw error;
  }

  return {
    ok: true,
    runId: Number(data.id),
    startedAt: String(data.started_at || startedAt),
    store: 'table',
  };
}

async function recordFallbackAbandonedLock(
  supabaseAdmin: SettlementSyncAdminClient,
  jobName: string,
  entry: FallbackLockEntry
) {
  await insertAuditEvent({
    supabaseAdmin,
    actionType: JOB_RUN_ABANDONED_ACTION,
    targetId: String(entry.runId),
    details: {
      job_name: jobName,
      run_id: entry.runId,
      status: 'abandoned',
      started_at: entry.startedAt,
      finished_at: new Date().toISOString(),
      error_message: 'Stale in-memory fallback lock abandoned before new execution.',
      processed_count: 0,
      skipped_count: 0,
    },
  });
}

async function startFallbackRun(params: JobRunStartParams): Promise<JobRunStartResult> {
  const staleMinutes = getSettlementSyncRunningStaleMinutes();
  const existing = fallbackLocks.get(params.jobName);
  if (existing) {
    if (isStaleStartedAt(existing.startedAt, staleMinutes)) {
      await recordFallbackAbandonedLock(params.supabaseAdmin, params.jobName, existing);
      fallbackLocks.delete(params.jobName);
    } else {
      return { ok: false, alreadyRunning: true };
    }
  }

  const startEvent = await insertAuditEvent({
    supabaseAdmin: params.supabaseAdmin,
    actionType: JOB_RUN_START_ACTION,
    targetId: params.jobName,
    details: {
      job_name: params.jobName,
      scope: params.scope,
      trigger_source: params.triggerSource,
      target_identifier: params.targetIdentifier || null,
      initiated_by_admin_id: params.initiatedByAdminId || null,
      started_at: new Date().toISOString(),
      status: 'running',
    },
  });

  fallbackLocks.set(params.jobName, {
    runId: startEvent.id,
    startedAt: startEvent.createdAt,
  });

  return {
    ok: true,
    runId: startEvent.id,
    startedAt: startEvent.createdAt,
    store: 'audit_fallback',
  };
}

export async function startSettlementSyncRun(params: JobRunStartParams): Promise<JobRunStartResult> {
  const tableResult = await startTableRun(params);
  if (tableResult) {
    return tableResult;
  }

  return startFallbackRun(params);
}

export async function finishSettlementSyncRunSuccess(params: JobRunFinishParams) {
  const finishedAt = new Date().toISOString();
  const durationMs = Math.max(0, new Date(finishedAt).getTime() - new Date(params.startedAt).getTime());

  const { error } = await params.supabaseAdmin
    .from('admin_job_runs')
    .update({
      status: 'success',
      finished_at: finishedAt,
      duration_ms: durationMs,
      processed_count: params.processedCount,
      skipped_count: params.skippedCount,
      error_message: null,
      details: params.details || {},
    })
    .eq('id', params.runId);

  if (error) {
    if (!isMissingAdminJobRunsError(error)) {
      throw error;
    }

    fallbackLocks.delete(params.jobName);
    await insertAuditEvent({
      supabaseAdmin: params.supabaseAdmin,
      actionType: JOB_RUN_SUCCESS_ACTION,
      targetId: String(params.runId),
      details: {
        job_name: params.jobName,
        run_id: params.runId,
        status: 'success',
        started_at: params.startedAt,
        finished_at: finishedAt,
        duration_ms: durationMs,
        processed_count: params.processedCount,
        skipped_count: params.skippedCount,
        ...(params.details || {}),
      },
    });
  }
}

export async function finishSettlementSyncRunFailure(params: JobRunFinishParams) {
  const finishedAt = new Date().toISOString();
  const durationMs = Math.max(0, new Date(finishedAt).getTime() - new Date(params.startedAt).getTime());

  const { error } = await params.supabaseAdmin
    .from('admin_job_runs')
    .update({
      status: 'failed',
      finished_at: finishedAt,
      duration_ms: durationMs,
      processed_count: params.processedCount,
      skipped_count: params.skippedCount,
      error_message: params.errorMessage || 'Settlement sync failed.',
      details: params.details || {},
    })
    .eq('id', params.runId);

  if (error) {
    if (!isMissingAdminJobRunsError(error)) {
      throw error;
    }

    fallbackLocks.delete(params.jobName);
    await insertAuditEvent({
      supabaseAdmin: params.supabaseAdmin,
      actionType: JOB_RUN_FAILED_ACTION,
      targetId: String(params.runId),
      details: {
        job_name: params.jobName,
        run_id: params.runId,
        status: 'failed',
        started_at: params.startedAt,
        finished_at: finishedAt,
        duration_ms: durationMs,
        processed_count: params.processedCount,
        skipped_count: params.skippedCount,
        error_message: params.errorMessage || 'Settlement sync failed.',
        ...(params.details || {}),
      },
    });
  }
}

async function loadTableRunHistory(
  supabaseAdmin: SettlementSyncAdminClient,
  jobNames: SettlementSyncJobName[]
): Promise<SettlementSyncJobRunRecord[] | null> {
  const { data, error } = await supabaseAdmin
    .from('admin_job_runs')
    .select('id, job_name, scope, trigger_source, status, started_at, finished_at, processed_count, skipped_count, error_message')
    .in('job_name', jobNames)
    .order('started_at', { ascending: false })
    .limit(100);

  if (error) {
    if (isMissingAdminJobRunsError(error)) {
      return null;
    }

    throw error;
  }

  return ((data || []) as JobRunsTableRow[]).map((row) => ({
    runId: Number(row.id),
    jobName: row.job_name,
    scope: row.scope,
    triggerSource: row.trigger_source,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    processedCount: Number(row.processed_count || 0),
    skippedCount: Number(row.skipped_count || 0),
    errorMessage: row.error_message || null,
  }));
}

function normalizeFallbackRunHistory(rows: AuditLogRow[]): SettlementSyncJobRunRecord[] {
  const runMap = new Map<number, SettlementSyncJobRunRecord>();

  rows.forEach((row) => {
    const details = row.details || {};
    const detailRunId = Number(details.run_id || 0);
    const runId = row.action_type === JOB_RUN_START_ACTION ? Number(row.id) : detailRunId;
    const jobName = String(details.job_name || '');

    if (!runId || !jobName) {
      return;
    }

    const existing = runMap.get(runId);
    if (row.action_type === JOB_RUN_START_ACTION) {
      const startedAt = String(details.started_at || row.created_at);
      runMap.set(runId, {
        runId,
        jobName,
        scope: (details.scope as SettlementSyncScope) || (jobName.includes('service') ? 'service' : 'experience'),
        triggerSource: (details.trigger_source as SettlementSyncTriggerSource) || 'cron',
        status: 'running',
        startedAt,
        finishedAt: null,
        processedCount: 0,
        skippedCount: 0,
        errorMessage: null,
      });
      return;
    }

    const base =
      existing ||
      ({
        runId,
        jobName,
        scope: (details.scope as SettlementSyncScope) || (jobName.includes('service') ? 'service' : 'experience'),
        triggerSource: (details.trigger_source as SettlementSyncTriggerSource) || 'cron',
        status: 'running',
        startedAt: String(details.started_at || row.created_at),
        finishedAt: null,
        processedCount: 0,
        skippedCount: 0,
        errorMessage: null,
      } satisfies SettlementSyncJobRunRecord);

    const nextStatus =
      row.action_type === JOB_RUN_SUCCESS_ACTION
        ? 'success'
        : row.action_type === JOB_RUN_FAILED_ACTION
          ? 'failed'
          : 'abandoned';

    runMap.set(runId, {
      ...base,
      status: nextStatus,
      finishedAt: String(details.finished_at || row.created_at),
      processedCount: Number(details.processed_count || 0),
      skippedCount: Number(details.skipped_count || 0),
      errorMessage: typeof details.error_message === 'string' ? details.error_message : null,
    });
  });

  return Array.from(runMap.values()).sort((left, right) =>
    left.startedAt < right.startedAt ? 1 : -1
  );
}

async function loadFallbackRunHistory(
  supabaseAdmin: SettlementSyncAdminClient,
  jobNames: SettlementSyncJobName[]
) {
  const { data, error } = await supabaseAdmin
    .from('admin_audit_logs')
    .select('id, action_type, target_id, created_at, details')
    .eq('target_type', JOB_RUN_AUDIT_TARGET)
    .in('action_type', [
      JOB_RUN_START_ACTION,
      JOB_RUN_SUCCESS_ACTION,
      JOB_RUN_FAILED_ACTION,
      JOB_RUN_ABANDONED_ACTION,
    ])
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;

  return normalizeFallbackRunHistory((data || []) as AuditLogRow[]).filter((row) =>
    jobNames.includes(row.jobName as SettlementSyncJobName)
  );
}

export async function loadSettlementSyncRunHistory(
  supabaseAdmin: SettlementSyncAdminClient,
  jobNames: SettlementSyncJobName[]
) {
  const tableHistory = await loadTableRunHistory(supabaseAdmin, jobNames);
  if (tableHistory) {
    return tableHistory;
  }

  return loadFallbackRunHistory(supabaseAdmin, jobNames);
}

export function buildSettlementSyncJobHealth(params: {
  jobName: SettlementSyncJobName;
  runs: SettlementSyncJobRunRecord[];
  backlog: SettlementSyncDueBacklog;
}): SettlementSyncJobHealth {
  const staleMinutes = getSettlementSyncRunningStaleMinutes();
  const delayWarningMinutes = getSettlementSyncDelayWarningMinutes();
  const runningRun = params.runs.find((run) => run.status === 'running') || null;
  const lastSuccess = params.runs.find((run) => run.status === 'success') || null;
  const lastFailure =
    params.runs.find((run) => run.status === 'failed' || run.status === 'abandoned') || null;

  let healthState: SettlementSyncHealthState = 'healthy';
  if (runningRun) {
    healthState = isStaleStartedAt(runningRun.startedAt, staleMinutes) ? 'running_stale' : 'running';
  } else if (lastFailure && (!lastSuccess || lastFailure.startedAt > lastSuccess.startedAt)) {
    healthState = 'failed';
  } else if (
    params.backlog.count > 0 &&
    params.backlog.lagMinutes != null &&
    params.backlog.lagMinutes > delayWarningMinutes
  ) {
    healthState = 'delayed';
  }

  return {
    job_name: params.jobName,
    health_state: healthState,
    is_running: Boolean(runningRun),
    running_since: runningRun?.startedAt || null,
    stale_running: runningRun ? isStaleStartedAt(runningRun.startedAt, staleMinutes) : false,
    last_success_at: lastSuccess?.finishedAt || lastSuccess?.startedAt || null,
    last_failure_at: lastFailure?.finishedAt || lastFailure?.startedAt || null,
    last_failure_message: lastFailure?.errorMessage || null,
    last_processed_count: lastSuccess?.processedCount ?? null,
    due_candidate_count: params.backlog.count,
    oldest_due_at: params.backlog.oldestDueAt,
    lag_minutes: params.backlog.lagMinutes,
  };
}
