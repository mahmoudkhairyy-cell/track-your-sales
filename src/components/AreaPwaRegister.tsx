"use client";

import { useEffect } from "react";

// يسجّل الـ Service Worker الخاص بتطبيق مدير المنطقة بسكوب /track-your-sales/area/ فقط.
export function AreaPwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    try {
      navigator.serviceWorker
        .register("/track-your-sales/area/sw.js", { scope: "/track-your-sales/area/" })
        .catch(() => {});
    } catch {
      // التسجيل اختياري
    }
  }, []);
  return null;
}
