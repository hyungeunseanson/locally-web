import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { getCurrentLocale } from '@/app/utils/locale';
import { buildPublicMetadata } from '@/app/utils/publicMetadata';

const TITLE_MAP = {
  ko: '공지사항',
  en: 'Notices',
  ja: 'お知らせ',
  zh: '公告',
} as const;

const DESCRIPTION_MAP = {
  ko: '서비스 운영, 정책 변경, 점검 일정 등 Locally의 공식 공지사항을 확인할 수 있습니다.',
  en: 'Check Locally’s official notices about service updates, policy changes, and scheduled maintenance.',
  ja: 'サービス運営、ポリシー変更、メンテナンス日程など、Locallyの公式お知らせを確認できます。',
  zh: '查看 Locally 关于服务更新、政策变更和维护安排的官方公告。',
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getCurrentLocale();

  return buildPublicMetadata({
    locale,
    pathname: '/company/notices',
    titleMap: TITLE_MAP,
    descriptionMap: DESCRIPTION_MAP,
  });
}

export default function NoticesLayout({ children }: { children: ReactNode }) {
  return children;
}
