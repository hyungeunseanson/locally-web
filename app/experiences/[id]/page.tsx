import { Metadata } from 'next';
import { createClient } from '@/app/utils/supabase/server';
import { createAdminClient } from '@/app/utils/supabase/admin';
import ExperienceClient from './ExperienceClient';
import JsonLd from '@/app/components/seo/JsonLd';
import { notFound } from 'next/navigation';
import { getCurrentLocale } from '@/app/utils/locale';
import { buildAbsoluteUrl, buildLocalizedAbsoluteUrl } from '@/app/utils/siteUrl';
import { getContent } from '@/app/utils/contentHelper';
import { getHostPublicProfile } from '@/app/utils/profile';
import { ExperienceDetail, HostProfileDetail } from './types';
import { PRIVATE_NOINDEX_METADATA } from '@/app/utils/seo';
import { buildBreadcrumbJsonLd, buildExperienceProductJsonLd } from '@/app/utils/structuredData';
import { fetchExperienceAvailabilitySummary } from '@/app/utils/experienceAvailability';

type Props = {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

// 🟢 메타데이터 생성 (SEO & 다국어)
export async function generateMetadata(
  { params }: Props
): Promise<Metadata> {
  const { id } = await params;
  const locale = await getCurrentLocale(); // 현재 언어 감지
  const supabase = await createClient();

  // 모든 다국어 컬럼 조회
  const { data: experience } = await supabase
    .from('experiences')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!experience) {
    return {
      title: '체험을 찾을 수 없습니다',
      robots: PRIVATE_NOINDEX_METADATA.robots,
    }
  }

  // 언어에 맞는 제목과 설명 가져오기
  const title = getContent(experience, 'title', locale);
  const description = getContent(experience, 'description', locale);
  const imageUrl = experience.photos?.[0] || experience.image_url || 'https://images.unsplash.com/photo-1540206395-688085723adb';
  const isPublicExperience = experience.status === 'active' && experience.is_active !== false;

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

  return metadata;
}

// 🟢 메인 페이지 컴포넌트 (Server Side Rendering)
export default async function Page({ params }: Props) {
  const { id } = await params;
  const locale = await getCurrentLocale();
  const supabase = await createClient();

  // 1. 병렬 데이터 페칭 (속도 최적화)
  const [expResult, userResult] = await Promise.all([
    supabase.from('experiences').select('*').eq('id', id).maybeSingle(),
    supabase.auth.getUser()
  ]);

  const experience = expResult.data as ExperienceDetail | null;

  if (!experience) {
    return notFound();
  }

  // 2. 호스트 프로필 데이터 가져오기
  let hostProfile: HostProfileDetail = null;
  if (experience.host_id) {
    const [{ data: profile }, { data: app }, { data: reviewRows }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', experience.host_id).maybeSingle(),
      supabase.from('public_host_applications').select('*').eq('user_id', experience.host_id).limit(1).maybeSingle(),
      supabase
        .from('reviews')
        .select('rating, experiences!inner(host_id)')
        .eq('experiences.host_id', experience.host_id),
    ]);

    const joinedYear = profile?.created_at
      ? Math.max(1, new Date().getFullYear() - new Date(profile.created_at).getFullYear())
      : null;
    const hostReviewCount = reviewRows?.length || 0;
    const hostAverageRating = hostReviewCount > 0
      ? Number(((reviewRows || []).reduce((sum, row) => sum + Number(row.rating || 0), 0) / hostReviewCount).toFixed(2))
      : null;
    const publicHostProfile = getHostPublicProfile(profile, app, 'Locally Host');

    hostProfile = {
      id: experience.host_id,
      name: publicHostProfile.name,
      avatar_url: publicHostProfile.avatarUrl || undefined,
      languages: publicHostProfile.languages,
      introduction: publicHostProfile.bio || '안녕하세요! 로컬리 호스트입니다.',
      job: publicHostProfile.job || undefined,
      dream_destination: publicHostProfile.dreamDestination || undefined,
      favorite_song: publicHostProfile.favoriteSong || undefined,
      joined_year: joinedYear,
      review_count: hostReviewCount,
      rating: hostAverageRating,
    };
  }

  // 3. 예약 가능 날짜 및 슬롯 요약 계산
  const availabilitySummary = await fetchExperienceAvailabilitySummary(
    createAdminClient(),
    id,
    Number(experience.max_guests || 10)
  );

  // 4. Client Component로 데이터 전달
  const isPublicExperience = experience.status === 'active' && experience.is_active !== false;
  const experienceJsonLd =
    isPublicExperience
      ? buildExperienceProductJsonLd({
          id,
          locale,
          title: getContent(experience, 'title', locale),
          description: getContent(experience, 'description', locale),
          imageUrl: experience.photos?.[0] || experience.image_url || 'https://images.unsplash.com/photo-1540206395-688085723adb',
          price: typeof experience.price === 'number' ? experience.price : Number(experience.price || 0),
          category: experience.category || null,
          city: experience.city || null,
          country: typeof experience.country === 'string' ? experience.country : null,
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
        initialUser={userResult.data.user}
        initialExperience={experience}
        initialHostProfile={hostProfile}
        initialAvailableDates={availabilitySummary.availableDates}
        initialDateToTimeMap={availabilitySummary.dateToTimeMap}
        initialCalendarDayStatusMap={availabilitySummary.calendarDayStatusMap}
        initialSlotSummaryMap={availabilitySummary.slotSummaryMap}
      />
    </>
  );
}
