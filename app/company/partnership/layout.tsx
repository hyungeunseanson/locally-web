import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { getCurrentLocale } from '@/app/utils/locale';
import { buildPublicMetadata } from '@/app/utils/publicMetadata';

const TITLE_MAP = {
  ko: '광고 · 제휴 문의',
  en: 'Advertising & Partnerships',
  ja: '広告・提携のお問い合わせ',
  zh: '广告与合作咨询',
} as const;

const DESCRIPTION_MAP = {
  ko: 'Locally 인스타그램 광고, 브랜드 협업, 제휴 제안을 확인하고 문의할 수 있는 페이지입니다.',
  en: 'Review Locally Instagram advertising options, brand collaborations, and partnership inquiries in one place.',
  ja: 'LocallyのInstagram広告、ブランド協業、提携提案を確認し、そのままお問い合わせできるページです。',
  zh: '在这里查看 Locally 的 Instagram 广告、品牌合作与合作咨询信息，并直接提交咨询。',
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
