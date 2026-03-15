import type { Metadata } from 'next';

import { buildLocalizedAbsoluteUrl } from '@/app/utils/siteUrl';

type Locale = 'ko' | 'en' | 'ja' | 'zh';

type LocalizedCopy = Record<Locale, string>;

type BuildPublicMetadataOptions = {
  locale: Locale;
  pathname: string;
  titleMap: LocalizedCopy;
  descriptionMap: LocalizedCopy;
  openGraphType?: 'website' | 'article';
};

export function buildPublicMetadata({
  locale,
  pathname,
  titleMap,
  descriptionMap,
  openGraphType = 'website',
}: BuildPublicMetadataOptions): Metadata {
  const pageUrl = buildLocalizedAbsoluteUrl('ko', pathname);
  const title = titleMap[locale];
  const description = descriptionMap[locale];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      type: openGraphType,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: pageUrl,
      languages: {
        ko: buildLocalizedAbsoluteUrl('ko', pathname),
        en: buildLocalizedAbsoluteUrl('en', pathname),
        ja: buildLocalizedAbsoluteUrl('ja', pathname),
        zh: buildLocalizedAbsoluteUrl('zh', pathname),
      },
    },
  };
}
