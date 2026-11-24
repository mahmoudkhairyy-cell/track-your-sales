"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    try {
      navigator.serviceWorker.register("/track-your-sales/sw.js", { scope: "/track-your-sales/" }).catch(() => {});
    } catch {
      // التسجيل اختياري
    }
  }, []);
  return null;
}
