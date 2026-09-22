import { createClient } from '@supabase/supabase-js';

import { runCancelPendingBookings } from '@/app/utils/bookings/cancelPendingBookings';

export const CANCEL_PENDING_BOOKINGS_CRON = '7,37 * * * *';

export type CancelPendingBookingsScheduledRuntimeEnv = Record<string, unknown> & {
  CLOUDFLARE_DEPLOYMENT_ENV?: string;
  CANCEL_PENDING_BOOKINGS_SCHEDULED_ENABLED?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type FetchLike = typeof fetch;

type ScheduledOptions = {
  runCleanup?: typeof runCancelPendingBookings;
  createClient?: (
    environment: CancelPendingBookingsScheduledRuntimeEnv,
    fetchImplementation?: FetchLike
  ) => ReturnType<typeof createClient>;
  fetch?: FetchLike;
  now?: () => number;
  log?: (entry: Record<string, unknown>) => void;
};

export class CancelPendingBookingsScheduledError extends Error {
  readonly diagnosticStage: 'runtime' | 'processor';
  readonly diagnosticCode: string;

  constructor(diagnosticStage: 'runtime' | 'processor', diagnosticCode: string) {
    super(diagnosticCode);
    this.diagnosticStage = diagnosticStage;
    this.diagnosticCode = diagnosticCode;
  }
}

function requiredString(value: unknown, name: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new CancelPendingBookingsScheduledError(
      'runtime',
      `missing_${name.toLowerCase()}`
    );
  }
  return value.trim();
}

export function createCancelPendingBookingsScheduledClient(
  environment: CancelPendingBookingsScheduledRuntimeEnv,
  fetchImplementation: FetchLike = fetch
) {
  let supabaseUrl: URL;
  try {
    supabaseUrl = new URL(
      requiredString(environment.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL')
    );
  } catch (error) {
    if (error instanceof CancelPendingBookingsScheduledError) throw error;
    throw new CancelPendingBookingsScheduledError('runtime', 'invalid_supabase_url');
  }

  const localFixture =
    supabaseUrl.protocol === 'http:' &&
    ['127.0.0.1', 'localhost'].includes(supabaseUrl.hostname);
  const hostedProject =
    supabaseUrl.protocol === 'https:' &&
    /^[a-z0-9]{20}\.supabase\.co$/.test(supabaseUrl.hostname) &&
    supabaseUrl.pathname === '/';
  if (!localFixture && !hostedProject) {
    throw new CancelPendingBookingsScheduledError('runtime', 'invalid_supabase_url');
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
    // Observability cannot change cleanup behavior.
  }
}

export async function handleCancelPendingBookingsScheduled(
  controller: { cron: string },
  environment: CancelPendingBookingsScheduledRuntimeEnv,
  options: ScheduledOptions = {}
) {
  if (controller.cron !== CANCEL_PENDING_BOOKINGS_CRON) {
    return { status: 'not_cancel_pending_bookings_schedule' } as const;
  }
  if (
    environment.CLOUDFLARE_DEPLOYMENT_ENV !== 'production' ||
    environment.CANCEL_PENDING_BOOKINGS_SCHEDULED_ENABLED !== 'true'
  ) {
    return { status: 'disabled' } as const;
  }

  const startedAt = options.now?.() ?? Date.now();
  try {
    const supabaseAdmin = (options.createClient ?? createCancelPendingBookingsScheduledClient)(
      environment,
      options.fetch
    );
    const result = await (options.runCleanup ?? runCancelPendingBookings)({
      supabaseAdmin,
      triggerSource: 'cron',
    });

    if (!result.success && result.outcome !== 'already_running') {
      throw new CancelPendingBookingsScheduledError('processor', 'pending_cleanup_failed');
    }

    const aggregate = result.success ? {
      cancelledCount: result.cancelledCount,
      activeSkippedCount: result.activeSkippedCount,
      reconciliationRequiredCount: result.reconciliationRequiredCount,
      alreadyTerminalCount: result.alreadyTerminalCount,
      batchCount: result.batchCount,
    } : {
      cancelledCount: 0,
      activeSkippedCount: 0,
      reconciliationRequiredCount: 0,
      alreadyTerminalCount: 0,
      batchCount: 0,
    };
    const outcome = result.success ? result.outcome : 'already_running';
    safeLog(options.log, {
      event: 'cancel_pending_bookings_scheduled',
      status: 'completed',
      outcome,
      ...aggregate,
      durationMs: Math.max(0, (options.now?.() ?? Date.now()) - startedAt),
      diagnosticCode: 'processor_completed',
    });
    return { status: 'completed', outcome, ...aggregate } as const;
  } catch (error) {
    const diagnosticStage = error instanceof CancelPendingBookingsScheduledError
      ? error.diagnosticStage
      : 'processor';
    const diagnosticCode = error instanceof CancelPendingBookingsScheduledError
      ? error.diagnosticCode
      : 'pending_cleanup_failed';
    safeLog(options.log, {
      event: 'cancel_pending_bookings_scheduled',
      status: 'failed',
      diagnosticStage,
      diagnosticCode,
      durationMs: Math.max(0, (options.now?.() ?? Date.now()) - startedAt),
    });
    throw new CancelPendingBookingsScheduledError(diagnosticStage, diagnosticCode);
  }
}
