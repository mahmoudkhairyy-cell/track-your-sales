"use client";

import { useEffect } from "react";

// تحويل دائم: لوحة مدير المنطقة اتنقلت إلى /area/ — الروابط القديمة تفضل شغالة.
export default function ManagerRedirect() {
  useEffect(() => {
    window.location.replace("/track-your-sales/area/");
  }, []);
  return (
    <main dir="rtl" className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#fffaf5] p-8 text-center">
      <p className="text-sm font-bold text-[var(--color-text-primary)]">لوحة مدير المنطقة اتنقلت إلى عنوان جديد.</p>
      <a className="text-sm font-black text-[var(--color-primary-700)] underline" href="/track-your-sales/area/">
        افتح لوحة مدير المنطقة
      </a>
    </main>
  );
}
