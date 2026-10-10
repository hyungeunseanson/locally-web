import type { SupabaseClient } from '@supabase/supabase-js';

import type { EmailEnv } from '@/app/emails/delivery/sendTemplatedEmail';
import { insertAdminAlerts, sendAdminAlertEmails } from '@/app/utils/adminAlertCenter';
import {
  finishSettlementSyncRunFailure,
  finishSettlementSyncRunSuccess,
  renewSettlementSyncRunLease,
  startSettlementSyncRun,
} from '@/app/utils/settlementSync/jobRuns';

import {
  boundedOpsAnomalyCollectionDiagnosticCode,
  boundedOpsAnomalyCollectionHttpStatus,
  boundedOpsAnomalyQueueReadDetails,
  collectOpsAnomalies,
  OpsAnomalyCollectionError,
  type OpsAnomalyQueueRuntime,
} from './checks';
import {
  OPS_ANOMALY_DEFINITIONS,
  OPS_ANOMALY_MONITOR_JOB_NAME,
  OPS_ANOMALY_MONITOR_SCOPE,
  OPS_ANOMALY_THRESHOLDS,
} from './config';
import type {
  OpsAnomaly,
  OpsAnomalyDiagnosticCode,
  OpsAnomalyMonitorResult,
  OpsAnomalyMonitorState,
  OpsAnomalySeverity,
} from './types';

type AlertResult = { count: number; targetCount: number };
type AlertWriter = (params: {
  title: string;
  message: string;
  link: string;
}) => Promise<AlertResult>;
type EmailWriter = (params: {
  subject: string;
  title: string;
  message: string;
  link: string;
  ctaLabel: string;
}) => Promise<AlertResult>;

type PreviousRunRow = {
  details?: unknown;
};

type MonitorDependencies = {
  collectAnomalies?: typeof collectOpsAnomalies;
  insertAlert?: AlertWriter;
  sendEmail?: EmailWriter;
  now?: () => Date;
  fetch?: typeof fetch;
};

const DIAGNOSTIC_CODES = new Set<OpsAnomalyDiagnosticCode>(
  Object.keys(OPS_ANOMALY_DEFINITIONS) as OpsAnomalyDiagnosticCode[]
);

function emptyState(): OpsAnomalyMonitorState {
  return { activeDiagnostics: [], alertedAtByCode: {} };
}

function readMonitorState(details: unknown): OpsAnomalyMonitorState {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return emptyState();
  const record = details as Record<string, unknown>;
  const activeDiagnostics = Array.isArray(record.active_diagnostics)
    ? record.active_diagnostics.filter((value): value is OpsAnomalyDiagnosticCode =>
      typeof value === 'string' && DIAGNOSTIC_CODES.has(value as OpsAnomalyDiagnosticCode))
    : [];
  const rawAlerted = record.alerted_at_by_code;
  const alertedAtByCode: OpsAnomalyMonitorState['alertedAtByCode'] = {};
  if (rawAlerted && typeof rawAlerted === 'object' && !Array.isArray(rawAlerted)) {
    for (const [code, value] of Object.entries(rawAlerted)) {
      if (!DIAGNOSTIC_CODES.has(code as OpsAnomalyDiagnosticCode) || typeof value !== 'string') continue;
      const timestamp = new Date(value);
      if (!Number.isNaN(timestamp.getTime())) {
        alertedAtByCode[code as OpsAnomalyDiagnosticCode] = timestamp.toISOString();
      }
    }
  }
  const versions = record.financial_event_version_by_code;
  const financialEventVersionByCode: NonNullable<OpsAnomalyMonitorState['financialEventVersionByCode']> = {};
  if (versions && typeof versions === 'object' && !Array.isArray(versions)) {
    for (const code of ['targeted_card_recovery_a','targeted_card_recovery_b'] as const) {
      const version = (versions as Record<string, unknown>)[code];
      if (typeof version === 'number' && Number.isSafeInteger(version) && version > 0) financialEventVersionByCode[code] = version;
    }
  }
  const notificationEventVersionByCode: NonNullable<OpsAnomalyMonitorState['notificationEventVersionByCode']> = {};
  const notificationVersions = record.notification_event_version_by_code;
  if (notificationVersions && typeof notificationVersions === 'object' && !Array.isArray(notificationVersions)) {
    for (const code of ['targeted_card_notification_a','targeted_card_notification_b'] as const) {
      const version = (notificationVersions as Record<string, unknown>)[code];
      if (typeof version === 'number' && Number.isSafeInteger(version) && version > 0) notificationEventVersionByCode[code] = version;
    }
  }
  return { activeDiagnostics: [...new Set(activeDiagnostics)], alertedAtByCode, financialEventVersionByCode, notificationEventVersionByCode };
}

