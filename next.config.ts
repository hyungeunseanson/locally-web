import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

// next-intl 플러그인 생성
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  // ✅ 이미지 최적화 설정
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'via.placeholder.com', 
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com', 
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', 
      },
      {
        protocol: 'http',
        hostname: 'k.kakaocdn.net', 
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
        hostname: 'uhinvcydgzqlpnvieyal.supabase.co', 
      }
    ],
    dangerouslyAllowSVG: true,
  },
  
  typescript: {
    ignoreBuildErrors: true,
  },

  // 🟢 [핵심] Vercel 배포 시 파일 구조 없는 다국어 지원을 위한 명시적 Rewrite
  async rewrites() {
    return [
      {
        source: '/:locale(en|ja|zh)/:path*',
        destination: '/:path*',
      },
      {
        source: '/:locale(en|ja|zh)',
        destination: '/',
      }
    ];
  },
};

export default withNextIntl(nextConfig);
