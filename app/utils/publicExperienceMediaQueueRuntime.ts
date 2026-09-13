import {
  createCloudflareImagesPublicExperienceTransformer,
  createR2PublicExperienceMediaMirrorStore,
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

    const response = await fetchImplementation(requestUrl, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`,
        accept: 'application/json',
        'cache-control': 'no-store',
      },
      redirect: 'error',
    });
    if (!response.ok) {
      throw new Error('public_experience_media_latest_row_read_failed');
    }
    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || payload.length > 1) {
      throw new Error('public_experience_media_latest_row_invalid_response');
    }
    if (payload.length === 0) return null;
    if (!payload[0] || typeof payload[0] !== 'object' || Array.isArray(payload[0])) {
      throw new Error('public_experience_media_latest_row_invalid_response');
    }
    return payload[0] as PublicExperienceMediaRow;
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
      fetchImplementation(sourceUrl, { method: 'GET', redirect: 'error' }),
    store: createR2PublicExperienceMediaMirrorStore(
      environment.PUBLIC_EXPERIENCE_MEDIA_R2
    ),
    transformer: createCloudflareImagesPublicExperienceTransformer(
      environment.IMAGES
    ),
  };
}
