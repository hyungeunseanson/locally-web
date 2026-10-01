import type { SupabaseClient } from '@supabase/supabase-js';

import {
  OPS_ANOMALY_DEFINITIONS,
  OPS_ANOMALY_QUEUE_CONTRACT,
  OPS_ANOMALY_THRESHOLDS,
} from './config';
import type {
  OpsAnomaly,
  OpsAnomalyDiagnosticCode,
  OpsAnomalySeverity,
} from './types';

type DatabaseSnapshotRow = {
  diagnostic_code: string;
  anomaly_count: number | string | null;
  oldest_observed_at: string | null;
  aggregate_details: Record<string, unknown> | null;
};

type QueueInventoryRow = {
  queue_id?: unknown;
  queue_name?: unknown;
};

type QueueMetrics = {
  backlog_count?: unknown;
  oldest_message_timestamp_ms?: unknown;
};

type CloudflareEnvelope<T> = {
  success?: boolean;
  result?: T;
  errors?: Array<{ code?: unknown }>;
};

export type OpsAnomalyQueueRuntime = {
  CLOUDFLARE_ACCOUNT_ID?: string;
  OPS_ANOMALY_MONITOR_CLOUDFLARE_API_TOKEN?: string;
};

const DATABASE_DIAGNOSTIC_CODES = new Set<OpsAnomalyDiagnosticCode>([
  'payment_reconciliation_required',
  'payment_state_inconsistent',
  'refund_attention_required',
  'payout_attention_required',
  'job_stale_or_failed',
]);

type QueueReadStage = 'inventory' | 'metrics';

// Inventory is followed by four parallel metrics reads: at most 49.4s of
// request/backoff waiting, comfortably below the existing 120s job lease.
export const OPS_QUEUE_READ_TIMEOUT_MS = 8_000;
export const OPS_QUEUE_READ_RETRY_BACKOFF_MS = [200, 500] as const;

export class OpsAnomalyCollectionError extends Error {
  readonly diagnosticCode: string;
  readonly httpStatus?: number;
  readonly queueReadStage?: QueueReadStage;
  readonly retryCount?: number;
  readonly timedOut?: boolean;

  constructor(diagnosticCode: string, httpStatus?: number, queueRead?: {
    stage: QueueReadStage;
    retryCount: number;
    timedOut: boolean;
  }) {
    super(diagnosticCode);
    this.name = 'OpsAnomalyCollectionError';
    this.diagnosticCode = diagnosticCode;
    this.httpStatus = httpStatus;
    this.queueReadStage = queueRead?.stage;
    this.retryCount = queueRead?.retryCount;
    this.timedOut = queueRead?.timedOut;
  }
}

const OPS_ANOMALY_COLLECTION_DIAGNOSTIC_PATTERN = /^ops_queue_(?:account_id_missing|token_missing|inventory_(?:invalid|incomplete|timeout|http_(?:401|403|404|429|other)|api_error_[1-9]\d{0,9})|metrics_(?:invalid|timeout|http_(?:401|403|404|429|other)|api_error_[1-9]\d{0,9}))$/;

export function boundedOpsAnomalyQueueReadDetails(error: unknown) {
  if (!(error instanceof OpsAnomalyCollectionError)
    || !['inventory', 'metrics'].includes(error.queueReadStage ?? '')
    || !Number.isInteger(error.retryCount)
    || error.retryCount! < 0 || error.retryCount! > OPS_QUEUE_READ_RETRY_BACKOFF_MS.length
    || typeof error.timedOut !== 'boolean') return {};
  return {
    failure_queue_stage: error.queueReadStage,
    failure_retry_count: error.retryCount,
    failure_timed_out: error.timedOut,
  };
}

export function boundedOpsAnomalyCollectionDiagnosticCode(value: unknown) {
  return typeof value === 'string' && OPS_ANOMALY_COLLECTION_DIAGNOSTIC_PATTERN.test(value)
    ? value
    : 'ops_anomaly_monitor_failed';
}

export function boundedOpsAnomalyCollectionHttpStatus(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 100 && Number(value) <= 599
    ? Number(value)
    : undefined;
}

