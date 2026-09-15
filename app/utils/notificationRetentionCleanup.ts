export const NOTIFICATION_RETENTION_CLEANUP_CRON = '31 19 * * *';
export const NOTIFICATION_RETENTION_DAYS = 30;
export const NOTIFICATION_RETENTION_BATCH_SIZE = 1000;
export const NOTIFICATION_RETENTION_MAX_BATCHES = 5;
export const NOTIFICATION_RETENTION_MAX_DELETES =
  NOTIFICATION_RETENTION_BATCH_SIZE * NOTIFICATION_RETENTION_MAX_BATCHES;

export type NotificationRetentionCleanupResult = {
  success: true;
  cutoff: string;
  deletedCount: number;
  batches: number;
};

export type NotificationRetentionRepository = {
  prune(cutoff: string, batchSize: number): Promise<number>;
};

export type NotificationRetentionCandidate = {
  id: string | number;
  type: string;
  is_read: boolean;
  created_at: string;
};

export function isNotificationRetentionEligible(
  row: Pick<NotificationRetentionCandidate, 'type' | 'is_read' | 'created_at'>,
  cutoff: string
) {
  const createdAtMs = Date.parse(row.created_at);
  const cutoffMs = Date.parse(cutoff);
  if (!Number.isFinite(createdAtMs) || !Number.isFinite(cutoffMs)) {
    throw new NotificationRetentionCleanupError(
      'processor',
      'invalid_preflight_timestamp'
    );
  }
  return createdAtMs < cutoffMs && !(
    row.type === 'profile_demographics_required' && row.is_read === false
  );
}

type SupabaseRpcClient = {
  rpc(
    name: 'prune_notifications_retention',
    params: { p_cutoff: string; p_batch_size: number }
  ): PromiseLike<{ data: unknown; error: unknown }>;
};

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export type NotificationRetentionRuntimeEnv = Record<string, unknown> & {
  CLOUDFLARE_DEPLOYMENT_ENV?: string;
  NOTIFICATION_RETENTION_CLEANUP_SCHEDULED_ENABLED?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

export class NotificationRetentionCleanupError extends Error {
  readonly diagnosticStage: 'runtime' | 'rpc' | 'processor';
  readonly diagnosticCode: string;
  readonly httpStatus?: number;

  constructor(
    diagnosticStage: 'runtime' | 'rpc' | 'processor',
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
    throw new NotificationRetentionCleanupError(
      'runtime',
      `missing_${name.toLowerCase()}`
    );
  }
  return value.trim();
}

function validatedDeletedCount(value: unknown, batchSize: number) {
  const count = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(count) || count < 0 || count > batchSize) {
    throw new NotificationRetentionCleanupError(
      'rpc',
      'rpc_invalid_deleted_count'
    );
  }
  return count;
}

export function buildNotificationRetentionCutoff(now: Date) {
  const timestamp = now.getTime();
  if (!Number.isFinite(timestamp)) {
    throw new NotificationRetentionCleanupError('processor', 'invalid_now');
  }
  return new Date(
    timestamp - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
}

export function createSupabaseNotificationRetentionRepository(
  client: SupabaseRpcClient
): NotificationRetentionRepository {
  return {
    async prune(cutoff, batchSize) {
      const { data, error } = await client.rpc(
        'prune_notifications_retention',
        { p_cutoff: cutoff, p_batch_size: batchSize }
      );
      if (error) throw error;
      return validatedDeletedCount(data, batchSize);
    },
  };
}

export function createCloudflareNotificationRetentionRepository(
  environment: NotificationRetentionRuntimeEnv,
  fetchImplementation: FetchLike = fetch
): NotificationRetentionRepository {
  let supabaseUrl: URL;
  try {
    supabaseUrl = new URL(
      requiredString(environment.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL')
    );
  } catch (error) {
    if (error instanceof NotificationRetentionCleanupError) throw error;
    throw new NotificationRetentionCleanupError('runtime', 'invalid_supabase_url');
  }
  const localFixture =
    supabaseUrl.protocol === 'http:' &&
    ['127.0.0.1', 'localhost'].includes(supabaseUrl.hostname);
  const hostedProject =
    supabaseUrl.protocol === 'https:' &&
    /^[a-z0-9]{20}\.supabase\.co$/.test(supabaseUrl.hostname) &&
    supabaseUrl.pathname === '/';
  if (!localFixture && !hostedProject) {
    throw new NotificationRetentionCleanupError('runtime', 'invalid_supabase_url');
  }
  const serviceRoleKey = requiredString(
    environment.SUPABASE_SERVICE_ROLE_KEY,
    'SUPABASE_SERVICE_ROLE_KEY'
  );
  const endpoint = new URL(
    '/rest/v1/rpc/prune_notifications_retention',
    supabaseUrl
  );

  return {
    async prune(cutoff, batchSize) {
      let response: Response;
      try {
        response = await fetchImplementation(endpoint, {
          method: 'POST',
          redirect: 'manual',
          headers: {
            apikey: serviceRoleKey,
            authorization: `Bearer ${serviceRoleKey}`,
            accept: 'application/json',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ p_cutoff: cutoff, p_batch_size: batchSize }),
        });
      } catch {
        throw new NotificationRetentionCleanupError(
          'rpc',
          'rpc_transport_failed'
        );
      }
      if (!response.ok) {
        const code = response.status === 401 || response.status === 403
          ? 'rpc_unauthorized'
          : response.status === 429
            ? 'rpc_rate_limited'
            : response.status >= 500
              ? 'rpc_server_error'
              : response.status >= 300 && response.status < 400
                ? 'rpc_redirect_rejected'
                : 'rpc_client_error';
        throw new NotificationRetentionCleanupError('rpc', code, response.status);
      }
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new NotificationRetentionCleanupError('rpc', 'rpc_invalid_json');
      }
      return validatedDeletedCount(payload, batchSize);
    },
  };
}

