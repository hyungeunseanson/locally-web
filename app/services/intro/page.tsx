import type { Metadata } from 'next';
import IntroClient from './IntroClient';

// OG 이미지: 환경변수 우선, 없으면 일본 사진 fallback, 최종 fallback은 사이트 대표 이미지
const OG_IMAGE =
  process.env.NEXT_PUBLIC_SERVICE_OG_IMAGE ||
  'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&q=80&w=1200';

export const metadata: Metadata = {
  title: '일본 현지인 동행 가이드 맞춤 의뢰',
  description:
    '도쿄·오사카·후쿠오카에서 검증된 현지인 호스트와 단둘이 떠나는 맞춤 여행. 시간당 ₩35,000, 최소 4시간부터 의뢰 가능.',
  keywords: [
    '일본 동행', '일본 현지 가이드', '도쿄 통역', '오사카 맞춤여행',
    '후쿠오카 투어', '현지인 가이드', '맞춤 의뢰', 'Locally',
  ],
  openGraph: {
    title: '일본 현지인 동행 가이드 맞춤 의뢰 | Locally',
    description:
      '도쿄·오사카·후쿠오카에서 검증된 현지인 호스트와 단둘이 떠나는 맞춤 여행. 시간당 ₩35,000, 최소 4시간부터 의뢰 가능.',
    images: [{ url: OG_IMAGE, width: 1200, height: 800, alt: '일본 현지인 동행 가이드 서비스 | Locally' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '일본 현지인 동행 가이드 맞춤 의뢰 | Locally',
    description: '도쿄·오사카·후쿠오카에서 검증된 현지인 호스트와 단둘이 떠나는 맞춤 여행.',
    images: [OG_IMAGE],
  },
};

export default function IntroPage() {
  return <IntroClient />;
}
