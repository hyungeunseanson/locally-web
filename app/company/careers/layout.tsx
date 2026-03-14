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
  ko: 'Locally와 함께 여행의 미래를 만들 인재를 찾고 있습니다. 현재 열려 있는 포지션을 확인해보세요.',
  en: 'Join Locally and help build the future of travel. Explore our current open roles.',
  ja: 'Locallyとともに旅の未来をつくる仲間を募集しています。現在募集中のポジションをご確認ください。',
  zh: '加入 Locally，一起打造旅行的未来。查看当前开放的职位。',
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