type CleanupOptions = {
  now?: () => Date;
  batchSize?: number;
  maxBatches?: number;
};

export async function runNotificationRetentionCleanup(
  repository: NotificationRetentionRepository,
  options: CleanupOptions = {}
): Promise<NotificationRetentionCleanupResult> {
  const batchSize = options.batchSize ?? NOTIFICATION_RETENTION_BATCH_SIZE;
  const maxBatches = options.maxBatches ?? NOTIFICATION_RETENTION_MAX_BATCHES;
  if (
    !Number.isSafeInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > NOTIFICATION_RETENTION_BATCH_SIZE ||
    !Number.isSafeInteger(maxBatches) ||
    maxBatches < 1 ||
    maxBatches > NOTIFICATION_RETENTION_MAX_BATCHES ||
    batchSize * maxBatches > NOTIFICATION_RETENTION_MAX_DELETES
  ) {
    throw new NotificationRetentionCleanupError(
      'processor',
      'invalid_cleanup_budget'
    );
  }

  const cutoff = buildNotificationRetentionCutoff(
    (options.now ?? (() => new Date()))()
  );
  let deletedCount = 0;
  let batches = 0;
  for (let attempt = 0; attempt < maxBatches; attempt += 1) {
    const batchDeletedCount = await repository.prune(cutoff, batchSize);
    if (batchDeletedCount === 0) break;
    deletedCount += batchDeletedCount;
    batches += 1;
    if (deletedCount > NOTIFICATION_RETENTION_MAX_DELETES) {
      throw new NotificationRetentionCleanupError(
        'processor',
        'cleanup_budget_exceeded'
      );
    }
    if (batchDeletedCount < batchSize) break;
  }

  return { success: true, cutoff, deletedCount, batches };
}

type ScheduledOptions = CleanupOptions & {
  repository?: NotificationRetentionRepository;
  fetch?: FetchLike;
  nowMs?: () => number;
  log?: (entry: Record<string, unknown>) => void;
};

function safeLog(
  log: ScheduledOptions['log'],
  entry: Record<string, unknown>
) {
  try {
    (log ?? ((record) => console.log(JSON.stringify(record))))(entry);
  } catch {
    // Observability must not change deletion semantics.
  }
}

export async function handleNotificationRetentionCleanupScheduled(
  controller: { cron: string },
  environment: NotificationRetentionRuntimeEnv,
  options: ScheduledOptions = {}
) {
  if (controller.cron !== NOTIFICATION_RETENTION_CLEANUP_CRON) {
    return { status: 'not_notification_retention_schedule' } as const;
  }
  if (
    environment.CLOUDFLARE_DEPLOYMENT_ENV !== 'production' ||
    environment.NOTIFICATION_RETENTION_CLEANUP_SCHEDULED_ENABLED !== 'true'
  ) {
    return { status: 'disabled' } as const;
  }

  const startedAt = options.nowMs?.() ?? Date.now();
  try {
    const result = await runNotificationRetentionCleanup(
      options.repository ??
        createCloudflareNotificationRetentionRepository(
          environment,
          options.fetch
        ),
      options
    );
    safeLog(options.log, {
      event: 'notification_retention_cleanup_scheduled',
      status: 'completed',
      cutoff: result.cutoff,
      deletedCount: result.deletedCount,
      batchCount: result.batches,
      durationMs: Math.max(0, (options.nowMs?.() ?? Date.now()) - startedAt),
      diagnosticCode: 'cleanup_completed',
    });
    return { status: 'completed', ...result } as const;
  } catch (error) {
    const diagnosticStage = error instanceof NotificationRetentionCleanupError
      ? error.diagnosticStage
      : 'processor';
    const diagnosticCode = error instanceof NotificationRetentionCleanupError
      ? error.diagnosticCode
      : 'cleanup_failed';
    const httpStatus = error instanceof NotificationRetentionCleanupError
      ? error.httpStatus
      : undefined;
    safeLog(options.log, {
      event: 'notification_retention_cleanup_scheduled',
      status: 'failed',
      diagnosticStage,
      diagnosticCode,
      ...(httpStatus === undefined ? {} : { httpStatus }),
      durationMs: Math.max(0, (options.nowMs?.() ?? Date.now()) - startedAt),
    });
    throw error;
  }
}
