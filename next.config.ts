import type { NextConfig } from "next";
import { createRequire } from "node:module";

// نسخة ثابتة تتنشر على GitHub Pages. البيانات بتتحفظ على موبايل كل مستخدم.
// على Vercel (VERCEL=1) بنبني نسخة سيرفر عشان Route Handler بتاع المساعد يشتغل.
// كل دور (موظف/تيم ليدر/مدير فرع/مدير منطقة) ليه تطبيق منفصل بمساره الخاص؛
// APP_ROLE بيختار الدور من roles.config.json، والافتراضي هو تطبيق الموظف.
const require = createRequire(import.meta.url);
const rolesConfig = require("./roles.config.json") as {
  defaultRole: string;
  roles: Record<string, { basePath: string }>;
};

const isVercel = process.env.VERCEL === "1";
const appRole = process.env.APP_ROLE ?? rolesConfig.defaultRole;
const role = rolesConfig.roles[appRole] ?? rolesConfig.roles[rolesConfig.defaultRole];

const nextConfig: NextConfig = {
  ...(isVercel ? {} : { output: "export" as const }),
  basePath: role.basePath,
  env: {
    APP_ROLE: appRole,
    APP_BASE_PATH: role.basePath,
  },
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
