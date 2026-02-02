import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // 여기에 eslint 관련 코드는 절대 넣지 마세요.
};

export default nextConfig;