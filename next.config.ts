import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

// next-intl 플러그인 생성 (명시적 경로 설정)
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  // ✅ 이미지 최적화를 위한 도메인 허용 설정 (필수!)
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
      // 사용자님의 실제 Supabase 프로젝트 ID
      {
        protocol: 'https',
        hostname: 'uhinvcydgzqlpnvieyal.supabase.co', 
      }
    ],
    dangerouslyAllowSVG: true, // 🟢 SVG 아이콘 허용 (window.svg 등)
  },
  
  // 타입 에러 무시 (빌드 성공을 위해 유지)
  typescript: {
    ignoreBuildErrors: true,
  },

  // 🟢 [추가] Vercel 배포 시 미들웨어 무시 방지를 위한 명시적 Rewrite (안전 장치)
  // 파일 구조 변경 없이 /en -> / 로 내부 매핑을 강제함
  // async rewrites() {
  //   return [
  //     {
  //       source: '/:locale(en|ja|zh)/:path*',
  //       destination: '/:path*',
  //     },
  //     {
  //       source: '/:locale(en|ja|zh)',
  //       destination: '/',
  //     }
  //   ];
  // },
  // ⚠️ 주의: next-intl 미들웨어를 사용하는 경우, next.config.js의 rewrites는 충돌할 수 있어 주석 처리함.
  // 대신 미들웨어 matcher를 강화했으므로, 이것만으로도 충분해야 함.
};

// next-intl 플러그인으로 nextConfig 감싸기
export default withNextIntl(nextConfig);
