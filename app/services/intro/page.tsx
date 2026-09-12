import type { Metadata } from 'next';
import IntroClient from './IntroClient';
import { getCurrentLocale } from '@/app/utils/locale';
import { buildAbsoluteUrl, buildLocalizedAbsoluteUrl } from '@/app/utils/siteUrl';

// OG 이미지: 환경변수 우선, 없으면 일본 사진 fallback, 최종 fallback은 사이트 대표 이미지
const OG_IMAGE =
  process.env.NEXT_PUBLIC_SERVICE_OG_IMAGE ||
  'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&q=80&w=1200';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getCurrentLocale();

  const TITLE_MAP: Record<'ko' | 'en' | 'ja' | 'zh', string> = {
    ko: '일본 현지 동행·통역 맞춤 서비스',
    en: 'Custom Companion & Interpreting in Japan',
    ja: '日本現地の同行・通訳オーダーメイドサービス',
    zh: '日本当地陪同与口译定制服务',
  };

  const DESCRIPTION_MAP: Record<'ko' | 'en' | 'ja' | 'zh', string> = {
    ko: '일본 전역 현지 동행·통역 맞춤 서비스. 일반 1~5인은 시간당 ₩35,000, 비즈니스 또는 6인 이상은 ₩55,000이며 날짜별 3~24시간·총 168시간까지 신청할 수 있습니다.',
    en: 'Custom companion and interpreting support across Japan: KRW 35,000/hour for general 1–5 guest requests and KRW 55,000/hour for business or 6+ guests, up to 168 hours total.',
    ja: '日本各地の同行・通訳サービス。一般1～5名は1時間35,000ウォン、ビジネスまたは6名以上は55,000ウォンで、合計168時間まで申請できます。',
    zh: '覆盖日本各地的陪同与口译定制服务：普通1–5人每小时35,000韩元，商务或6人以上每小时55,000韩元，总计最多168小时。',
  };

  const title = TITLE_MAP[locale];
  const description = DESCRIPTION_MAP[locale];
  const canonicalUrl = buildLocalizedAbsoluteUrl(locale, '/services/intro');
  const ogImageUrl = /^https?:\/\//.test(OG_IMAGE) ? OG_IMAGE : buildAbsoluteUrl(OG_IMAGE);

  return {
    title,
    description,
    keywords: [
      '일본 동행', '일본 현지 가이드', '도쿄 통역', '오사카 맞춤여행',
      '후쿠오카 투어', '현지인 가이드', '맞춤 의뢰', 'Locally',
    ],
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      images: [{ url: ogImageUrl, width: 1200, height: 800, alt: '일본 현지 동행·통역 맞춤 서비스 | Locally' }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
    alternates: {
      canonical: canonicalUrl,
      languages: {
        ko: buildLocalizedAbsoluteUrl('ko', '/services/intro'),
        en: buildLocalizedAbsoluteUrl('en', '/services/intro'),
        ja: buildLocalizedAbsoluteUrl('ja', '/services/intro'),
        zh: buildLocalizedAbsoluteUrl('zh', '/services/intro'),
      },
    },
  };
}

export default function IntroPage() {
  return <IntroClient />;
}
