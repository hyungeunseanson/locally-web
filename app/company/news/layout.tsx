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
  ko: '검증이 끝난 외부 기사 링크가 순차적으로 반영되는 Locally 뉴스룸 아카이브 프리뷰입니다.',
  en: 'Preview Locally’s newsroom archive while verified external article links are being prepared.',
  ja: '検証済みの外部記事リンクを順次反映していく、Locallyニュースルームのアーカイブプレビューです。',
  zh: '这是 Locally 新闻中心的归档预览页，已验证的外部报道链接会按顺序补充。',
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
