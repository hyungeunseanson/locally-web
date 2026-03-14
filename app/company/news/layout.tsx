import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { getCurrentLocale } from '@/app/utils/locale';
import { buildPublicMetadata } from '@/app/utils/publicMetadata';

const TITLE_MAP = {
  ko: '뉴스룸',
  en: 'Newsroom',
  ja: 'ニュースルーム',
  zh: '新闻中心',
} as const;

const DESCRIPTION_MAP = {
  ko: 'Locally의 주요 소식, 보도자료, 미디어 노출을 한곳에서 확인할 수 있는 뉴스룸입니다.',
  en: 'Read Locally’s latest announcements, press coverage, and newsroom updates in one place.',
  ja: 'Locallyの最新ニュース、報道資料、メディア掲載情報をまとめて確認できるニュースルームです。',
  zh: '在这里查看 Locally 的最新消息、媒体报道和新闻中心更新。',
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getCurrentLocale();

  return buildPublicMetadata({
    locale,
    pathname: '/company/news',
    titleMap: TITLE_MAP,
    descriptionMap: DESCRIPTION_MAP,
  });
}

export default function NewsLayout({ children }: { children: ReactNode }) {
  return children;
}
