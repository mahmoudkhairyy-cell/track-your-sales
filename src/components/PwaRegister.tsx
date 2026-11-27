"use client";

import { useEffect } from "react";
import { APP_BASE_PATH } from "@/lib/app-config";

// مسارات تطبيقات الأدوار الأخرى: ليها SW خاص بكل منها، فلا نسجّل SW الموظف تحتها.
const ROLE_SUBPATHS = ["/tl/", "/branch/", "/area/"];

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (ROLE_SUBPATHS.some((sub) => window.location.pathname.startsWith(`${APP_BASE_PATH}${sub}`))) return;
    try {
      navigator.serviceWorker.register(`${APP_BASE_PATH}/sw.js`, { scope: `${APP_BASE_PATH}/` }).catch(() => {});
    } catch {
      // التسجيل اختياري
    }
  }, []);
  return null;
}
