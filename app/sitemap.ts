import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { buildAbsoluteUrl } from '@/app/utils/siteUrl';

// 1시간 캐시: 매 크롤러 요청마다 DB 조회하지 않도록
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: buildAbsoluteUrl('/'),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: buildAbsoluteUrl('/about'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: buildAbsoluteUrl('/become-a-host'),
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: buildAbsoluteUrl('/help'),
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    // 회사 소개 관련 페이지
    {
      url: buildAbsoluteUrl('/company/notices'),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: buildAbsoluteUrl('/company/news'),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: buildAbsoluteUrl('/company/community'),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: buildAbsoluteUrl('/company/careers'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: buildAbsoluteUrl('/company/investors'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: buildAbsoluteUrl('/company/partnership'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  // 동적 체험 URL — Supabase에서 active 체험 조회
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: experiences } = await supabase
      .from('experiences')
      .select('id, updated_at')
      .eq('status', 'active');

    const experienceUrls: MetadataRoute.Sitemap = (experiences || []).map((exp) => ({
      url: buildAbsoluteUrl(`/experiences/${exp.id}`),
      lastModified: exp.updated_at ? new Date(exp.updated_at) : new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    }));

    return [...staticUrls, ...experienceUrls];
  } catch {
    // Supabase 조회 실패 시 정적 URL만 반환 (graceful fallback)
    return staticUrls;
  }
}
