import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { getCurrentLocale } from '@/app/utils/locale';
import { buildPublicMetadata } from '@/app/utils/publicMetadata';

const TITLE_MAP = {
  ko: '제휴 문의',
  en: 'Partnership',
  ja: '提携のお問い合わせ',
  zh: '合作咨询',
} as const;

const DESCRIPTION_MAP = {
  ko: 'Locally와 함께 새로운 여행 가치를 만들 파트너십 기회를 제안하고 문의할 수 있는 페이지입니다.',
  en: 'Explore partnership opportunities with Locally and get in touch about collaboration ideas.',
  ja: 'Locallyとともに新しい旅行価値をつくるパートナーシップの提案やお問い合わせができるページです。',
  zh: '在这里了解与 Locally 的合作机会，并提交合作提案。',
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getCurrentLocale();

  return buildPublicMetadata({
    locale,
    pathname: '/company/partnership',
    titleMap: TITLE_MAP,
    descriptionMap: DESCRIPTION_MAP,
  });
}

export default function PartnershipLayout({ children }: { children: ReactNode }) {
  return children;
}
