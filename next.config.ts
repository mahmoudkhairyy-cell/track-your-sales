import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/track-your-sales',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
