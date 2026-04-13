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
  ko: 'Locally 투자자 정보 프리뷰 페이지입니다. 공식 리포트와 검증된 자료는 공개 시점에 순차적으로 반영됩니다.',
  en: 'Preview Locally’s investor relations page. Official reports and verified materials are published only after release.',
  ja: 'Locallyの投資家情報プレビューです。公式レポートと検証済み資料は公開時点で順次反映されます。',
  zh: '这是 Locally 的投资者信息预览页。正式报告和经过验证的资料仅会在发布后逐步公开。',
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
