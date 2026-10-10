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
      // Option B preserves Google-Extended (Gemini training and grounding)
      // through the wildcard rules, including their API exclusion.
      // These seven opt-outs remain visible without edge-managed injection.
      userAgent: [
        'Amazonbot',
        'Applebot-Extended',
        'Bytespider',
        'CCBot',
        'ClaudeBot',
        'GPTBot',
        'meta-externalagent',
      ],
      disallow: '/',
    }],
    sitemap: buildAbsoluteUrl('/sitemap.xml'),
  };
}
