import { createClient } from '@supabase/supabase-js';

import type { EmailEnv } from '@/app/emails/delivery/sendTemplatedEmail';
import {
  boundedOpsAnomalyCollectionDiagnosticCode,
  boundedOpsAnomalyCollectionHttpStatus,
} from '@/app/utils/opsAnomalyMonitor/checks';
import { OPS_ANOMALY_MONITOR_CRON } from '@/app/utils/opsAnomalyMonitor/config';
import { runOpsAnomalyMonitor } from '@/app/utils/opsAnomalyMonitor/runOpsAnomalyMonitor';

export { OPS_ANOMALY_MONITOR_CRON } from '@/app/utils/opsAnomalyMonitor/config';

export type OpsAnomalyMonitorScheduledRuntimeEnv = Record<string, unknown> & EmailEnv & {
  CLOUDFLARE_DEPLOYMENT_ENV?: string;
  OPS_ANOMALY_MONITOR_SCHEDULED_ENABLED?: string;
  OPS_ANOMALY_MONITOR_CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type ScheduledOptions = {
  runMonitor?: typeof runOpsAnomalyMonitor;
  createClient?: (
    environment: OpsAnomalyMonitorScheduledRuntimeEnv,
    fetchImplementation?: typeof fetch
  ) => ReturnType<typeof createClient>;
  fetch?: typeof fetch;
  now?: () => number;
  log?: (entry: Record<string, unknown>) => void;
};

export class OpsAnomalyMonitorScheduledError extends Error {
  readonly diagnosticStage: 'runtime' | 'processor';
  readonly diagnosticCode: string;
  readonly httpStatus?: number;

  constructor(
    diagnosticStage: 'runtime' | 'processor',
    diagnosticCode: string,
    httpStatus?: number
  ) {
    super(diagnosticCode);
    this.diagnosticStage = diagnosticStage;
    this.diagnosticCode = diagnosticCode;
    this.httpStatus = httpStatus;
  }
}

function requiredString(value: unknown, name: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new OpsAnomalyMonitorScheduledError('runtime', `missing_${name.toLowerCase()}`);
  }
  return value.trim();
}

export function createOpsAnomalyMonitorScheduledClient(
  environment: OpsAnomalyMonitorScheduledRuntimeEnv,
  fetchImplementation: typeof fetch = fetch
) {
  let supabaseUrl: URL;
  try {
    supabaseUrl = new URL(requiredString(environment.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'));
  } catch (error) {
    if (error instanceof OpsAnomalyMonitorScheduledError) throw error;
    throw new OpsAnomalyMonitorScheduledError('runtime', 'invalid_supabase_url');
  }
  const localFixture = supabaseUrl.protocol === 'http:'
    && ['127.0.0.1', 'localhost'].includes(supabaseUrl.hostname);
  const hostedProject = supabaseUrl.protocol === 'https:'
    && /^[a-z0-9]{20}\.supabase\.co$/.test(supabaseUrl.hostname)
    && supabaseUrl.pathname === '/';
  if (!localFixture && !hostedProject) {
    throw new OpsAnomalyMonitorScheduledError('runtime', 'invalid_supabase_url');
  }
  return createClient(
    supabaseUrl.toString(),
    requiredString(environment.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: fetchImplementation },
    }
  );
}

function safeLog(log: ScheduledOptions['log'], entry: Record<string, unknown>) {
  try {
    (log ?? ((record) => console.log(JSON.stringify(record))))(entry);
  } catch {
    // Monitoring logs cannot change processor semantics.
  }
}

export async function handleOpsAnomalyMonitorScheduled(
  controller: { cron: string },
  environment: OpsAnomalyMonitorScheduledRuntimeEnv,
  options: ScheduledOptions = {}
) {
  if (controller.cron !== OPS_ANOMALY_MONITOR_CRON) {
    return { status: 'not_ops_anomaly_monitor_schedule' } as const;
  }
  if (
    environment.CLOUDFLARE_DEPLOYMENT_ENV !== 'production'
    || environment.OPS_ANOMALY_MONITOR_SCHEDULED_ENABLED !== 'true'
  ) {
    return { status: 'disabled' } as const;
  }

  const startedAt = options.now?.() ?? Date.now();
  try {
    const supabaseAdmin = (options.createClient ?? createOpsAnomalyMonitorScheduledClient)(
      environment,
      options.fetch
    );
    const result = await (options.runMonitor ?? runOpsAnomalyMonitor)({
      supabaseAdmin,
      queueRuntime: environment,
      emailEnv: environment,
      triggerSource: 'cron',
      dependencies: { fetch: options.fetch },
    });
    if (!result.success && result.outcome !== 'already_running') {
      throw new OpsAnomalyMonitorScheduledError(
        'processor',
        boundedOpsAnomalyCollectionDiagnosticCode(result.diagnosticCode),
        boundedOpsAnomalyCollectionHttpStatus(result.httpStatus)
      );
    }
    const aggregate = result.success ? {
      anomalyCount: result.anomalyCount,
      diagnosticCount: result.diagnosticCount,
      alertCount: result.alertCount,
      emailCount: result.emailCount,
      emailFailureCount: result.emailFailureCount,
      suppressedCount: result.suppressedCount,
      severityCounts: result.severityCounts,
    } : {
      anomalyCount: 0,
      diagnosticCount: 0,
      alertCount: 0,
      emailCount: 0,
      emailFailureCount: 0,
      suppressedCount: 0,
      severityCounts: { info: 0, warning: 0, critical: 0 },
    };
    const outcome = result.success ? result.outcome : 'already_running';
    safeLog(options.log, {
      event: 'ops_anomaly_monitor_scheduled',
      status: 'completed',
      outcome,
      ...aggregate,
      durationMs: Math.max(0, (options.now?.() ?? Date.now()) - startedAt),
      diagnosticCode: 'processor_completed',
    });
    return { status: 'completed', outcome, ...aggregate } as const;
  } catch (error) {
    const diagnosticStage = error instanceof OpsAnomalyMonitorScheduledError
      ? error.diagnosticStage
      : 'processor';
    const diagnosticCode = error instanceof OpsAnomalyMonitorScheduledError
      ? error.diagnosticCode
      : 'ops_anomaly_monitor_failed';
    const httpStatus = error instanceof OpsAnomalyMonitorScheduledError
      ? error.httpStatus
      : undefined;
    safeLog(options.log, {
      event: 'ops_anomaly_monitor_scheduled',
      status: 'failed',
      diagnosticStage,
      diagnosticCode,
      ...(httpStatus == null ? {} : { httpStatus }),
      durationMs: Math.max(0, (options.now?.() ?? Date.now()) - startedAt),
    });
    throw new OpsAnomalyMonitorScheduledError(diagnosticStage, diagnosticCode, httpStatus);
  }
}
