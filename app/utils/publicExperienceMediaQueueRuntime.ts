import {
  createCloudflareImagesPublicExperienceTransformer,
  createR2PublicExperienceMediaMirrorStore,
  PublicExperienceMediaMirrorError,
  type PublicExperienceMediaImagesBindingLike,
  type PublicExperienceMediaMirrorDependencies,
  type PublicExperienceMediaR2BindingLike,
  type PublicExperienceMediaRow,
} from './publicExperienceMediaQueueMirror';

const EXPERIENCE_SELECT = 'id,status,is_active,photos,itinerary,image_url';

export type PublicExperienceMediaQueueRuntimeEnv = {
  CLOUDFLARE_DEPLOYMENT_ENV: string;
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  PUBLIC_EXPERIENCE_MEDIA_R2: PublicExperienceMediaR2BindingLike;
  IMAGES: PublicExperienceMediaImagesBindingLike;
};

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

function requiredEnvironmentValue(value: unknown, name: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`public_experience_media_missing_${name.toLowerCase()}`);
  }
  return value.trim();
}

function latestRowHttpError(status: number) {
  if (status === 401 || status === 403) {
    return new PublicExperienceMediaMirrorError(
      'permanent',
      'latest_row_http_unauthorized',
      status
    );
  }
  if (status === 429) {
    return new PublicExperienceMediaMirrorError(
      'transient',
      'latest_row_http_rate_limited',
      status
    );
  }
  if (status >= 500) {
    return new PublicExperienceMediaMirrorError(
      'transient',
      'latest_row_http_server_error',
      status
    );
  }
  if (status >= 400) {
    return new PublicExperienceMediaMirrorError(
      'permanent',
      'latest_row_http_client_error',
      status
    );
  }
  if (status >= 300) {
    return new PublicExperienceMediaMirrorError(
      'permanent',
      'latest_row_http_redirect',
      status
    );
  }
  return new PublicExperienceMediaMirrorError(
    'transient',
    'latest_row_http_unexpected_status',
    status
  );
}

function isLatestRow(value: unknown): value is PublicExperienceMediaRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const idValid =
    (typeof row.id === 'number' && Number.isSafeInteger(row.id) && row.id > 0) ||
    (typeof row.id === 'string' && /^[1-9][0-9]{0,18}$/.test(row.id));
  return Boolean(
    idValid &&
      (typeof row.status === 'string' || row.status === null) &&
      (typeof row.is_active === 'boolean' || row.is_active === null) &&
      (Array.isArray(row.photos) || row.photos === null) &&
      (Array.isArray(row.itinerary) || row.itinerary === null) &&
      (typeof row.image_url === 'string' || row.image_url === null)
  );
}

export function createPublicExperienceLatestRowLoader(
  environment: Pick<
    PublicExperienceMediaQueueRuntimeEnv,
    'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  >,
  fetchImplementation: FetchLike = fetch
) {
  const supabaseUrl = new URL(
    requiredEnvironmentValue(
      environment.NEXT_PUBLIC_SUPABASE_URL,
      'NEXT_PUBLIC_SUPABASE_URL'
    )
  );
  if (
    supabaseUrl.protocol !== 'https:' ||
    !/^[a-z0-9]{20}\.supabase\.co$/.test(supabaseUrl.hostname) ||
    supabaseUrl.pathname !== '/'
  ) {
    throw new Error('public_experience_media_invalid_supabase_url');
  }
  const anonKey = requiredEnvironmentValue(
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );

  return async (experienceId: string): Promise<PublicExperienceMediaRow | null> => {
    if (!/^[1-9][0-9]{0,18}$/.test(experienceId)) {
      throw new Error('public_experience_media_invalid_experience_id');
    }
    const requestUrl = new URL('/rest/v1/experiences', supabaseUrl);
    requestUrl.searchParams.set('select', EXPERIENCE_SELECT);
    requestUrl.searchParams.set('id', `eq.${experienceId}`);
    requestUrl.searchParams.set('limit', '1');

    let response: Response;
    try {
      response = await fetchImplementation(requestUrl, {
        method: 'GET',
        headers: {
          apikey: anonKey,
          authorization: `Bearer ${anonKey}`,
          accept: 'application/json',
          'cache-control': 'no-store',
        },
        // Workers does not implement redirect="error". Manual mode keeps the
        // request fail-closed because every 3xx is rejected below.
        redirect: 'manual',
      });
    } catch {
      throw new PublicExperienceMediaMirrorError(
        'transient',
        'latest_row_fetch_network_error'
      );
    }
    if (!response.ok) {
      throw latestRowHttpError(response.status);
    }
    const contentType = String(response.headers.get('content-type') || '')
      .split(';', 1)[0]
      .trim()
      .toLowerCase();
    if (contentType !== 'application/json') {
      throw new PublicExperienceMediaMirrorError(
        'permanent',
        'latest_row_unexpected_content_type'
      );
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new PublicExperienceMediaMirrorError(
        'permanent',
        'latest_row_json_parse_failed'
      );
    }
    if (!Array.isArray(payload) || payload.length > 1) {
      throw new PublicExperienceMediaMirrorError(
        'permanent',
        'latest_row_invalid_shape'
      );
    }
    if (payload.length === 0) return null;
    if (!isLatestRow(payload[0])) {
      throw new PublicExperienceMediaMirrorError(
        'permanent',
        'latest_row_invalid_shape'
      );
    }
    return payload[0];
  };
}

export function createPublicExperienceMediaQueueDependencies(
  environment: PublicExperienceMediaQueueRuntimeEnv,
  fetchImplementation: FetchLike = fetch
): PublicExperienceMediaMirrorDependencies {
  if (!environment.PUBLIC_EXPERIENCE_MEDIA_R2) {
    throw new Error('public_experience_media_missing_r2_binding');
  }
  if (!environment.IMAGES) {
    throw new Error('public_experience_media_missing_images_binding');
  }
  return {
    loadLatestExperience: createPublicExperienceLatestRowLoader(
      environment,
      fetchImplementation
    ),
    fetchSource: (sourceUrl) =>
      fetchImplementation(sourceUrl, { method: 'GET', redirect: 'manual' }),
    store: createR2PublicExperienceMediaMirrorStore(
      environment.PUBLIC_EXPERIENCE_MEDIA_R2
    ),
    transformer: createCloudflareImagesPublicExperienceTransformer(
      environment.IMAGES
    ),
  };
}
