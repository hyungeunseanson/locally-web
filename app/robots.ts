import { MetadataRoute } from 'next';
import { buildAbsoluteUrl } from '@/app/utils/siteUrl';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // 관리자 페이지나 개인적인 페이지는 검색엔진 수집 차단
      disallow: ['/admin/', '/host/dashboard/', '/guest/inbox/', '/api/'],
    },
    sitemap: buildAbsoluteUrl('/sitemap.xml'),
  };
}
