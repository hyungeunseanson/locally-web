import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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
