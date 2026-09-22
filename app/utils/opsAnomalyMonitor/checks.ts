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
    throw new Error('ops_anomaly_cloudflare_account_unavailable');
  }
  return normalized;
}

function requiredToken(value: unknown) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new Error('ops_anomaly_cloudflare_token_unavailable');
  return normalized;
}

async function cloudflareGet<T>(params: {
  pathname: string;
  token: string;
  fetchImplementation: typeof fetch;
}) {
  const response = await params.fetchImplementation(
    `https://api.cloudflare.com/client/v4${params.pathname}`,
    { method: 'GET', headers: { Authorization: `Bearer ${params.token}` } }
  );
  const payload = await response.json().catch(() => ({})) as CloudflareEnvelope<T>;
  if (!response.ok || payload.success !== true) {
    throw new Error('ops_anomaly_cloudflare_read_failed');
  }
  return payload.result;
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
    pathname: `/accounts/${accountId}/queues?per_page=100`,
    token,
    fetchImplementation,
  });
  if (!Array.isArray(inventory)) throw new Error('ops_anomaly_queue_inventory_invalid');

  const queueIds = new Map(
    inventory.flatMap((row) => {
      const id = typeof row.queue_id === 'string' ? row.queue_id : '';
      const name = typeof row.queue_name === 'string' ? row.queue_name : '';
      return id && name ? [[name, id] as const] : [];
    })
  );
  if (OPS_ANOMALY_QUEUE_CONTRACT.some((queue) => !queueIds.has(queue.name))) {
    throw new Error('ops_anomaly_queue_inventory_incomplete');
  }

  const snapshots = await Promise.all(OPS_ANOMALY_QUEUE_CONTRACT.map(async (queue) => {
    const queueId = queueIds.get(queue.name)!;
    const metrics = await cloudflareGet<QueueMetrics>({
      pathname: `/accounts/${accountId}/queues/${encodeURIComponent(queueId)}/metrics`,
      token,
      fetchImplementation,
    });
    const backlogCount = boundedCount(metrics?.backlog_count);
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
