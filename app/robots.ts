import { MetadataRoute } from 'next';
import { buildAbsoluteUrl } from '@/app/utils/siteUrl';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      // private UI는 page-level noindex를 우선하고, robots.txt는 크롤 불필요한 API만 차단한다.
      disallow: ['/api/'],
    }, {
      // Keep the training preference visible even when edge-managed robots
      // directives are not prepended to this Worker-generated response.
      // Product tokens (Google/Apple Extended) do not block their search crawlers.
      userAgent: [
        'Amazonbot',
        'Applebot-Extended',
        'Bytespider',
        'CCBot',
        'ClaudeBot',
        'Google-Extended',
        'GPTBot',
        'meta-externalagent',
      ],
      disallow: '/',
    }],
    sitemap: buildAbsoluteUrl('/sitemap.xml'),
  };
}
