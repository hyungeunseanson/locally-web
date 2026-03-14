import type { Metadata } from 'next';
import { createClient } from '@/app/utils/supabase/server';
import ServiceRequestClient from './ServiceRequestClient';
import { PRIVATE_NOINDEX_METADATA } from '@/app/utils/seo';

// OG 이미지: 환경변수 우선, 없으면 사이트 대표 이미지 fallback
const FALLBACK_OG_IMAGE =
  process.env.NEXT_PUBLIC_SERVICE_OG_IMAGE ||
  'https://cdn.imweb.me/thumbnail/20251114/7d271dc71e667.png';

type Props = { params: Promise<{ requestId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { requestId } = await params;
  const supabase = await createClient();

  const { data: req } = await supabase
    .from('service_requests')
    .select('title, city, service_date, duration_hours, guest_count, status')
    .eq('id', requestId)
    .maybeSingle();

  if (!req) {
    return {
      title: '의뢰를 찾을 수 없습니다',
      robots: PRIVATE_NOINDEX_METADATA.robots,
    };
  }

  const title = `${req.title} — 현지 호스트 모집 중`;
  const description = `📍 ${req.city} · 📅 ${req.service_date} · ⏱ ${req.duration_hours}시간 · 👥 ${req.guest_count}명. 현지인 호스트의 지원을 기다리고 있어요.`;

  return {
    title,
    description,
    robots: PRIVATE_NOINDEX_METADATA.robots,
    openGraph: {
      title: `${title} | Locally`,
      description,
      images: [{ url: FALLBACK_OG_IMAGE, width: 1200, height: 630, alt: title }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [FALLBACK_OG_IMAGE],
    },
  };
}

export default function ServiceRequestPage() {
  return <ServiceRequestClient />;
}
