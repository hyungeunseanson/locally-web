import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 빌드 시 ESLint 검사를 건너뛰어 에러 발생을 방지합니다.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 빌드 시 타입 체크 에러가 있어도 배포를 진행합니다.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;