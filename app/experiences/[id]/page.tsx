import { Metadata } from 'next';
import { createClient } from '@/app/utils/supabase/server';
import ExperienceClient from './ExperienceClient';

type Props = {
  params: Promise<{ id: string }>;
}

// 🟢 [핵심] 검색 엔진 & 링크 공유를 위한 메타데이터 생성 (서버에서 실행)
export async function generateMetadata(
  { params }: Props
): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  const { data: experience } = await supabase
    .from('experiences')
    .select('title, description, image_url, photos')
    .eq('id', id)
    .single();

  if (!experience) {
    return {
      title: '체험을 찾을 수 없습니다 - Locally',
    }
  }

  // 대표 이미지 선택
  const imageUrl = experience.photos?.[0] || experience.image_url || 'https://images.unsplash.com/photo-1540206395-688085723adb';

  return {
    title: `${experience.title} - Locally`,
    description: experience.description?.slice(0, 100) || '현지인과 함께하는 특별한 여행',
    openGraph: {
      title: experience.title,
      description: experience.description?.slice(0, 100),
      images: [imageUrl],
    },
    twitter: {
      card: 'summary_large_image',
      title: experience.title,
      description: experience.description?.slice(0, 100),
      images: [imageUrl],
    }
  }
}

// 🟢 화면 렌더링 (클라이언트 컴포넌트 호출)
export default async function Page() {
  return <ExperienceClient />;
}