function boundedCount(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(Math.floor(parsed), Number.MAX_SAFE_INTEGER);
}

function aggregateDetails(value: Record<string, unknown> | null | undefined) {
  const result: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value ?? {})) {
    const count = boundedCount(raw);
    if (count > 0 && /^[a-z][a-z0-9_]{0,63}$/.test(key)) result[key] = count;
  }
  return result;
}

export async function loadDatabaseOpsAnomalies(params: {
  supabaseAdmin: SupabaseClient;
  observedAt: Date;
}): Promise<OpsAnomaly[]> {
  const { data, error } = await params.supabaseAdmin.rpc('get_ops_anomaly_snapshot', {
    p_observed_at: params.observedAt.toISOString(),
    p_claim_overdue_minutes: OPS_ANOMALY_THRESHOLDS.paymentClaimOverdueMinutes,
    p_refund_stale_minutes: OPS_ANOMALY_THRESHOLDS.serviceRefundStaleMinutes,
    p_payout_long_hold_days: OPS_ANOMALY_THRESHOLDS.payoutLongHoldDays,
    p_experience_job_missing_minutes: OPS_ANOMALY_THRESHOLDS.experienceJobMissingMinutes,
    p_service_job_missing_minutes: OPS_ANOMALY_THRESHOLDS.serviceJobMissingMinutes,
    p_cancel_pending_job_missing_minutes: OPS_ANOMALY_THRESHOLDS.cancelPendingJobMissingMinutes,
  });

  if (error || !Array.isArray(data)) {
    throw new Error('ops_anomaly_database_snapshot_failed');
  }

  return (data as DatabaseSnapshotRow[]).map((row) => {
    const diagnosticCode = String(row.diagnostic_code || '') as OpsAnomalyDiagnosticCode;
    if (!DATABASE_DIAGNOSTIC_CODES.has(diagnosticCode)) {
      throw new Error('ops_anomaly_database_snapshot_invalid');
    }
    const count = boundedCount(row.anomaly_count);
    if (count === 0) throw new Error('ops_anomaly_database_snapshot_invalid');
    return {
      diagnosticCode,
      severity: OPS_ANOMALY_DEFINITIONS[diagnosticCode].severity,
      count,
      oldestObservedAt: row.oldest_observed_at || null,
      aggregateDetails: aggregateDetails(row.aggregate_details),
    };
  });
}

function requiredAccountId(value: unknown) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!/^[a-f0-9]{32}$/.test(normalized)) {
    throw new OpsAnomalyCollectionError('ops_queue_account_id_missing');
  }
  return normalized;
}

function requiredToken(value: unknown) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new OpsAnomalyCollectionError('ops_queue_token_missing');
  return normalized;
}

function boundedProviderCode(payload: CloudflareEnvelope<unknown>) {
  const rawCode = payload.errors?.[0]?.code;
  const code = typeof rawCode === 'number'
    ? rawCode
    : typeof rawCode === 'string' && /^\d{1,10}$/.test(rawCode)
      ? Number(rawCode)
      : Number.NaN;
  return Number.isSafeInteger(code) && code > 0 && code <= 9_999_999_999
    ? code
    : null;
}

function httpDiagnostic(stage: QueueReadStage, status: number) {
  const suffix = [401, 403, 404, 429].includes(status) ? String(status) : 'other';
  return `ops_queue_${stage}_http_${suffix}`;
}

