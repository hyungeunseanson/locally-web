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
import {
  SettlementSyncInfrastructureError,
  SettlementSyncLeaseLostError,
} from './types';

type JobRunStartParams = {
  supabaseAdmin: SettlementSyncAdminClient;
  jobName: string;
  scope: SettlementSyncScope;
  triggerSource: SettlementSyncTriggerSource;
  initiatedByAdminId?: string | null;
  targetIdentifier?: string | null;
  testLeaseMs?: number;
  simulateMissingAdminJobRuns?: boolean;
};

type JobRunFinishParams = {
  supabaseAdmin: SettlementSyncAdminClient;
  runId: number;
  jobName: string;
  startedAt: string;
  leaseToken: string;
  processedCount: number;
  skippedCount: number;
  errorMessage?: string | null;
  details?: Record<string, unknown>;
  testLeaseMs?: number;
  simulateMissingAdminJobRuns?: boolean;
};

type RenewLeaseParams = {
  supabaseAdmin: SettlementSyncAdminClient;
  runId: number;
  jobName: string;
  leaseToken: string;
  testLeaseMs?: number;
  simulateMissingAdminJobRuns?: boolean;
};

type JobRunStartResult =
  | {
      ok: true;
      runId: number;
      startedAt: string;
      leaseToken: string;
      leaseExpiresAt: string;
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
  lease_token: string | null;
  lease_expires_at: string | null;
  last_heartbeat_at: string | null;
};

const DEFAULT_RUNNING_STALE_MINUTES = 15;
const DEFAULT_DELAY_WARNING_MINUTES = 120;
const DEFAULT_LEASE_SECONDS = 120;

function ensureAdminJobRunsAvailable(
  simulateMissingAdminJobRuns?: boolean,
  fallbackMessage?: string
) {
  if (simulateMissingAdminJobRuns) {
    throw new SettlementSyncInfrastructureError(fallbackMessage);
  }
}

function asAdminJobRunsInfrastructureError(
  error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null },
  fallbackMessage?: string
) {
  console.error('[settlement sync] admin_job_runs access failed:', error);
  return new SettlementSyncInfrastructureError(fallbackMessage);
}

function isUniqueViolationError(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) return false;
  return error.code === '23505' || String(error.message || '').toLowerCase().includes('duplicate key');
}

function buildLeaseExpiry(startedAt: string, leaseMs: number) {
  return new Date(new Date(startedAt).getTime() + leaseMs).toISOString();
}

function isExpiredLease(leaseExpiresAt: string | null) {
  if (!leaseExpiresAt) return true;
  const leaseDate = new Date(leaseExpiresAt);
  if (Number.isNaN(leaseDate.getTime())) return true;
  return Date.now() > leaseDate.getTime();
}

export function getSettlementSyncRunningStaleMinutes() {
  const parsed = Number(
    process.env.SETTLEMENT_SYNC_RUNNING_STALE_MINUTES || DEFAULT_RUNNING_STALE_MINUTES
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RUNNING_STALE_MINUTES;
}

export function getSettlementSyncDelayWarningMinutes() {
  const parsed = Number(
    process.env.SETTLEMENT_SYNC_DELAY_WARNING_MINUTES || DEFAULT_DELAY_WARNING_MINUTES
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DELAY_WARNING_MINUTES;
}

export function getSettlementSyncLeaseMs(overrideMs?: number) {
  if (overrideMs && Number.isFinite(overrideMs) && overrideMs > 0) {
    return overrideMs;
  }

  const parsed = Number(process.env.SETTLEMENT_SYNC_LEASE_SECONDS || DEFAULT_LEASE_SECONDS);
  const seconds = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LEASE_SECONDS;
  return seconds * 1000;
}

async function markExpiredTableRunsAbandoned(params: JobRunStartParams) {
  ensureAdminJobRunsAvailable(params.simulateMissingAdminJobRuns);

  const nowIso = new Date().toISOString();
  const { error } = await params.supabaseAdmin
    .from('admin_job_runs')
    .update({
      status: 'abandoned',
      finished_at: nowIso,
      last_heartbeat_at: nowIso,
      error_message: 'Expired settlement sync lease abandoned before new execution.',
    })
    .eq('job_name', params.jobName)
    .eq('status', 'running')
    .lt('lease_expires_at', nowIso);

  if (error) {
    throw asAdminJobRunsInfrastructureError(error);
  }
}

export async function startSettlementSyncRun(
  params: JobRunStartParams
): Promise<JobRunStartResult> {
  await markExpiredTableRunsAbandoned(params);

  const startedAt = new Date().toISOString();
  const leaseToken = crypto.randomUUID();
  const leaseExpiresAt = buildLeaseExpiry(startedAt, getSettlementSyncLeaseMs(params.testLeaseMs));

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
      lease_token: leaseToken,
      lease_expires_at: leaseExpiresAt,
      last_heartbeat_at: startedAt,
    })
    .select('id, started_at, lease_expires_at')
    .single();

  if (error) {
    if (isUniqueViolationError(error)) {
      return { ok: false, alreadyRunning: true };
    }

    throw asAdminJobRunsInfrastructureError(error);
  }

  return {
    ok: true,
    runId: Number(data.id),
    startedAt: String(data.started_at || startedAt),
    leaseToken,
    leaseExpiresAt: String(data.lease_expires_at || leaseExpiresAt),
  };
}

