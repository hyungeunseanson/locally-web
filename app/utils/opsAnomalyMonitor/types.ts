export type OpsAnomalySeverity = 'info' | 'warning' | 'critical';

export type OpsAnomalyDiagnosticCode =
  | 'payment_reconciliation_required'
  | 'payment_state_inconsistent'
  | 'refund_attention_required'
  | 'payout_attention_required'
  | 'job_stale_or_failed'
  | 'queue_or_dlq_backlog';

export type OpsAnomaly = {
  diagnosticCode: OpsAnomalyDiagnosticCode;
  severity: OpsAnomalySeverity;
  count: number;
  oldestObservedAt: string | null;
  aggregateDetails: Record<string, number>;
};

export type OpsAnomalyMonitorState = {
  activeDiagnostics: OpsAnomalyDiagnosticCode[];
  alertedAtByCode: Partial<Record<OpsAnomalyDiagnosticCode, string>>;
};

export type OpsAnomalyMonitorResult =
  | {
      success: true;
      runId: number;
      outcome: 'completed' | 'no_anomalies';
      anomalyCount: number;
      diagnosticCount: number;
      alertCount: number;
      emailCount: number;
      emailFailureCount: number;
      suppressedCount: number;
      severityCounts: Record<OpsAnomalySeverity, number>;
    }
  | {
      success: false;
      status: 409 | 500;
      outcome: 'already_running' | 'failed';
      error: string;
      runId?: number;
    };
