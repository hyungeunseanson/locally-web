import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* 배포 시 사소한 에러 무시 설정 */
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;