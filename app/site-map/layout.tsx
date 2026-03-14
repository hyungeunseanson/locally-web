import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { getCurrentLocale } from '@/app/utils/locale';
import { buildPublicMetadata } from '@/app/utils/publicMetadata';

const TITLE_MAP = {
  ko: '사이트맵',
  en: 'Sitemap',
  ja: 'サイトマップ',
  zh: '网站地图',
} as const;

const DESCRIPTION_MAP = {
  ko: 'Locally의 주요 공개 페이지와 안내 페이지를 한눈에 확인할 수 있는 사이트맵입니다.',
  en: 'Browse Locally’s key public pages and support pages from one sitemap view.',
  ja: 'Locallyの主要な公開ページと案内ページをひと目で確認できるサイトマップです。',
  zh: '在一个页面中查看 Locally 的主要公开页面与 안내 页面。',
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getCurrentLocale();

  return buildPublicMetadata({
    locale,
    pathname: '/site-map',
    titleMap: TITLE_MAP,
    descriptionMap: DESCRIPTION_MAP,
  });
}

export default function SitemapLayout({ children }: { children: ReactNode }) {
  return children;
}