async function loadPreviousState(supabaseAdmin: SupabaseClient) {
  const { data, error } = await supabaseAdmin
    .from('admin_job_runs')
    .select('details')
    .eq('job_name', OPS_ANOMALY_MONITOR_JOB_NAME)
    .eq('status', 'success')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle<PreviousRunRow>();
  if (error) throw new Error('ops_anomaly_previous_state_failed');
  return readMonitorState(data?.details);
}

export function planOpsAnomalyNotifications(params: {
  anomalies: OpsAnomaly[];
  previousState: OpsAnomalyMonitorState;
  observedAt: Date;
}) {
  const previousActive = new Set(params.previousState.activeDiagnostics);
  const cooldownMs = OPS_ANOMALY_THRESHOLDS.criticalRealertCooldownMinutes * 60_000;
  const alertDiagnostics: OpsAnomalyDiagnosticCode[] = [];
  const emailDiagnostics: OpsAnomalyDiagnosticCode[] = [];
  const nextAlertedAtByCode: OpsAnomalyMonitorState['alertedAtByCode'] = {};

  const nextFinancialVersions: NonNullable<OpsAnomalyMonitorState['financialEventVersionByCode']> = {};
  const nextNotificationVersions: NonNullable<OpsAnomalyMonitorState['notificationEventVersionByCode']> = {};
  for (const anomaly of params.anomalies) {
    const priorAlertedAt = params.previousState.alertedAtByCode[anomaly.diagnosticCode];
    const elapsed = priorAlertedAt
      ? params.observedAt.getTime() - new Date(priorAlertedAt).getTime()
      : Number.POSITIVE_INFINITY;
    const firstObservation = !previousActive.has(anomaly.diagnosticCode);
    const criticalCooldownElapsed = anomaly.severity === 'critical' && elapsed >= cooldownMs;
    const targeted = anomaly.diagnosticCode === 'targeted_card_recovery_a' || anomaly.diagnosticCode === 'targeted_card_recovery_b';
    const version = anomaly.aggregateDetails.incident_version;
    const newFinancialEvent = targeted && version > 0
      && params.previousState.financialEventVersionByCode?.[anomaly.diagnosticCode] !== version;
    if (targeted && Number.isSafeInteger(version) && version > 0) nextFinancialVersions[anomaly.diagnosticCode] = version;
    const inbox = anomaly.diagnosticCode === 'targeted_card_notification_a' || anomaly.diagnosticCode === 'targeted_card_notification_b';
    const noticeVersion = anomaly.aggregateDetails.notice_version;
    // Attacker-generated new envelopes cannot cause alert/email storms. New
    // notices are retained in the snapshot; outstanding review reminds hourly.
    const noticeCooldownElapsed = inbox && elapsed >= OPS_ANOMALY_THRESHOLDS.notificationRealertCooldownMinutes * 60_000;
    if (inbox && Number.isSafeInteger(noticeVersion) && noticeVersion > 0) nextNotificationVersions[anomaly.diagnosticCode] = noticeVersion;
    const newCapacityEvent = inbox && anomaly.aggregateDetails.capacity_exhausted === 1
      && params.previousState.notificationEventVersionByCode?.[anomaly.diagnosticCode] !== noticeVersion;
    const shouldAlert = anomaly.severity !== 'info' && (firstObservation || criticalCooldownElapsed || newFinancialEvent || noticeCooldownElapsed || newCapacityEvent);

    if (shouldAlert) {
      alertDiagnostics.push(anomaly.diagnosticCode);
      if (anomaly.severity === 'critical') emailDiagnostics.push(anomaly.diagnosticCode);
      nextAlertedAtByCode[anomaly.diagnosticCode] = params.observedAt.toISOString();
    } else if (priorAlertedAt) {
      nextAlertedAtByCode[anomaly.diagnosticCode] = priorAlertedAt;
    }
  }

  return {
    alertDiagnostics,
    emailDiagnostics,
    suppressedCount: params.anomalies.filter((anomaly) =>
      anomaly.severity !== 'info' && !alertDiagnostics.includes(anomaly.diagnosticCode)).length,
    nextState: {
      activeDiagnostics: params.anomalies.map((anomaly) => anomaly.diagnosticCode),
      alertedAtByCode: nextAlertedAtByCode,
      ...(Object.keys(nextNotificationVersions).length ? { notificationEventVersionByCode: nextNotificationVersions } : {}),
      ...(Object.keys(nextFinancialVersions).length ? { financialEventVersionByCode: nextFinancialVersions } : {}),
    } satisfies OpsAnomalyMonitorState,
  };
}

