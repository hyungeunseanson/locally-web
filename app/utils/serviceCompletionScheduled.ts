import { createClient } from '@supabase/supabase-js';

import { runServiceCompletionSync } from '@/app/utils/settlementSync/serviceCompletion';
import type { SettlementSyncAdminClient } from '@/app/utils/settlementSync/types';

export const SERVICE_COMPLETION_SYNC_CRON = '23 */2 * * *';

export type ServiceCompletionScheduledRuntimeEnv = Record<string, unknown> & {
  CLOUDFLARE_DEPLOYMENT_ENV?: string;
  SERVICE_COMPLETION_SCHEDULED_ENABLED?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type FetchLike = typeof fetch;

type ScheduledOptions = {
  runSync?: typeof runServiceCompletionSync;
  createClient?: (
    environment: ServiceCompletionScheduledRuntimeEnv,
    fetchImplementation?: FetchLike
  ) => SettlementSyncAdminClient;
  fetch?: FetchLike;
  now?: () => number;
  log?: (entry: Record<string, unknown>) => void;
};

export class ServiceCompletionScheduledError extends Error {
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
    throw new ServiceCompletionScheduledError('runtime', `missing_${name.toLowerCase()}`);
  }
  return value.trim();
}

export function createServiceCompletionScheduledClient(
  environment: ServiceCompletionScheduledRuntimeEnv,
  fetchImplementation: FetchLike = fetch
) {
  let supabaseUrl: URL;
  try {
    supabaseUrl = new URL(
      requiredString(environment.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL')
    );
  } catch (error) {
    if (error instanceof ServiceCompletionScheduledError) throw error;
    throw new ServiceCompletionScheduledError('runtime', 'invalid_supabase_url');
  }

  const localFixture =
    supabaseUrl.protocol === 'http:' &&
    ['127.0.0.1', 'localhost'].includes(supabaseUrl.hostname);
  const hostedProject =
    supabaseUrl.protocol === 'https:' &&
    /^[a-z0-9]{20}\.supabase\.co$/.test(supabaseUrl.hostname) &&
    supabaseUrl.pathname === '/';
  if (!localFixture && !hostedProject) {
    throw new ServiceCompletionScheduledError('runtime', 'invalid_supabase_url');
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
    // Observability cannot change completion behavior.
  }
}

export async function handleServiceCompletionScheduled(
  controller: { cron: string },
  environment: ServiceCompletionScheduledRuntimeEnv,
  options: ScheduledOptions = {}
) {
  if (controller.cron !== SERVICE_COMPLETION_SYNC_CRON) {
    return { status: 'not_service_completion_schedule' } as const;
  }
  if (
    environment.CLOUDFLARE_DEPLOYMENT_ENV !== 'production' ||
    environment.SERVICE_COMPLETION_SCHEDULED_ENABLED !== 'true'
  ) {
    return { status: 'disabled' } as const;
  }

  const startedAt = options.now?.() ?? Date.now();
  try {
    const supabaseAdmin = (options.createClient ?? createServiceCompletionScheduledClient)(
      environment,
      options.fetch
    );
    const result = await (options.runSync ?? runServiceCompletionSync)({
      supabaseAdmin,
      triggerSource: 'cron',
    });

    if (!result.success && result.outcome !== 'already_running') {
      throw new ServiceCompletionScheduledError(
        'processor',
        result.status === 503 ? 'settlement_infrastructure_unavailable' : 'completion_sync_failed'
      );
    }

    const outcome = result.success ? result.outcome : 'already_running';
    const processedCount = result.processedCount ?? 0;
    const skippedCount = result.skippedCount ?? 0;
    safeLog(options.log, {
      event: 'service_completion_scheduled',
      status: 'completed',
      outcome,
      processedCount,
      skippedCount,
      durationMs: Math.max(0, (options.now?.() ?? Date.now()) - startedAt),
      diagnosticCode: 'processor_completed',
    });
    return { status: 'completed', outcome, processedCount, skippedCount } as const;
  } catch (error) {
    const diagnosticStage = error instanceof ServiceCompletionScheduledError
      ? error.diagnosticStage
      : 'processor';
    const diagnosticCode = error instanceof ServiceCompletionScheduledError
      ? error.diagnosticCode
      : 'completion_sync_failed';
    safeLog(options.log, {
      event: 'service_completion_scheduled',
      status: 'failed',
      diagnosticStage,
      diagnosticCode,
      durationMs: Math.max(0, (options.now?.() ?? Date.now()) - startedAt),
    });
    throw new ServiceCompletionScheduledError(diagnosticStage, diagnosticCode);
  }
}
