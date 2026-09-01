import { Metadata } from 'next';
import { createClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import ExperienceClient from './ExperienceClient';
import JsonLd from '@/app/components/seo/JsonLd';
import { notFound } from 'next/navigation';
import { ADSENSE_PUBLIC_PATH_META_NAME } from '@/app/utils/desktopFooterAd';
import { getCurrentLocale } from '@/app/utils/locale';
import { buildAbsoluteUrl, buildLocalizedAbsoluteUrl } from '@/app/utils/siteUrl';
import { getContent } from '@/app/utils/contentHelper';
import {
  isPublicHostApplicationStatus,
  pickLatestPublicHostApplication,
} from '@/app/utils/hostVisibility';
import { HostProfileDetail } from './types';
import { PRIVATE_NOINDEX_METADATA } from '@/app/utils/seo';
import { buildBreadcrumbJsonLd, buildExperienceProductJsonLd } from '@/app/utils/structuredData';
import { fetchExperienceAvailabilitySummary } from '@/app/utils/experienceAvailability';
import {
  buildHostProfileDetail,
  getExperiencePrimaryImage,
  getHostReviewAggregateFromRatings,
  isPublicExperienceViewModel,
  normalizeIdentifierValue,
  normalizeExperienceDetailRow,
  normalizeExperienceMetadataRow,
  normalizeHostProfileRow,
  normalizePublicHostApplicationRows,
  normalizeReviewRatingRows,
  toExperienceRawRow,
  toExperienceRawRows,
  type PublicHostApplicationViewModel,
} from './experienceRowHelpers';
import {
  EXPERIENCE_DETAIL_SELECT,
  getPublicExperienceDetail,
} from './publicDetailData.server';

type Props = {
  params: Promise<{ id: string }>;
};

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export const dynamic = 'force-dynamic';

const EXPERIENCE_METADATA_SELECT = [
  'id',
  'host_id',
  'title',
  'description',
  'title_ko',
  'description_ko',
  'title_en',
  'description_en',
  'title_ja',
  'description_ja',
  'title_zh',
  'description_zh',
  'photos',
  'image_url',
  'status',
  'is_active',
].join(', ');

const HOST_PROFILE_SELECT = [
  'id',
  'created_at',
  'avatar_url',
  'full_name',
  'introduction',
  'languages',
  'job',
  'dream_destination',
  'favorite_song',
  'nationality',
  'host_nationality',
  'average_rating',
  'total_review_count',
].join(', ');

const PUBLIC_HOST_APPLICATION_SELECT = [
  'id',
  'user_id',
  'created_at',
  'status',
  'name',
  'profile_photo',
  'self_intro',
  'languages',
  'is_superhost',
].join(', ');

async function loadPublicHostApplication(supabase: ServerSupabaseClient, hostId: string | null | undefined) {
  if (!hostId) {
    return null;
  }

  const { data, error } = await supabase
    .from('public_host_applications')
    .select(PUBLIC_HOST_APPLICATION_SELECT)
    .eq('user_id', hostId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Experience detail] Failed to load public host application:', {
      hostId,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return null;
  }

  return pickLatestPublicHostApplication(normalizePublicHostApplicationRows(data));
}

async function loadHostReviewAggregate(
  supabase: ServerSupabaseClient,
  hostId: string
) {
  const { data: experienceRows, error: experienceError } = await supabase
    .from('experiences')
    .select('id')
    .eq('host_id', hostId);

  if (experienceError) {
    console.error('[Experience detail] Failed to load host experiences for review aggregate:', {
      hostId,
      message: experienceError.message,
      details: experienceError.details,
      hint: experienceError.hint,
      code: experienceError.code,
    });

    return getHostReviewAggregateFromRatings([]);
  }

  const targetExperienceIds = toExperienceRawRows(experienceRows).reduce<string[]>(
    (acc, row) => {
      const id = normalizeIdentifierValue(row.id);
      if (id) {
        acc.push(id);
      }
      return acc;
    },
    []
  );

  if (targetExperienceIds.length === 0) {
    return getHostReviewAggregateFromRatings([]);
  }

  const { data: reviewRows, error: reviewError } = await supabase
    .from('reviews')
    .select('rating')
    .in('experience_id', targetExperienceIds);

  if (reviewError) {
    console.error('[Experience detail] Failed to load review aggregate fallback:', {
      hostId,
      message: reviewError.message,
      details: reviewError.details,
      hint: reviewError.hint,
      code: reviewError.code,
    });

    return getHostReviewAggregateFromRatings([]);
  }

  return getHostReviewAggregateFromRatings(normalizeReviewRatingRows(reviewRows));
}

