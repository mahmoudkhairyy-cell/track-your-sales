import type { NextConfig } from "next";

// نسخة ثابتة تتنشر على GitHub Pages. البيانات بتتحفظ على موبايل كل مستخدم.
const nextConfig: NextConfig = {
  output: "export",
  basePath: "/track-your-sales",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
