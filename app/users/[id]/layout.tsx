import type { Metadata } from 'next';

import { PRIVATE_NOINDEX_METADATA } from '@/app/utils/seo';
import {
  isPublicHostApplicationStatus,
  pickLatestPublicHostApplication,
} from '@/app/utils/hostVisibility';
import { getCurrentLocale } from '@/app/utils/locale';
import { buildAbsoluteUrl, buildLocalizedAbsoluteUrl } from '@/app/utils/siteUrl';
import { createAdminClient } from '@/app/utils/supabase/admin';

type Locale = 'ko' | 'en' | 'ja' | 'zh';

const TITLE_SUFFIX: Record<Locale, string> = {
  ko: '호스트 프로필',
  en: 'Host Profile',
  ja: 'ホストプロフィール',
  zh: '房东档案',
};

const DESCRIPTION_MAP: Record<Locale, (name: string) => string> = {
  ko: (name) => `${name}님의 Locally 호스트 프로필과 현재 운영 중인 로컬 체험을 확인해보세요.`,
  en: (name) => `Explore ${name}'s Locally host profile and current local experiences.`,
  ja: (name) => `${name}さんのLocallyホストプロフィールと現在公開中のローカル体験をご覧ください。`,
  zh: (name) => `查看 ${name} 在 Locally 上的房东档案与当前提供的本地体验。`,
};

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const locale = await getCurrentLocale();
  const supabase = createAdminClient();

  const { data: hostApps, error } = await supabase
    .from('public_host_applications')
    .select('id, user_id, status, name, self_intro, profile_photo, created_at')
    .eq('user_id', id)
    .order('created_at', { ascending: false });
  const hostApp = pickLatestPublicHostApplication(hostApps || []);

  if (error || !hostApp?.user_id || !hostApp.name || !isPublicHostApplicationStatus(hostApp.status)) {
    return {
      ...PRIVATE_NOINDEX_METADATA,
      title: 'Host Profile',
    };
  }

  const pagePath = `/users/${id}`;
  const canonicalUrl = buildLocalizedAbsoluteUrl(locale, pagePath);
  const title = `${hostApp.name} | ${TITLE_SUFFIX[locale]}`;
  const description = DESCRIPTION_MAP[locale](hostApp.name);
  const imageUrl = hostApp.profile_photo
    ? (/^https?:\/\//.test(hostApp.profile_photo) ? hostApp.profile_photo : buildAbsoluteUrl(hostApp.profile_photo))
    : buildAbsoluteUrl('/images/logo.png');

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'profile',
      images: [
        {
          url: imageUrl,
          alt: `${hostApp.name} | Locally`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
    alternates: {
      canonical: canonicalUrl,
      languages: {
        ko: buildLocalizedAbsoluteUrl('ko', pagePath),
        en: buildLocalizedAbsoluteUrl('en', pagePath),
        ja: buildLocalizedAbsoluteUrl('ja', pagePath),
        zh: buildLocalizedAbsoluteUrl('zh', pagePath),
      },
    },
  };
}

export default function PublicUserProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
