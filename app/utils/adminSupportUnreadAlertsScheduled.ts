import { createClient } from '@supabase/supabase-js';

import type { EmailEnv } from '@/app/emails/delivery/sendTemplatedEmail';
import { insertAdminAlerts, sendAdminAlertEmails } from '@/app/utils/adminAlertCenter';
import { processDueAdminSupportUnreadAlerts } from '@/app/utils/adminSupportUnreadAlerts';

export const ADMIN_SUPPORT_UNREAD_ALERTS_CRON = '*/10 * * * *';

export type AdminSupportUnreadAlertsRuntimeEnv = Record<string, unknown> &
  EmailEnv & {
    CLOUDFLARE_DEPLOYMENT_ENV?: string;
    ADMIN_SUPPORT_UNREAD_ALERTS_SCHEDULED_ENABLED?: string;
    NEXT_PUBLIC_SUPABASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
  };

type ScheduledOptions = {
  process?: typeof processDueAdminSupportUnreadAlerts;
  now?: () => number;
  createInvocationId?: () => string;
  log?: (entry: Record<string, unknown>) => void;
};

export class AdminSupportUnreadAlertsScheduledError extends Error {
  readonly diagnosticStage: 'runtime' | 'processor';
  readonly diagnosticCode: string;

  constructor(
    diagnosticStage: 'runtime' | 'processor',
    diagnosticCode: string
  ) {
    super(diagnosticCode);
    this.diagnosticStage = diagnosticStage;
    this.diagnosticCode = diagnosticCode;
  }
}

function requiredString(value: unknown, name: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AdminSupportUnreadAlertsScheduledError(
      'runtime',
      `missing_${name.toLowerCase()}`
    );
  }
  return value.trim();
}

function createRuntimeClient(environment: AdminSupportUnreadAlertsRuntimeEnv) {
  let supabaseUrl: URL;
  try {
    supabaseUrl = new URL(
      requiredString(environment.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL')
    );
  } catch (error) {
    if (error instanceof AdminSupportUnreadAlertsScheduledError) throw error;
    throw new AdminSupportUnreadAlertsScheduledError('runtime', 'invalid_supabase_url');
  }
  const localFixture =
    supabaseUrl.protocol === 'http:' &&
    ['127.0.0.1', 'localhost'].includes(supabaseUrl.hostname);
  const hostedProject =
    supabaseUrl.protocol === 'https:' &&
    /^[a-z0-9]{20}\.supabase\.co$/.test(supabaseUrl.hostname) &&
    supabaseUrl.pathname === '/';
  if (!localFixture && !hostedProject) {
    throw new AdminSupportUnreadAlertsScheduledError(
      'runtime',
      'invalid_supabase_url'
    );
  }
  return createClient(
    supabaseUrl.toString(),
    requiredString(environment.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function safeLog(
  log: ScheduledOptions['log'],
  entry: Record<string, unknown>
) {
  try {
    (log ?? ((record) => console.log(JSON.stringify(record))))(entry);
  } catch {
    // Observability must not change processor semantics.
  }
}

export async function handleAdminSupportUnreadAlertsScheduled(
  controller: { cron: string },
  environment: AdminSupportUnreadAlertsRuntimeEnv,
  options: ScheduledOptions = {}
) {
  if (controller.cron !== ADMIN_SUPPORT_UNREAD_ALERTS_CRON) {
    return { status: 'not_admin_support_unread_schedule' } as const;
  }
  if (
    environment.CLOUDFLARE_DEPLOYMENT_ENV !== 'production' ||
    environment.ADMIN_SUPPORT_UNREAD_ALERTS_SCHEDULED_ENABLED !== 'true'
  ) {
    return { status: 'disabled' } as const;
  }

  const startedAt = options.now?.() ?? Date.now();
  const invocationId = options.createInvocationId?.() ?? crypto.randomUUID();
  try {
    const supabaseAdmin = createRuntimeClient(environment);
    const result = await (options.process ?? processDueAdminSupportUnreadAlerts)({
      supabaseAdmin,
      insertAdminAlerts: (params) => insertAdminAlerts(params, { supabaseAdmin }),
      sendAdminAlertEmails: (params) => sendAdminAlertEmails(params, {
        supabaseAdmin,
        env: environment,
      }),
      log: options.log,
    });
    safeLog(options.log, {
      event: 'admin_support_unread_scheduled',
      status: 'completed',
      invocationId,
      claimedCount: result.claimedCount,
      alertedCount: result.alertedCount,
      emailedCount: result.emailedCount,
      skippedCount: result.skippedCount,
      failureCount: result.failureCount ?? 0,
      storage: 'storage' in result ? result.storage : 'batch-table',
      durationMs: Math.max(0, (options.now?.() ?? Date.now()) - startedAt),
      diagnosticCode: 'processor_completed',
    });
    return { status: 'completed', invocationId, ...result } as const;
  } catch (error) {
    const diagnosticStage = error instanceof AdminSupportUnreadAlertsScheduledError
      ? error.diagnosticStage
      : 'processor';
    const diagnosticCode = error instanceof AdminSupportUnreadAlertsScheduledError
      ? error.diagnosticCode
      : 'processor_failed';
    safeLog(options.log, {
      event: 'admin_support_unread_scheduled',
      status: 'failed',
      invocationId,
      diagnosticStage,
      diagnosticCode,
      durationMs: Math.max(0, (options.now?.() ?? Date.now()) - startedAt),
    });
    throw error;
  }
}
