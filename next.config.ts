import type { NextConfig } from "next";

// نسخة ثابتة تتنشر على GitHub Pages. البيانات بتتحفظ على موبايل كل مستخدم.
// على Vercel (VERCEL=1) بنبني نسخة سيرفر عشان Route Handler بتاع المساعد يشتغل.
const isVercel = process.env.VERCEL === "1";
const nextConfig: NextConfig = {
  ...(isVercel ? {} : { output: "export" as const }),
  basePath: "/track-your-sales",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
