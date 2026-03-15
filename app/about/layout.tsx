import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { getAboutLandingOgImagePath } from '@/app/about/aboutLandingAssets';
import { getCurrentLocale } from '@/app/utils/locale';
import { buildAbsoluteUrl } from '@/app/utils/siteUrl';
import { buildLocalizedAbsoluteUrl } from '@/app/utils/siteUrl';

const TITLE_MAP: Record<'ko' | 'en' | 'ja' | 'zh', string> = {
  ko: 'Locally 소개',
  en: 'About Locally',
  ja: 'Locallyについて',
  zh: '关于 Locally',
};

const DESCRIPTION_MAP: Record<'ko' | 'en' | 'ja' | 'zh', string> = {
  ko: '관광보다 삶에 가까운 여행을 만드는 Locally의 철학과 운영 방식을 소개합니다.',
  en: 'Learn how Locally connects travelers with local hosts through more personal, everyday travel experiences.',
  ja: '観光よりも暮らしに近い旅をつくる、Locallyの考え方と運営方針をご紹介します。',
  zh: '了解 Locally 如何通过更贴近日常生活的旅行体验连接旅行者与本地房东。',
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getCurrentLocale();
  const pageUrl = buildLocalizedAbsoluteUrl(locale, '/about');
  const title = TITLE_MAP[locale];
  const description = DESCRIPTION_MAP[locale];
  const ogImagePath = getAboutLandingOgImagePath(locale);
  const images = ogImagePath
    ? [{ url: buildAbsoluteUrl(ogImagePath), alt: 'About Locally landing image' }]
    : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      images,
      type: 'website',
    },
    twitter: images
      ? {
          card: 'summary_large_image',
          title,
          description,
          images: [images[0].url],
        }
      : undefined,
    alternates: {
      canonical: pageUrl,
      languages: {
        ko: buildLocalizedAbsoluteUrl('ko', '/about'),
        en: buildLocalizedAbsoluteUrl('en', '/about'),
        ja: buildLocalizedAbsoluteUrl('ja', '/about'),
        zh: buildLocalizedAbsoluteUrl('zh', '/about'),
      },
    },
  };
}

export default function AboutLayout({ children }: { children: ReactNode }) {
  return children;
}
