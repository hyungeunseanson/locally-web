import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  SettlementSyncJobHealth,
  SettlementSyncScope,
  SettlementSyncTriggerDomain,
  SettlementSyncTriggerOutcome,
  SettlementSyncTriggerSource,
} from '@/app/types/admin';

export type SettlementSyncAdminClient = SupabaseClient;

export type SettlementSyncTarget = {
  booking_id: string;
  order_id: string | null;
  request_id?: string | null;
};

export type SettlementSyncRunSuccess = {
  success: true;
  runId: number;
  outcome: SettlementSyncTriggerOutcome;
  processedCount: number;
  skippedCount: number;
  target?: SettlementSyncTarget;
  details?: Record<string, unknown>;
};

export type SettlementSyncRunFailure = {
  success: false;
  status: 400 | 401 | 403 | 404 | 409 | 500 | 503;
  error: string;
  runId?: number;
  outcome?: Exclude<SettlementSyncTriggerOutcome, 'completed' | 'no_candidates'>;
  processedCount?: number;
  skippedCount?: number;
  target?: SettlementSyncTarget;
};

export type SettlementSyncRunResult =
  | SettlementSyncRunSuccess
  | SettlementSyncRunFailure;

export type SettlementSyncRunDueParams = {
  supabaseAdmin: SettlementSyncAdminClient;
  triggerSource: Extract<SettlementSyncTriggerSource, 'cron' | 'manual_run_due'>;
  initiatedByAdminId?: string | null;
  testDelayMs?: number;
  testLeaseMs?: number;
  simulateMissingAdminJobRuns?: boolean;
  simulateMissingExperienceDueRpc?: boolean;
  simulateMissingServiceCompletionRpc?: boolean;
  failPhase?: 'after_lock';
};

export type SettlementSyncForceOneParams = {
  supabaseAdmin: SettlementSyncAdminClient;
  triggerSource: 'manual_force_one';
  initiatedByAdminId?: string | null;
  identifier: string;
  testDelayMs?: number;
  testLeaseMs?: number;
  simulateMissingAdminJobRuns?: boolean;
  simulateMissingExperienceDueRpc?: boolean;
  simulateMissingServiceCompletionRpc?: boolean;
  failPhase?: 'after_lock';
};

export type SettlementSyncJobRunRecord = {
  runId: number;
  jobName: string;
  scope: SettlementSyncScope;
  triggerSource: SettlementSyncTriggerSource;
  status: 'running' | 'success' | 'failed' | 'abandoned';
  startedAt: string;
  finishedAt: string | null;
  processedCount: number;
  skippedCount: number;
  errorMessage: string | null;
  leaseToken: string | null;
  leaseExpiresAt: string | null;
  lastHeartbeatAt: string | null;
};

export type SettlementSyncDueBacklog = {
  count: number;
  oldestDueAt: string | null;
  lagMinutes: number | null;
};

export type SettlementSyncHealthSnapshot = {
  generatedAt: string;
  jobs: SettlementSyncJobHealth[];
};

export type SettlementSyncIdentifierResolution = {
  domain: Extract<SettlementSyncTriggerDomain, 'experience' | 'service'>;
  bookingId: string;
  orderId: string | null;
  requestId?: string | null;
};

const DEFAULT_SETTLEMENT_SYNC_INFRA_ERROR =
  '정산 동기화 인프라를 사용할 수 없습니다. 마이그레이션 또는 RPC 상태를 확인하세요.';

export class SettlementSyncInfrastructureError extends Error {
  readonly status = 503;

  constructor(message = DEFAULT_SETTLEMENT_SYNC_INFRA_ERROR) {
    super(message);
    this.name = 'SettlementSyncInfrastructureError';
  }
}

export class SettlementSyncLeaseLostError extends SettlementSyncInfrastructureError {
  constructor(message = '정산 동기화 lease를 상실해 실행을 계속할 수 없습니다. 잠시 후 다시 시도해 주세요.') {
    super(message);
    this.name = 'SettlementSyncLeaseLostError';
  }
}

export function isSettlementSyncInfrastructureError(
  error: unknown
): error is SettlementSyncInfrastructureError {
  return error instanceof SettlementSyncInfrastructureError;
}