async function cloudflareGetAttempt<T>(params: {
  stage: QueueReadStage;
  pathname: string;
  token: string;
  fetchImplementation: typeof fetch;
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPS_QUEUE_READ_TIMEOUT_MS);
  let response: Response | undefined;
  try {
    const fetchImplementation = params.fetchImplementation;
    response = await fetchImplementation(
      `https://api.cloudflare.com/client/v4${params.pathname}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${params.token}` },
        signal: controller.signal,
      }
    );
    // Keep the same deadline through body consumption, not just response headers.
    const payload = await response.json().catch(() => null) as CloudflareEnvelope<T> | null;
    controller.signal.throwIfAborted();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)
      || typeof payload.success !== 'boolean'
      || (payload.errors != null && !Array.isArray(payload.errors))) {
      throw new OpsAnomalyCollectionError(`ops_queue_${params.stage}_invalid`, response.status);
    }
    if (!response.ok || payload.success !== true) {
      const providerCode = boundedProviderCode(payload);
      throw new OpsAnomalyCollectionError(
        providerCode == null
          ? httpDiagnostic(params.stage, response.status)
          : `ops_queue_${params.stage}_api_error_${providerCode}`,
        response.status
      );
    }
    return payload.result;
  } catch (error) {
    if (error instanceof OpsAnomalyCollectionError) throw error;
    throw new OpsAnomalyCollectionError(
      `ops_queue_${params.stage}_${controller.signal.aborted ? 'timeout' : 'http_other'}`,
      response?.status
    );
  } finally {
    clearTimeout(timer);
  }
}

function isTransientQueueRead(error: OpsAnomalyCollectionError) {
  // Invalid responses, auth/configuration failures and unrelated transport errors
  // are never retried, even when a malformed provider response claims code 15000.
  if (error.diagnosticCode.endsWith('_invalid')) return false;
  const status = error.httpStatus;
  if (status != null && status >= 400 && status < 500 && status !== 429) return false;
  if (error.diagnosticCode.endsWith('_timeout')) return true;
  if (status === 429 || (status != null && status >= 500 && status <= 599)) return true;
  return status != null && status >= 200 && status < 300
    && error.diagnosticCode.endsWith('_api_error_15000');
}

async function cloudflareGet<T>(params: Parameters<typeof cloudflareGetAttempt<T>>[0]) {
  for (let retryCount = 0; ; retryCount += 1) {
    try {
      return await cloudflareGetAttempt<T>(params);
    } catch (error) {
      if (!(error instanceof OpsAnomalyCollectionError)) throw error;
      const backoff = OPS_QUEUE_READ_RETRY_BACKOFF_MS[retryCount];
      if (backoff == null || !isTransientQueueRead(error)) {
        throw new OpsAnomalyCollectionError(error.diagnosticCode, error.httpStatus, {
          stage: params.stage,
          retryCount,
          timedOut: error.diagnosticCode.endsWith('_timeout'),
        });
      }
      await new Promise<void>((resolve) => setTimeout(resolve, backoff));
    }
  }
}

function queueSeverity(params: {
  mainBacklogCount: number;
  dlqBacklogCount: number;
  oldestMainAgeMinutes: number | null;
}): OpsAnomalySeverity {
  if (
    params.mainBacklogCount >= OPS_ANOMALY_THRESHOLDS.queueMainCriticalCount
    || params.dlqBacklogCount >= OPS_ANOMALY_THRESHOLDS.queueDlqCriticalCount
    || (params.oldestMainAgeMinutes ?? 0) >= OPS_ANOMALY_THRESHOLDS.queueMainCriticalAgeMinutes
  ) return 'critical';
  if (
    params.dlqBacklogCount > 0
    || params.mainBacklogCount >= OPS_ANOMALY_THRESHOLDS.queueMainWarningCount
    || (params.oldestMainAgeMinutes ?? 0) >= OPS_ANOMALY_THRESHOLDS.queueMainWarningAgeMinutes
  ) return 'warning';
  return 'info';
}

