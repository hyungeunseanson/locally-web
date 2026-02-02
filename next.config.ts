import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // 빌드 시 타입 에러가 있어도 무시하고 배포를 진행합니다.
    ignoreBuildErrors: true,
  },
  eslint: {
    // 빌드 시 ESLint 에러를 무시합니다.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;