import { createClient } from '@supabase/supabase-js';

import type { EmailEnv } from '@/app/emails/delivery/sendTemplatedEmail';
import { processSoloGuaranteeRefundsForCompletedBookings } from '@/app/utils/bookings/soloGuaranteeRefund';
import { sendImmediateGenericEmail } from '@/app/utils/emailNotificationJobs';
import { cancelCardPayment } from '@/app/utils/payments/card/server';
import { deliverGuestReviewRequestEmailsForCompletedBookings } from '@/app/utils/reviews/guestReviewRequestEmail';
import { deliverHostGuestReviewRequestsForCompletedBookings } from '@/app/utils/reviews/hostGuestReviewRequestNotification';
import { reconcileDueReviewRequestReminders } from '@/app/utils/reviews/reviewReminderReconciliation';
import {
  runExperienceCompletionSync,
  type ExperienceCompletionSyncDependencies,
} from '@/app/utils/settlementSync/experienceCompletion';
import type { SettlementSyncAdminClient } from '@/app/utils/settlementSync/types';

export const EXPERIENCE_COMPLETION_SYNC_CRON = '23 */2 * * *';

export type ExperienceCompletionScheduledRuntimeEnv = Record<string, unknown> &
  EmailEnv & {
    CLOUDFLARE_DEPLOYMENT_ENV?: string;
    EXPERIENCE_COMPLETION_SCHEDULED_ENABLED?: string;
    NEXT_PUBLIC_SUPABASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    NICEPAY_MID?: string;
    NICEPAY_MERCHANT_KEY?: string;
  };

type FetchLike = typeof fetch;

type ScheduledOptions = {
  runSync?: typeof runExperienceCompletionSync;
  createClient?: (
    environment: ExperienceCompletionScheduledRuntimeEnv,
    fetchImplementation?: FetchLike
  ) => SettlementSyncAdminClient;
  dependencies?: ExperienceCompletionSyncDependencies;
  fetch?: FetchLike;
  now?: () => number;
  createInvocationId?: () => string;
  log?: (entry: Record<string, unknown>) => void;
};

export class ExperienceCompletionScheduledError extends Error {
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
    throw new ExperienceCompletionScheduledError(
      'runtime',
      `missing_${name.toLowerCase()}`
    );
  }
  return value.trim();
}

export function createExperienceCompletionScheduledClient(
  environment: ExperienceCompletionScheduledRuntimeEnv,
  fetchImplementation: FetchLike = fetch
) {
  let supabaseUrl: URL;
  try {
    supabaseUrl = new URL(
      requiredString(environment.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL')
    );
  } catch (error) {
    if (error instanceof ExperienceCompletionScheduledError) throw error;
    throw new ExperienceCompletionScheduledError('runtime', 'invalid_supabase_url');
  }
  const localFixture =
    supabaseUrl.protocol === 'http:' &&
    ['127.0.0.1', 'localhost'].includes(supabaseUrl.hostname);
  const hostedProject =
    supabaseUrl.protocol === 'https:' &&
    /^[a-z0-9]{20}\.supabase\.co$/.test(supabaseUrl.hostname) &&
    supabaseUrl.pathname === '/';
  if (!localFixture && !hostedProject) {
    throw new ExperienceCompletionScheduledError('runtime', 'invalid_supabase_url');
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

function safeLog(
  log: ScheduledOptions['log'],
  entry: Record<string, unknown>
) {
  try {
    (log ?? ((record) => console.log(JSON.stringify(record))))(entry);
  } catch {
    // Observability cannot change completion behavior.
  }
}

export function createExperienceCompletionScheduledDependencies(
  environment: ExperienceCompletionScheduledRuntimeEnv,
  fetchImplementation: FetchLike = fetch
): ExperienceCompletionSyncDependencies {
  return {
    processSoloGuaranteeRefunds: (params) =>
      processSoloGuaranteeRefundsForCompletedBookings({
        ...params,
        cancelCardPaymentFn: (request) =>
          cancelCardPayment(request, {
            environment: environment as Record<string, string | undefined>,
            fetch: fetchImplementation,
          }),
      }),
    deliverReviewRequests: (params) =>
      deliverHostGuestReviewRequestsForCompletedBookings({
        ...params,
        sendEmail: (request) =>
          sendImmediateGenericEmail(request, {
            env: environment,
            supabaseAdmin: params.supabaseAdmin,
          }),
      }),
    deliverGuestReviewRequestEmails: (params) =>
      deliverGuestReviewRequestEmailsForCompletedBookings({
        ...params,
        sendEmail: (request) =>
          sendImmediateGenericEmail(request, {
            env: environment,
            supabaseAdmin: params.supabaseAdmin,
          }),
      }),
    reconcileReviewReminders: (params) =>
      reconcileDueReviewRequestReminders({
        ...params,
        sendEmail: (request) =>
          sendImmediateGenericEmail(request, {
            env: environment,
            supabaseAdmin: params.supabaseAdmin,
          }),
      }),
  };
}

export async function handleExperienceCompletionScheduled(
  controller: { cron: string },
  environment: ExperienceCompletionScheduledRuntimeEnv,
  options: ScheduledOptions = {}
) {
  if (controller.cron !== EXPERIENCE_COMPLETION_SYNC_CRON) {
    return { status: 'not_experience_completion_schedule' } as const;
  }
  if (
    environment.CLOUDFLARE_DEPLOYMENT_ENV !== 'production' ||
    environment.EXPERIENCE_COMPLETION_SCHEDULED_ENABLED !== 'true'
  ) {
    return { status: 'disabled' } as const;
  }

  const startedAt = options.now?.() ?? Date.now();
  const invocationId = options.createInvocationId?.() ?? crypto.randomUUID();
  try {
    const supabaseAdmin = (options.createClient ?? createExperienceCompletionScheduledClient)(
      environment,
      options.fetch
    );
    const result = await (options.runSync ?? runExperienceCompletionSync)({
      supabaseAdmin,
      triggerSource: 'cron',
      dependencies:
        options.dependencies ??
        createExperienceCompletionScheduledDependencies(environment, options.fetch),
    });

    if (!result.success && result.outcome !== 'already_running') {
      throw new ExperienceCompletionScheduledError(
        'processor',
        result.status === 503 ? 'settlement_infrastructure_unavailable' : 'completion_sync_failed'
      );
    }

    const outcome = result.success ? result.outcome : 'already_running';
    const processedCount = result.processedCount ?? 0;
    const skippedCount = result.skippedCount ?? 0;
    safeLog(options.log, {
      event: 'experience_completion_scheduled',
      status: 'completed',
      invocationId,
      outcome,
      processedCount,
      skippedCount,
      durationMs: Math.max(0, (options.now?.() ?? Date.now()) - startedAt),
      diagnosticCode: 'processor_completed',
    });
    return {
      status: 'completed',
      invocationId,
      outcome,
      processedCount,
      skippedCount,
    } as const;
  } catch (error) {
    const diagnosticStage = error instanceof ExperienceCompletionScheduledError
      ? error.diagnosticStage
      : 'processor';
    const diagnosticCode = error instanceof ExperienceCompletionScheduledError
      ? error.diagnosticCode
      : 'completion_sync_failed';
    safeLog(options.log, {
      event: 'experience_completion_scheduled',
      status: 'failed',
      invocationId,
      diagnosticStage,
      diagnosticCode,
      durationMs: Math.max(0, (options.now?.() ?? Date.now()) - startedAt),
    });
    throw new ExperienceCompletionScheduledError(diagnosticStage, diagnosticCode);
  }
}
