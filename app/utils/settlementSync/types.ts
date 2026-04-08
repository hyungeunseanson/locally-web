import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  SettlementSyncJobHealth,
  SettlementSyncJobName,
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
  status: 400 | 401 | 403 | 404 | 409 | 500;
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
};

export type SettlementSyncForceOneParams = {
  supabaseAdmin: SettlementSyncAdminClient;
  triggerSource: 'manual_force_one';
  initiatedByAdminId?: string | null;
  identifier: string;
  testDelayMs?: number;
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
