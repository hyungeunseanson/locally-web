export const HOME_POPULARITY_SNAPSHOT_CRON = '17 19 * * *';

export type HomePopularitySnapshotResult = {
  success: true;
  refreshedCount: number;
  refreshedAt: string;
};

export type HomePopularitySnapshotRepository = {
  refresh(): Promise<number>;
};

type SupabaseRpcClient = {
  rpc(name: 'refresh_experience_popularity_snapshot'): PromiseLike<{
    data: unknown;
    error: unknown;
  }>;
};

export type HomePopularitySnapshotRuntimeEnv = Record<string, unknown> & {
  CLOUDFLARE_DEPLOYMENT_ENV?: string;
  HOME_POPULARITY_SNAPSHOT_SCHEDULED_ENABLED?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export class HomePopularitySnapshotError extends Error {
  readonly diagnosticStage: 'runtime' | 'rpc';
  readonly diagnosticCode: string;
  readonly httpStatus?: number;

  constructor(
    diagnosticStage: 'runtime' | 'rpc',
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
    throw new HomePopularitySnapshotError(
      'runtime',
      `missing_${name.toLowerCase()}`
    );
  }
  return value.trim();
}

function validatedRefreshedCount(value: unknown) {
  const count = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new HomePopularitySnapshotError('rpc', 'rpc_invalid_result');
  }
  return count;
}

export function createSupabaseHomePopularitySnapshotRepository(
  client: SupabaseRpcClient
): HomePopularitySnapshotRepository {
  return {
    async refresh() {
      const { data, error } = await client.rpc(
        'refresh_experience_popularity_snapshot'
      );
      if (error) throw error;
      return validatedRefreshedCount(data);
    },
  };
}

export function createCloudflareHomePopularitySnapshotRepository(
  environment: HomePopularitySnapshotRuntimeEnv,
  fetchImplementation: FetchLike = fetch
): HomePopularitySnapshotRepository {
  const supabaseUrl = new URL(
    requiredString(environment.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL')
  );
  const localFixture =
    supabaseUrl.protocol === 'http:' &&
    ['127.0.0.1', 'localhost'].includes(supabaseUrl.hostname);
  const hostedProject =
    supabaseUrl.protocol === 'https:' &&
    /^[a-z0-9]{20}\.supabase\.co$/.test(supabaseUrl.hostname) &&
    supabaseUrl.pathname === '/';
  if (!localFixture && !hostedProject) {
    throw new HomePopularitySnapshotError('runtime', 'invalid_supabase_url');
  }
  const serviceRoleKey = requiredString(
    environment.SUPABASE_SERVICE_ROLE_KEY,
    'SUPABASE_SERVICE_ROLE_KEY'
  );
  const endpoint = new URL(
    '/rest/v1/rpc/refresh_experience_popularity_snapshot',
    supabaseUrl
  );

  return {
    async refresh() {
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
          body: '{}',
        });
      } catch {
        throw new HomePopularitySnapshotError('rpc', 'rpc_transport_failed');
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
        throw new HomePopularitySnapshotError('rpc', code, response.status);
      }
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new HomePopularitySnapshotError('rpc', 'rpc_invalid_json');
      }
      return validatedRefreshedCount(payload);
    },
  };
}

export async function refreshHomePopularitySnapshot(
  repository: HomePopularitySnapshotRepository,
  now: () => Date = () => new Date()
): Promise<HomePopularitySnapshotResult> {
  const refreshedCount = await repository.refresh();
  return {
    success: true,
    refreshedCount,
    refreshedAt: now().toISOString(),
  };
}

type ScheduledOptions = {
  repository?: HomePopularitySnapshotRepository;
  fetch?: FetchLike;
  now?: () => Date;
  log?: (entry: Record<string, unknown>) => void;
};

function safeLog(
  log: ScheduledOptions['log'],
  entry: Record<string, unknown>
) {
  try {
    (log ?? ((record) => console.log(JSON.stringify(record))))(entry);
  } catch {
    // Observability must not change refresh semantics.
  }
}

export async function handleHomePopularitySnapshotScheduled(
  controller: { cron: string },
  environment: HomePopularitySnapshotRuntimeEnv,
  options: ScheduledOptions = {}
) {
  if (controller.cron !== HOME_POPULARITY_SNAPSHOT_CRON) {
    return { status: 'not_home_popularity_schedule' } as const;
  }
  if (
    environment.CLOUDFLARE_DEPLOYMENT_ENV !== 'production' ||
    environment.HOME_POPULARITY_SNAPSHOT_SCHEDULED_ENABLED !== 'true'
  ) {
    return { status: 'disabled' } as const;
  }

  try {
    const result = await refreshHomePopularitySnapshot(
      options.repository ??
        createCloudflareHomePopularitySnapshotRepository(
          environment,
          options.fetch
        ),
      options.now
    );
    safeLog(options.log, {
      event: 'home_popularity_snapshot_scheduled',
      status: 'refreshed',
      refreshedCount: result.refreshedCount,
      refreshedAt: result.refreshedAt,
      diagnosticCode: 'refresh_succeeded',
    });
    return { status: 'refreshed', ...result } as const;
  } catch (error) {
    const diagnosticStage = error instanceof HomePopularitySnapshotError
      ? error.diagnosticStage
      : 'rpc';
    const diagnosticCode = error instanceof HomePopularitySnapshotError
      ? error.diagnosticCode
      : 'refresh_failed';
    const httpStatus = error instanceof HomePopularitySnapshotError
      ? error.httpStatus
      : undefined;
    safeLog(options.log, {
      event: 'home_popularity_snapshot_scheduled',
      status: 'failed',
      diagnosticStage,
      diagnosticCode,
      ...(httpStatus === undefined ? {} : { httpStatus }),
    });
    throw error;
  }
}