// 🟢 메타데이터 생성 (SEO & 다국어)
export async function generateMetadata(
  { params }: Props
): Promise<Metadata> {
  const { id } = await params;
  const locale = await getCurrentLocale(); // 현재 언어 감지
  const publicSnapshot = await getPublicExperienceDetail(id);
  const supabase = publicSnapshot ? null : await createClient();
  const { data: experience } = supabase
    ? await supabase
        .from('experiences')
        .select(EXPERIENCE_METADATA_SELECT)
        .eq('id', id)
        .maybeSingle()
    : { data: null };

  const normalizedExperience =
    publicSnapshot?.experience ?? normalizeExperienceMetadataRow(experience);
  if (!normalizedExperience) {
    const rawExperience = toExperienceRawRow(experience);
    if (rawExperience) {
      console.error('[Experience detail] metadata normalize failed for fetched row', {
        routeId: id,
        rawIdValue: rawExperience.id,
        rawIdType: typeof rawExperience.id,
        rawKeys: Object.keys(rawExperience),
      });
    }
  }

  if (!normalizedExperience) {
    return {
      title: '체험을 찾을 수 없습니다',
      robots: PRIVATE_NOINDEX_METADATA.robots,
    };
  }

  // 언어에 맞는 제목과 설명 가져오기
  const title = getContent(normalizedExperience, 'title', locale);
  const description = getContent(normalizedExperience, 'description', locale);
  const imageUrl = getExperiencePrimaryImage(normalizedExperience);
  const isPublicExperience = isPublicExperienceViewModel(normalizedExperience);

  const metadata: Metadata = {
    title,
    description: description?.slice(0, 150) || '현지인과 함께하는 특별한 여행',
    openGraph: {
      title: title,
      description: description?.slice(0, 150),
      images: [imageUrl],
      url: buildLocalizedAbsoluteUrl(locale, `/experiences/${id}`),
      locale: locale,
      siteName: 'Locally',
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description?.slice(0, 150),
      images: [imageUrl],
    },
    alternates: {
      canonical: buildLocalizedAbsoluteUrl(locale, `/experiences/${id}`),
      languages: {
        'ko': buildLocalizedAbsoluteUrl('ko', `/experiences/${id}`),
        'en': buildLocalizedAbsoluteUrl('en', `/experiences/${id}`),
        'ja': buildLocalizedAbsoluteUrl('ja', `/experiences/${id}`),
        'zh': buildLocalizedAbsoluteUrl('zh', `/experiences/${id}`),
      },
    }
  };

  if (!isPublicExperience) {
    return {
      ...metadata,
      robots: PRIVATE_NOINDEX_METADATA.robots,
    };
  }

  const publicHostApplication =
    publicSnapshot?.publicHostApplication ??
    (supabase
      ? await loadPublicHostApplication(supabase, normalizedExperience.host_id)
      : null);
  if (!isPublicHostApplicationStatus(publicHostApplication?.status)) {
    return {
      ...metadata,
      robots: PRIVATE_NOINDEX_METADATA.robots,
    };
  }

  return {
    ...metadata,
    other: {
      [ADSENSE_PUBLIC_PATH_META_NAME]: `/experiences/${id}`,
    },
  };
}