export async function renewSettlementSyncRunLease(params: RenewLeaseParams) {
  ensureAdminJobRunsAvailable(params.simulateMissingAdminJobRuns);

  const heartbeatAt = new Date().toISOString();
  const leaseExpiresAt = buildLeaseExpiry(
    heartbeatAt,
    getSettlementSyncLeaseMs(params.testLeaseMs)
  );

  const { data, error } = await params.supabaseAdmin
    .from('admin_job_runs')
    .update({
      last_heartbeat_at: heartbeatAt,
      lease_expires_at: leaseExpiresAt,
    })
    .eq('id', params.runId)
    .eq('job_name', params.jobName)
    .eq('status', 'running')
    .eq('lease_token', params.leaseToken)
    .select('id')
    .maybeSingle();

  if (error) {
    throw asAdminJobRunsInfrastructureError(error);
  }

  if (!data?.id) {
    throw new SettlementSyncLeaseLostError();
  }

  return {
    lastHeartbeatAt: heartbeatAt,
    leaseExpiresAt,
  };
}

export async function finishSettlementSyncRunSuccess(params: JobRunFinishParams) {
  ensureAdminJobRunsAvailable(params.simulateMissingAdminJobRuns);

  const finishedAt = new Date().toISOString();
  const durationMs = Math.max(
    0,
    new Date(finishedAt).getTime() - new Date(params.startedAt).getTime()
  );

  const { data, error } = await params.supabaseAdmin
    .from('admin_job_runs')
    .update({
      status: 'success',
      finished_at: finishedAt,
      duration_ms: durationMs,
      processed_count: params.processedCount,
      skipped_count: params.skippedCount,
      error_message: null,
      details: params.details || {},
      last_heartbeat_at: finishedAt,
      lease_expires_at: finishedAt,
    })
    .eq('id', params.runId)
    .eq('job_name', params.jobName)
    .eq('status', 'running')
    .eq('lease_token', params.leaseToken)
    .select('id')
    .maybeSingle();

  if (error) {
    throw asAdminJobRunsInfrastructureError(error);
  }

  if (!data?.id) {
    throw new SettlementSyncLeaseLostError();
  }
}

export async function finishSettlementSyncRunFailure(params: JobRunFinishParams) {
  ensureAdminJobRunsAvailable(params.simulateMissingAdminJobRuns);

  const finishedAt = new Date().toISOString();
  const durationMs = Math.max(
    0,
    new Date(finishedAt).getTime() - new Date(params.startedAt).getTime()
  );

  const { data, error } = await params.supabaseAdmin
    .from('admin_job_runs')
    .update({
      status: 'failed',
      finished_at: finishedAt,
      duration_ms: durationMs,
      processed_count: params.processedCount,
      skipped_count: params.skippedCount,
      error_message: params.errorMessage || 'Settlement sync failed.',
      details: params.details || {},
      last_heartbeat_at: finishedAt,
      lease_expires_at: finishedAt,
    })
    .eq('id', params.runId)
    .eq('job_name', params.jobName)
    .eq('status', 'running')
    .eq('lease_token', params.leaseToken)
    .select('id')
    .maybeSingle();

  if (error) {
    throw asAdminJobRunsInfrastructureError(error);
  }

  if (!data?.id) {
    throw new SettlementSyncLeaseLostError();
  }
}

export async function loadSettlementSyncRunHistory(
  supabaseAdmin: SettlementSyncAdminClient,
  jobNames: SettlementSyncJobName[],
  simulateMissingAdminJobRuns?: boolean
) {
  ensureAdminJobRunsAvailable(simulateMissingAdminJobRuns);

  const { data, error } = await supabaseAdmin
    .from('admin_job_runs')
    .select(
      'id, job_name, scope, trigger_source, status, started_at, finished_at, processed_count, skipped_count, error_message, lease_token, lease_expires_at, last_heartbeat_at'
    )
    .in('job_name', jobNames)
    .order('started_at', { ascending: false })
    .limit(100);

  if (error) {
    throw asAdminJobRunsInfrastructureError(error);
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
    leaseToken: row.lease_token || null,
    leaseExpiresAt: row.lease_expires_at || null,
    lastHeartbeatAt: row.last_heartbeat_at || null,
  }));
}

export function buildSettlementSyncJobHealth(params: {
  jobName: SettlementSyncJobName;
  runs: SettlementSyncJobRunRecord[];
  backlog: SettlementSyncDueBacklog;
}): SettlementSyncJobHealth {
  const delayWarningMinutes = getSettlementSyncDelayWarningMinutes();
  const runningRun = params.runs.find((run) => run.status === 'running') || null;
  const lastSuccess = params.runs.find((run) => run.status === 'success') || null;
  const lastFailure =
    params.runs.find((run) => run.status === 'failed' || run.status === 'abandoned') || null;

  let healthState: SettlementSyncHealthState = 'healthy';
  const staleRunning = runningRun ? isExpiredLease(runningRun.leaseExpiresAt) : false;
  if (runningRun) {
    healthState = staleRunning ? 'running_stale' : 'running';
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
    stale_running: staleRunning,
    last_heartbeat_at: runningRun?.lastHeartbeatAt || null,
    last_success_at: lastSuccess?.finishedAt || lastSuccess?.startedAt || null,
    last_failure_at: lastFailure?.finishedAt || lastFailure?.startedAt || null,
    last_failure_message: lastFailure?.errorMessage || null,
    last_processed_count: lastSuccess?.processedCount ?? null,
    due_candidate_count: params.backlog.count,
    oldest_due_at: params.backlog.oldestDueAt,
    lag_minutes: params.backlog.lagMinutes,
  };
}
