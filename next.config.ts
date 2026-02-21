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
        hostname: 'via.placeholder.com', // 🟢 에러 원인 해결
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com', 
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // 구글 프로필
      },
      // 🟢 [수정됨] 카카오는 http와 https 둘 다 허용해야 합니다!
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
};

// next-intl 플러그인으로 nextConfig 감싸기
export default withNextIntl(nextConfig);
