import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const LEGACY_IMWEB_ORIGIN = 'https://locally2.imweb.me';

const legacyExactPaths = [
  '/programs',
  '/esim',
  '/event',
  '/rss',
  '/32',
  '/38',
  '/51',
  '/52',
  '/57',
  '/59',
  '/62',
  '/64',
  '/73',
  '/75',
  '/1523756371',
  '/shop_cart',
  '/site_join',
  '/site_join_agree',
  '/site_join_pattern_choice',
  '/logout.cm',
];

const legacyWildcardPaths = [
  '/archive/:path*',
  '/shop_view/:path*',
  '/shop_mypage/:path*',
  '/shop_payment/:path*',
  '/shop/:path*',
  '/backpg/:path*',
  '/partner/:path*',
];

const nextConfig: NextConfig = {
  // ✅ 이미지 최적화 설정
  images: {
    formats: ['image/webp'],
    qualities: [65, 75],
    minimumCacheTTL: 86400,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Google Auth Profile
      },
      {
        protocol: 'http',
        hostname: 'k.kakaocdn.net', // Kakao Auth Profile
      },
      {
        protocol: 'https',
        hostname: 'k.kakaocdn.net',
      },
      {
        protocol: 'http',
        hostname: 't1.kakaocdn.net',
      },
      {
        protocol: 'https',
        hostname: 't1.kakaocdn.net',
      },
      {
        protocol: 'https',
        hostname: 'uhinvcydgzqlpnvieyal.supabase.co', // Supabase Storage
      }
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  async redirects() {
    return [
      ...legacyExactPaths.map((source) => ({
        source,
        destination: `${LEGACY_IMWEB_ORIGIN}${source}`,
        permanent: true,
      })),
      ...legacyWildcardPaths.map((source) => ({
        source,
        destination: `${LEGACY_IMWEB_ORIGIN}${source}`,
        permanent: true,
      })),
      {
        source: '/login',
        has: [{ type: 'query', key: 'back_url' }],
        destination: `${LEGACY_IMWEB_ORIGIN}/login`,
        permanent: true,
      },
      {
        source: '/login',
        has: [{ type: 'query', key: 'used_login_btn' }],
        destination: `${LEGACY_IMWEB_ORIGIN}/login`,
        permanent: true,
      },
      {
        source: '/',
        has: [{
          type: 'query',
          key: 'mode',
          value: 'policy|privacy|domesticoverseas',
        }],
        destination: `${LEGACY_IMWEB_ORIGIN}/`,
        permanent: true,
      },
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
      {
        source: '/apply',
        destination: '/become-a-host',
        permanent: true,
      },
      {
        source: '/partners',
        destination: '/company/partnership',
        permanent: true,
      },
      {
        source: '/become-a-host2',
        destination: '/become-a-host',
        permanent: true,
      },
      {
        source: '/:locale(ko|en|ja|zh)/become-a-host2',
        destination: '/:locale/become-a-host',
        permanent: true,
      },
    ];
  },

  // 🟢 [핵심] Vercel 배포 시 파일 구조 없는 다국어 지원을 위한 명시적 Rewrite
  async rewrites() {
    return [
      {
        source: '/api/public/hosts/:hostId/reviews',
        destination: '/api/public-hosts/:hostId/reviews',
      },
      {
        source: '/api/public/experiences/:experienceId/reviews',
        destination: '/api/public-experiences/:experienceId/reviews',
      },
      {
        source: '/:locale(ko|en|ja|zh)/:path*',
        destination: '/:path*',
      },
      {
        source: '/:locale(ko|en|ja|zh)',
        destination: '/',
      }
    ];
  },
};

const shouldUploadSentrySourceMaps = Boolean(
  process.env.SENTRY_AUTH_TOKEN &&
  process.env.SENTRY_ORG &&
  process.env.SENTRY_PROJECT
);

export default shouldUploadSentrySourceMaps
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      telemetry: false,
      widenClientFileUpload: true,
      sourcemaps: {
        deleteSourcemapsAfterUpload: true,
      },
      routeManifestInjection: false,
      suppressOnRouterTransitionStartWarning: true,
      webpack: {
        autoInstrumentServerFunctions: false,
        autoInstrumentMiddleware: false,
        autoInstrumentAppDirectory: false,
        automaticVercelMonitors: false,
        treeshake: {
          removeDebugLogging: true,
          removeTracing: true,
        },
      },
      errorHandler(error) {
        console.warn('[Sentry] Source map upload failed:', error);
      },
    })
  : nextConfig;