export async function loadQueueOpsAnomaly(params: {
  runtime: OpsAnomalyQueueRuntime;
  observedAt: Date;
  fetchImplementation?: typeof fetch;
}): Promise<OpsAnomaly | null> {
  const accountId = requiredAccountId(params.runtime.CLOUDFLARE_ACCOUNT_ID);
  const token = requiredToken(params.runtime.OPS_ANOMALY_MONITOR_CLOUDFLARE_API_TOKEN);
  const fetchImplementation = params.fetchImplementation ?? fetch;
  const inventory = await cloudflareGet<QueueInventoryRow[]>({
    stage: 'inventory',
    pathname: `/accounts/${accountId}/queues?per_page=100`,
    token,
    fetchImplementation,
  });
  if (!Array.isArray(inventory)) {
    throw new OpsAnomalyCollectionError('ops_queue_inventory_invalid');
  }

  const queueIds = new Map(
    inventory.flatMap((row) => {
      const id = typeof row.queue_id === 'string' ? row.queue_id : '';
      const name = typeof row.queue_name === 'string' ? row.queue_name : '';
      return id && name ? [[name, id] as const] : [];
    })
  );
  if (OPS_ANOMALY_QUEUE_CONTRACT.some((queue) => !queueIds.has(queue.name))) {
    throw new OpsAnomalyCollectionError('ops_queue_inventory_incomplete');
  }

  const snapshots = await Promise.all(OPS_ANOMALY_QUEUE_CONTRACT.map(async (queue) => {
    const queueId = queueIds.get(queue.name)!;
    const metrics = await cloudflareGet<QueueMetrics>({
      stage: 'metrics',
      pathname: `/accounts/${accountId}/queues/${encodeURIComponent(queueId)}/metrics`,
      token,
      fetchImplementation,
    });
    if (!metrics || typeof metrics !== 'object') {
      throw new OpsAnomalyCollectionError('ops_queue_metrics_invalid');
    }
    const rawBacklogCount = Number(metrics.backlog_count);
    if (!Number.isFinite(rawBacklogCount) || rawBacklogCount < 0) {
      throw new OpsAnomalyCollectionError('ops_queue_metrics_invalid');
    }
    const backlogCount = boundedCount(rawBacklogCount);
    const oldestTimestamp = Number(metrics?.oldest_message_timestamp_ms);
    const oldestAt = Number.isFinite(oldestTimestamp) && oldestTimestamp > 0
      ? new Date(oldestTimestamp)
      : null;
    return { kind: queue.kind, backlogCount, oldestAt };
  }));

  const mainBacklogCount = snapshots
    .filter((snapshot) => snapshot.kind === 'main')
    .reduce((sum, snapshot) => sum + snapshot.backlogCount, 0);
  const dlqBacklogCount = snapshots
    .filter((snapshot) => snapshot.kind === 'dlq')
    .reduce((sum, snapshot) => sum + snapshot.backlogCount, 0);
  const oldestMainAt = snapshots
    .filter((snapshot) => snapshot.kind === 'main' && snapshot.oldestAt)
    .map((snapshot) => snapshot.oldestAt!)
    .sort((left, right) => left.getTime() - right.getTime())[0] ?? null;
  const totalBacklogCount = mainBacklogCount + dlqBacklogCount;
  if (totalBacklogCount === 0) return null;

  const oldestMainAgeMinutes = oldestMainAt
    ? Math.max(0, Math.floor((params.observedAt.getTime() - oldestMainAt.getTime()) / 60_000))
    : null;
  return {
    diagnosticCode: 'queue_or_dlq_backlog',
    severity: queueSeverity({ mainBacklogCount, dlqBacklogCount, oldestMainAgeMinutes }),
    count: totalBacklogCount,
    oldestObservedAt: oldestMainAt?.toISOString() ?? null,
    aggregateDetails: {
      main_backlog_count: mainBacklogCount,
      dlq_backlog_count: dlqBacklogCount,
      ...(oldestMainAgeMinutes == null ? {} : { oldest_main_age_minutes: oldestMainAgeMinutes }),
    },
  };
}

export async function collectOpsAnomalies(params: {
  supabaseAdmin: SupabaseClient;
  queueRuntime: OpsAnomalyQueueRuntime;
  observedAt: Date;
  fetchImplementation?: typeof fetch;
}) {
  const [databaseAnomalies, queueAnomaly] = await Promise.all([
    loadDatabaseOpsAnomalies(params),
    loadQueueOpsAnomaly({
      runtime: params.queueRuntime,
      observedAt: params.observedAt,
      fetchImplementation: params.fetchImplementation,
    }),
  ]);
  return queueAnomaly ? [...databaseAnomalies, queueAnomaly] : databaseAnomalies;
}
