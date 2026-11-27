"use client";

import { useEffect } from "react";

// يسجّل الـ Service Worker الخاص بتطبيق مدير الفرع بسكوب /track-your-sales/branch/ فقط.
export function BranchPwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    try {
      navigator.serviceWorker
        .register("/track-your-sales/branch/sw.js", { scope: "/track-your-sales/branch/" })
        .catch(() => {});
    } catch {
      // التسجيل اختياري
    }
  }, []);
  return null;
}
