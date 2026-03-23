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
    ko: '일본 현지인 동행 가이드 맞춤 의뢰',
    en: 'Custom Requests for Local Japanese Companion Guides',
    ja: '日本人ローカルガイド同行のカスタム依頼',
    zh: '日本本地向导陪同定制委托',
  };

  const DESCRIPTION_MAP: Record<'ko' | 'en' | 'ja' | 'zh', string> = {
    ko: '도쿄·오사카·후쿠오카에서 검증된 현지인 호스트와 단둘이 떠나는 맞춤 여행. 시간당 ₩35,000, 최소 4시간부터 의뢰 가능.',
    en: 'Request a verified local host in Tokyo, Osaka, or Fukuoka for a personalized companion trip starting from 4 hours.',
    ja: '東京・大阪・福岡で、認証済みの現地ホストと一緒に楽しむオーダーメイド同行サービス。4時間から依頼できます。',
    zh: '在东京、大阪、福冈委托经过验证的本地房东陪同出行，支持 4 小时起的定制服务。',
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
      images: [{ url: ogImageUrl, width: 1200, height: 800, alt: '일본 현지인 동행 가이드 서비스 | Locally' }],
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
