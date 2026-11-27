"use client";

import { useEffect } from "react";

// يسجّل الـ Service Worker الخاص بتطبيق التيم ليدر بسكوب /track-your-sales/tl/ فقط.
export function TlPwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    try {
      navigator.serviceWorker
        .register("/track-your-sales/tl/sw.js", { scope: "/track-your-sales/tl/" })
        .catch(() => {});
    } catch {
      // التسجيل اختياري
    }
  }, []);
  return null;
}
