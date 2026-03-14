import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { getCurrentLocale } from '@/app/utils/locale';
import { buildPublicMetadata } from '@/app/utils/publicMetadata';

const TITLE_MAP = {
  ko: '투자자 정보',
  en: 'Investors',
  ja: '投資家情報',
  zh: '投资者信息',
} as const;

const DESCRIPTION_MAP = {
  ko: 'Locally의 성장 지표, 주요 성과, 재무 자료를 확인할 수 있는 투자자 정보 페이지입니다.',
  en: 'Review Locally’s growth metrics, company highlights, and investor-facing materials.',
  ja: 'Locallyの成長指標、主要成果、投資家向け資料を確認できるページです。',
  zh: '查看 Locally 的增长指标、重要成果和面向投资者的资料。',
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getCurrentLocale();

  return buildPublicMetadata({
    locale,
    pathname: '/company/investors',
    titleMap: TITLE_MAP,
    descriptionMap: DESCRIPTION_MAP,
  });
}

export default function InvestorsLayout({ children }: { children: ReactNode }) {
  return children;
}
