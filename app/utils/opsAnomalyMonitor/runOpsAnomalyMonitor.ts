import type { SupabaseClient } from '@supabase/supabase-js';

import type { EmailEnv } from '@/app/emails/delivery/sendTemplatedEmail';
import { insertAdminAlerts, sendAdminAlertEmails } from '@/app/utils/adminAlertCenter';
import {
  finishSettlementSyncRunFailure,
  finishSettlementSyncRunSuccess,
  renewSettlementSyncRunLease,
  startSettlementSyncRun,
} from '@/app/utils/settlementSync/jobRuns';

import { collectOpsAnomalies, type OpsAnomalyQueueRuntime } from './checks';
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
  return { activeDiagnostics: [...new Set(activeDiagnostics)], alertedAtByCode };
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

  for (const anomaly of params.anomalies) {
    const priorAlertedAt = params.previousState.alertedAtByCode[anomaly.diagnosticCode];
    const elapsed = priorAlertedAt
      ? params.observedAt.getTime() - new Date(priorAlertedAt).getTime()
      : Number.POSITIVE_INFINITY;
    const firstObservation = !previousActive.has(anomaly.diagnosticCode);
    const criticalCooldownElapsed = anomaly.severity === 'critical' && elapsed >= cooldownMs;
    const shouldAlert = anomaly.severity !== 'info' && (firstObservation || criticalCooldownElapsed);

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
  return {
    title: `[${anomaly.severity.toUpperCase()}] ${definition.title}`,
    message: `${definition.title}: ${anomaly.count}건 · ${ageText}. 운영 대시보드에서 확인해 주세요.`,
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
  } catch {
    await finishSettlementSyncRunFailure({
      supabaseAdmin: params.supabaseAdmin,
      runId: started.runId,
      jobName: OPS_ANOMALY_MONITOR_JOB_NAME,
      startedAt: started.startedAt,
      leaseToken: started.leaseToken,
      processedCount: anomalyCount,
      skippedCount: 0,
      errorMessage: 'Ops anomaly monitor failed.',
      details: { diagnostic_count: diagnosticCount },
      testLeaseMs: params.testLeaseMs,
      simulateMissingAdminJobRuns: params.simulateMissingAdminJobRuns,
    });
    return {
      success: false,
      status: 500,
      outcome: 'failed',
      error: 'Ops anomaly monitor failed.',
      runId: started.runId,
    };
  }
}
