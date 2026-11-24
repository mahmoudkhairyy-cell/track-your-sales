import type { NextConfig } from "next";

// GitHub Pages بيفضل static export، لكن على Vercel (VERCEL=1) بنبني نسخة سيرفر
// عشان Route Handler بتاع المساعد يشتغل. الحقن نفسه بيحصل في
// scripts/prepare-assistant-api.mjs قبل البناء.
const isVercel = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  ...(isVercel ? {} : { output: "export" as const }),
  basePath: "/track-your-sales",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