// 🟢 메인 페이지 컴포넌트 (Server Side Rendering)
export default async function Page({ params }: Props) {
  const { id } = await params;
  const locale = await getCurrentLocale();
  const publicSnapshot = await getPublicExperienceDetail(id);
  const supabase = publicSnapshot ? null : await createClient();

  // Public rows use a locale-neutral shared cache. Non-public rows retain the
  // existing cookie-aware read so host/admin preview behavior does not change.
  const expResult = supabase
    ? await supabase
        .from('experiences')
        .select(EXPERIENCE_DETAIL_SELECT)
        .eq('id', id)
        .maybeSingle()
    : { data: null, error: null };

  if (expResult.error) {
    console.error('[Experience detail] Failed to load experience:', {
      id,
      message: expResult.error.message,
      details: expResult.error.details,
      hint: expResult.error.hint,
      code: expResult.error.code,
    });
  }

  const experience =
    publicSnapshot?.experience ?? normalizeExperienceDetailRow(expResult.data);
  if (!experience) {
    const rawExperience = toExperienceRawRow(expResult.data);
    if (rawExperience) {
      console.error('[Experience detail] normalize failed for fetched row', {
        routeId: id,
        rawIdValue: rawExperience.id,
        rawIdType: typeof rawExperience.id,
        rawKeys: Object.keys(rawExperience),
      });
    }
  }

  if (!experience) {
    return notFound();
  }

  const isPublicExperience = isPublicExperienceViewModel(experience);
  let visibleHostApplication: PublicHostApplicationViewModel | null =
    publicSnapshot?.publicHostApplication ?? null;

  if (isPublicExperience) {
    visibleHostApplication =
      visibleHostApplication ??
      (supabase ? await loadPublicHostApplication(supabase, experience.host_id) : null);

    if (!isPublicHostApplicationStatus(visibleHostApplication?.status)) {
      return notFound();
    }
  }

  // 2. 호스트 프로필 데이터 가져오기
  let hostProfile: HostProfileDetail = publicSnapshot?.hostProfile ?? null;
  const adminSupabase = createAdminClient();
  const [availabilitySummary, hostProfileResult] = await Promise.all([
    fetchExperienceAvailabilitySummary(
      adminSupabase,
      id,
      experience.max_guests
    ),
    (async (): Promise<HostProfileDetail> => {
      if (!experience.host_id) {
        return null;
      }

      const app =
        visibleHostApplication ??
        (supabase ? await loadPublicHostApplication(supabase, experience.host_id) : null);
      const publicHostApplication = isPublicHostApplicationStatus(app?.status) ? app : null;
      if (publicSnapshot?.hostProfile?.nationality) {
        return publicSnapshot.hostProfile;
      }

      const hostApplicationNationality =
        publicHostApplication?.id
          ? await adminSupabase
              .from('host_applications')
              .select('host_nationality')
              .eq('id', publicHostApplication.id)
              .maybeSingle()
              .then(({ data, error }) => {
                if (error) {
                  console.error('[Experience detail] Failed to load host nationality fallback:', {
                    hostId: experience.host_id,
                    applicationId: publicHostApplication.id,
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code,
                  });
                  return null;
                }

                return typeof data?.host_nationality === 'string' ? data.host_nationality.trim() || null : null;
              })
          : null;

      if (publicSnapshot) {
        const cachedHostProfile = publicSnapshot.hostProfile;
        if (cachedHostProfile && !cachedHostProfile.nationality && hostApplicationNationality) {
          return {
            ...cachedHostProfile,
            nationality: hostApplicationNationality,
          };
        }
        return cachedHostProfile;
      }

      if (!supabase) {
        return null;
      }

      const { data: profile } = await supabase
        .from('public_profiles')
        .select(HOST_PROFILE_SELECT)
        .eq('id', experience.host_id)
        .maybeSingle();
      const normalizedProfile = normalizeHostProfileRow(profile);
      const cachedReviewCount = normalizedProfile?.total_review_count;
      const cachedAverageRating = normalizedProfile?.average_rating;

      const reviewAggregate =
        cachedReviewCount !== null &&
        cachedReviewCount !== undefined &&
        cachedReviewCount >= 0 &&
        cachedAverageRating !== null &&
        cachedAverageRating !== undefined
          ? {
              reviewCount: cachedReviewCount,
              averageRating: Number(cachedAverageRating.toFixed(2)),
            }
          : await loadHostReviewAggregate(supabase, experience.host_id);

      const builtHostProfile = buildHostProfileDetail({
        hostId: experience.host_id,
        profile: normalizedProfile,
        publicHostApplication,
        fallbackName: 'Locally Host',
        reviewAggregate,
      });

      if (builtHostProfile && !builtHostProfile.nationality && hostApplicationNationality) {
        return {
          ...builtHostProfile,
          nationality: hostApplicationNationality,
        };
      }

      return builtHostProfile;
    })(),
  ]);
  hostProfile = hostProfileResult;

  // 4. Client Component로 데이터 전달
  const experienceJsonLd =
    isPublicExperience
      ? buildExperienceProductJsonLd({
          id,
          locale,
          title: getContent(experience, 'title', locale),
          description: getContent(experience, 'description', locale),
          imageUrl: getExperiencePrimaryImage(experience),
          price: experience.price,
          category: experience.category || null,
          city: experience.city,
          country: experience.country,
          providerName: hostProfile?.name || null,
        })
      : null;
  const breadcrumbNameMap: Record<'ko' | 'en' | 'ja' | 'zh', string> = {
    ko: '홈',
    en: 'Home',
    ja: 'ホーム',
    zh: '首页',
  };
  const experiencePageUrl = buildLocalizedAbsoluteUrl(locale, `/experiences/${id}`);
  const experienceBreadcrumbJsonLd =
    isPublicExperience
      ? buildBreadcrumbJsonLd([
          { name: breadcrumbNameMap[locale], item: buildAbsoluteUrl('/') },
          { name: getContent(experience, 'title', locale), item: experiencePageUrl },
        ])
      : null;

  return (
    <>
      {experienceJsonLd && experienceBreadcrumbJsonLd ? (
        <JsonLd data={[experienceJsonLd, experienceBreadcrumbJsonLd]} />
      ) : experienceJsonLd ? (
        <JsonLd data={experienceJsonLd} />
      ) : null}
      <ExperienceClient
        initialExperience={experience}
        initialHostProfile={hostProfile}
        initialAvailabilitySummary={availabilitySummary}
      />
    </>
  );
}
