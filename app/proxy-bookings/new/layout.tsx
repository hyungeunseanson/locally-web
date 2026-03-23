import type { Metadata } from 'next';

import { getCurrentLocale } from '@/app/utils/locale';
import { buildAbsoluteUrl, buildLocalizedAbsoluteUrl } from '@/app/utils/siteUrl';

const TITLE_MAP: Record<'ko' | 'en' | 'ja' | 'zh', string> = {
  ko: '일본 전화 예약 · 문의 대행',
  en: 'Japan Phone Reservation & Inquiry Support',
  ja: '日本の電話予約・問い合わせ代行',
  zh: '日本电话预约与咨询代办',
};

const DESCRIPTION_MAP: Record<'ko' | 'en' | 'ja' | 'zh', string> = {
  ko: '일본 현지인 팀원이 식당 예약, 숙소 문의, 교통 예약, 재고 확인, 분실물 문의까지 일본어 전화로 대신 확인해드립니다.',
  en: 'Our Japan-based team handles restaurant reservations, hotel inquiries, transport bookings, stock checks, and lost item calls in Japanese for you.',
  ja: '日本在住チームが、飲食店予約、宿泊先への問い合わせ、交通予約、在庫確認、忘れ物対応まで日本語の電話で代行します。',
  zh: '由日本当地团队代为拨打日语电话，处理餐厅预约、住宿咨询、交通预约、库存确认与失物咨询。',
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getCurrentLocale();
  const title = TITLE_MAP[locale];
  const description = DESCRIPTION_MAP[locale];
  const canonicalUrl = buildLocalizedAbsoluteUrl(locale, '/proxy-bookings/new');
  const ogImage = buildAbsoluteUrl('/images/services/phone-reservation-fr2.jpg');

  return {
    title,
    description,
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
      },
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'website',
      images: [{ url: ogImage, alt: '일본 전화 예약 · 문의 대행 | Locally' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: canonicalUrl,
      languages: {
        ko: buildLocalizedAbsoluteUrl('ko', '/proxy-bookings/new'),
        en: buildLocalizedAbsoluteUrl('en', '/proxy-bookings/new'),
        ja: buildLocalizedAbsoluteUrl('ja', '/proxy-bookings/new'),
        zh: buildLocalizedAbsoluteUrl('zh', '/proxy-bookings/new'),
      },
    },
  };
}

export default function ProxyBookingsNewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
