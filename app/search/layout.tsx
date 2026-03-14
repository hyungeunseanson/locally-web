import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { getCurrentLocale } from '@/app/utils/locale';
import { buildLocalizedAbsoluteUrl } from '@/app/utils/siteUrl';

const TITLE_MAP: Record<'ko' | 'en' | 'ja' | 'zh', string> = {
  ko: '로컬 체험 검색',
  en: 'Search Local Experiences',
  ja: 'ローカル体験を探す',
  zh: '搜索本地体验',
};

const DESCRIPTION_MAP: Record<'ko' | 'en' | 'ja' | 'zh', string> = {
  ko: '도시, 날짜, 언어, 취향에 맞는 로컬 체험을 검색하고 현지 호스트와 특별한 여행을 예약해보세요.',
  en: 'Search local experiences by city, date, language, and vibe, then book a more personal trip with local hosts.',
  ja: '都市・日程・言語・好みに合わせてローカル体験を探し、現地ホストとの特別な旅を予約しましょう。',
  zh: '按城市、日期、语言和偏好搜索本地体验，与当地房东预订更特别的旅行。',
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getCurrentLocale();
  const pageUrl = buildLocalizedAbsoluteUrl(locale, '/search');
  const title = TITLE_MAP[locale];
  const description = DESCRIPTION_MAP[locale];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      type: 'website',
    },
    alternates: {
      canonical: pageUrl,
      languages: {
        ko: buildLocalizedAbsoluteUrl('ko', '/search'),
        en: buildLocalizedAbsoluteUrl('en', '/search'),
        ja: buildLocalizedAbsoluteUrl('ja', '/search'),
        zh: buildLocalizedAbsoluteUrl('zh', '/search'),
      },
    },
  };
}

export default function SearchLayout({ children }: { children: ReactNode }) {
  return children;
}
