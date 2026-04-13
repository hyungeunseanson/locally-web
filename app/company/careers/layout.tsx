import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { getCurrentLocale } from '@/app/utils/locale';
import { buildPublicMetadata } from '@/app/utils/publicMetadata';

const TITLE_MAP = {
  ko: '채용',
  en: 'Careers',
  ja: '採用情報',
  zh: '招聘',
} as const;

const DESCRIPTION_MAP = {
  ko: 'Locally 채용 방향과 예정 역할을 소개하는 프리뷰 페이지입니다. 공식 지원 링크는 오픈 시점에만 공개됩니다.',
  en: 'Preview Locally’s planned hiring directions and upcoming roles before official application links open.',
  ja: 'Locallyの採用方針と予定ロールを紹介するプレビューページです。正式な応募リンクは公開時点でのみ案内されます。',
  zh: '这是介绍 Locally 招聘方向与计划岗位的预览页，正式申请链接只会在开放时公布。',
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getCurrentLocale();

  return buildPublicMetadata({
    locale,
    pathname: '/company/careers',
    titleMap: TITLE_MAP,
    descriptionMap: DESCRIPTION_MAP,
  });
}

export default function CareersLayout({ children }: { children: ReactNode }) {
  return children;
}
