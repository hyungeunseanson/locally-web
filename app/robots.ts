import { MetadataRoute } from 'next';
import { buildAbsoluteUrl } from '@/app/utils/siteUrl';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // private UI는 page-level noindex를 우선하고, robots.txt는 크롤 불필요한 API만 차단한다.
      disallow: ['/api/'],
    },
    sitemap: buildAbsoluteUrl('/sitemap.xml'),
  };
}
