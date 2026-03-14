import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { getCurrentLocale } from '@/app/utils/locale';
import { buildPublicMetadata } from '@/app/utils/publicMetadata';

const TITLE_MAP = {
  ko: '도움말 센터',
  en: 'Help Center',
  ja: 'ヘルプセンター',
  zh: '帮助中心',
} as const;

const DESCRIPTION_MAP = {
  ko: '예약, 취소, 계정, 호스트 운영, 1:1 문의까지 Locally 이용 중 자주 묻는 질문을 확인하세요.',
  en: 'Find answers about bookings, cancellations, account issues, hosting, and 1:1 support on Locally.',
  ja: '予約、キャンセル、アカウント、ホスト運営、1:1お問い合わせまで、Locallyのよくある質問を確認できます。',
  zh: '查看 Locally 上关于预订、取消、账号、房东运营和 1:1 咨询的常见问题。',
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getCurrentLocale();

  return buildPublicMetadata({
    locale,
    pathname: '/help',
    titleMap: TITLE_MAP,
    descriptionMap: DESCRIPTION_MAP,
  });
}

export default function HelpLayout({ children }: { children: ReactNode }) {
  return children;
}
