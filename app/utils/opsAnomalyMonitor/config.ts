import type {
  OpsAnomalyDiagnosticCode,
  OpsAnomalySeverity,
} from './types';

export const OPS_ANOMALY_MONITOR_CRON = '*/10 * * * *';
export const OPS_ANOMALY_MONITOR_JOB_NAME = 'ops_anomaly_monitor';
export const OPS_ANOMALY_MONITOR_SCOPE = 'all' as const;

export const OPS_ANOMALY_THRESHOLDS = {
  paymentClaimOverdueMinutes: 45,
  serviceRefundStaleMinutes: 30,
  payoutLongHoldDays: 90,
  experienceJobMissingMinutes: 180,
  serviceJobMissingMinutes: 180,
  cancelPendingJobMissingMinutes: 75,
  queueMainWarningCount: 10,
  queueMainCriticalCount: 100,
  queueMainWarningAgeMinutes: 15,
  queueMainCriticalAgeMinutes: 60,
  queueDlqCriticalCount: 10,
  criticalRealertCooldownMinutes: 24 * 60,
} as const;

export const OPS_ANOMALY_QUEUE_CONTRACT = [
  { name: 'locally-public-experience-media-mirror-production', kind: 'main' },
  { name: 'locally-public-experience-media-mirror-dlq-production', kind: 'dlq' },
  { name: 'locally-experience-translation-production', kind: 'main' },
  { name: 'locally-experience-translation-dlq-production', kind: 'dlq' },
] as const;

export const OPS_ANOMALY_DEFINITIONS: Record<
  OpsAnomalyDiagnosticCode,
  { severity: OpsAnomalySeverity; title: string }
> = {
  payment_reconciliation_required: {
    severity: 'critical',
    title: '결제 reconciliation 확인 필요',
  },
  payment_state_inconsistent: {
    severity: 'critical',
    title: '결제 상태 불일치 감지',
  },
  refund_attention_required: {
    severity: 'critical',
    title: '환불 작업 확인 필요',
  },
  payout_attention_required: {
    severity: 'critical',
    title: '장기 미정산 또는 정산정보 이상',
  },
  job_stale_or_failed: {
    severity: 'critical',
    title: '자동 작업 지연 또는 실패',
  },
  queue_or_dlq_backlog: {
    severity: 'warning',
    title: 'Queue 또는 DLQ backlog 감지',
  },
};