function oldestAgeMinutes(observedAt: Date, oldestAt: string | null) {
  if (!oldestAt) return null;
  const parsed = new Date(oldestAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.max(0, Math.floor((observedAt.getTime() - parsed.getTime()) / 60_000));
}

function buildNotificationCopy(anomaly: OpsAnomaly, observedAt: Date) {
  const definition = OPS_ANOMALY_DEFINITIONS[anomaly.diagnosticCode];
  const ageMinutes = oldestAgeMinutes(observedAt, anomaly.oldestObservedAt);
  const ageText = ageMinutes == null ? '최초 시각 확인 필요' : `가장 오래된 신호 ${ageMinutes}분`;
  const targeted = anomaly.diagnosticCode === 'targeted_card_recovery_a' || anomaly.diagnosticCode === 'targeted_card_recovery_b';
  const financeDetails = targeted ? ' 상태: ' + ['review_required','verified','dispatching','unknown','accepted','unassigned']
    .map(key => `${key}=${anomaly.aggregateDetails[key] || 0}`).join(', ') + '. 담당자 확인은 해결 처리가 아닙니다. 보안 운영 콘솔의 get_targeted_card_recovery_review로 대조하세요.' : '';
  const inbox = anomaly.diagnosticCode === 'targeted_card_notification_a' || anomaly.diagnosticCode === 'targeted_card_notification_b';
  const inboxDetails = inbox ? ` 미검증 통보이며 금융 사고 확정이나 환불 권한이 아닙니다. 미검토=${anomaly.aggregateDetails.unreviewed || 0}, 저장=${anomaly.aggregateDetails.stored || 0}/512, 한도초과=${anomaly.aggregateDetails.capacity_exhausted || 0}. 보안 운영 콘솔에서 통보 원문을 대조하고 정확한 검토 버전을 기록하세요. 알림 읽기는 검토 완료가 아닙니다.` : '';
  return {
    title: `[${anomaly.severity.toUpperCase()}] ${definition.title}`,
    message: `${definition.title}: ${anomaly.count}건 · ${ageText}. 운영 대시보드에서 확인해 주세요.${financeDetails}${inboxDetails}`,
    link: '/admin/dashboard?tab=ALERTS',
  };
}

function severityCounts(anomalies: OpsAnomaly[]): Record<OpsAnomalySeverity, number> {
  return anomalies.reduce<Record<OpsAnomalySeverity, number>>((counts, anomaly) => {
    counts[anomaly.severity] += 1;
    return counts;
  }, { info: 0, warning: 0, critical: 0 });
}

export async function runOpsAnomalyMonitor(params: {
  supabaseAdmin: SupabaseClient;
  queueRuntime: OpsAnomalyQueueRuntime;
  emailEnv: EmailEnv;
  triggerSource: 'cron';
  testLeaseMs?: number;
  simulateMissingAdminJobRuns?: boolean;
  dependencies?: MonitorDependencies;
}): Promise<OpsAnomalyMonitorResult> {
  const started = await startSettlementSyncRun({
    supabaseAdmin: params.supabaseAdmin,
    jobName: OPS_ANOMALY_MONITOR_JOB_NAME,
    scope: OPS_ANOMALY_MONITOR_SCOPE,
    triggerSource: params.triggerSource,
    testLeaseMs: params.testLeaseMs,
    simulateMissingAdminJobRuns: params.simulateMissingAdminJobRuns,
  });
  if (!started.ok) {
    return {
      success: false,
      status: 409,
      outcome: 'already_running',
      error: 'Ops anomaly monitor is already running.',
    };
  }

  const renewLease = () => renewSettlementSyncRunLease({
    supabaseAdmin: params.supabaseAdmin,
    runId: started.runId,
    jobName: OPS_ANOMALY_MONITOR_JOB_NAME,
    leaseToken: started.leaseToken,
    testLeaseMs: params.testLeaseMs,
    simulateMissingAdminJobRuns: params.simulateMissingAdminJobRuns,
  });
  let anomalyCount = 0;
  let diagnosticCount = 0;

  try {
    await renewLease();
    const observedAt = params.dependencies?.now?.() ?? new Date();
    const previousState = await loadPreviousState(params.supabaseAdmin);
    const anomalies = await (params.dependencies?.collectAnomalies ?? collectOpsAnomalies)({
      supabaseAdmin: params.supabaseAdmin,
      queueRuntime: params.queueRuntime,
      observedAt,
      fetchImplementation: params.dependencies?.fetch,
    });
    anomalyCount = anomalies.reduce((sum, anomaly) => sum + anomaly.count, 0);
    diagnosticCount = anomalies.length;
    const plan = planOpsAnomalyNotifications({ anomalies, previousState, observedAt });
    const anomalyByCode = new Map(anomalies.map((anomaly) => [anomaly.diagnosticCode, anomaly]));
    const insertAlert = params.dependencies?.insertAlert
      ?? ((alert) => insertAdminAlerts(alert, { supabaseAdmin: params.supabaseAdmin }));
    const sendEmail = params.dependencies?.sendEmail
      ?? ((email) => sendAdminAlertEmails(email, {
        supabaseAdmin: params.supabaseAdmin,
        env: params.emailEnv,
      }));
    let alertCount = 0;
    let emailCount = 0;
    let emailFailureCount = 0;

    for (const diagnosticCode of plan.alertDiagnostics) {
      const anomaly = anomalyByCode.get(diagnosticCode)!;
      const copy = buildNotificationCopy(anomaly, observedAt);
      const result = await insertAlert(copy);
      alertCount += Number(result.count || 0);
    }

    for (const diagnosticCode of plan.emailDiagnostics) {
      const anomaly = anomalyByCode.get(diagnosticCode)!;
      const copy = buildNotificationCopy(anomaly, observedAt);
      try {
        const result = await sendEmail({
          subject: copy.title,
          ...copy,
          ctaLabel: '운영 대시보드 보기',
        });
        emailCount += Number(result.count || 0);
        emailFailureCount += Math.max(0, Number(result.targetCount || 0) - Number(result.count || 0));
      } catch {
        emailFailureCount += 1;
      }
    }

    await renewLease();
    const counts = severityCounts(anomalies);
    await finishSettlementSyncRunSuccess({
      supabaseAdmin: params.supabaseAdmin,
      runId: started.runId,
      jobName: OPS_ANOMALY_MONITOR_JOB_NAME,
      startedAt: started.startedAt,
      leaseToken: started.leaseToken,
      processedCount: anomalyCount,
      skippedCount: plan.suppressedCount,
      details: {
        active_diagnostics: plan.nextState.activeDiagnostics,
        alerted_at_by_code: plan.nextState.alertedAtByCode,
        financial_event_version_by_code: plan.nextState.financialEventVersionByCode ?? {},
        notification_event_version_by_code: plan.nextState.notificationEventVersionByCode ?? {},
        diagnostic_count: diagnosticCount,
        severity_counts: counts,
        alert_count: alertCount,
        email_count: emailCount,
        email_failure_count: emailFailureCount,
      },
      testLeaseMs: params.testLeaseMs,
      simulateMissingAdminJobRuns: params.simulateMissingAdminJobRuns,
    });
    return {
      success: true,
      runId: started.runId,
      outcome: anomalyCount === 0 ? 'no_anomalies' : 'completed',
      anomalyCount,
      diagnosticCount,
      alertCount,
      emailCount,
      emailFailureCount,
      suppressedCount: plan.suppressedCount,
      severityCounts: counts,
    };
  } catch (error) {
    const diagnosticCode = error instanceof OpsAnomalyCollectionError
      ? boundedOpsAnomalyCollectionDiagnosticCode(error.diagnosticCode)
      : 'ops_anomaly_monitor_failed';
    const httpStatus = error instanceof OpsAnomalyCollectionError
      ? boundedOpsAnomalyCollectionHttpStatus(error.httpStatus)
      : undefined;
    await finishSettlementSyncRunFailure({
      supabaseAdmin: params.supabaseAdmin,
      runId: started.runId,
      jobName: OPS_ANOMALY_MONITOR_JOB_NAME,
      startedAt: started.startedAt,
      leaseToken: started.leaseToken,
      processedCount: anomalyCount,
      skippedCount: 0,
      errorMessage: 'Ops anomaly monitor failed.',
      details: {
        diagnostic_count: diagnosticCount,
        failure_diagnostic_code: diagnosticCode,
        ...(httpStatus == null ? {} : { failure_http_status: httpStatus }),
        ...boundedOpsAnomalyQueueReadDetails(error),
      },
      testLeaseMs: params.testLeaseMs,
      simulateMissingAdminJobRuns: params.simulateMissingAdminJobRuns,
    });
    return {
      success: false,
      status: 500,
      outcome: 'failed',
      error: 'Ops anomaly monitor failed.',
      runId: started.runId,
      diagnosticCode,
      ...(httpStatus == null ? {} : { httpStatus }),
    };
  }
}
