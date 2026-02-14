import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://locally-web.vercel.app';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // 관리자 페이지나 개인적인 페이지는 검색엔진 수집 차단
      disallow: ['/admin/', '/host/dashboard/', '/guest/inbox/', '/api/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}