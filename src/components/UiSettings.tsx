"use client";

import { useEffect, useState } from "react";
import { DEFAULT_PREFS, readPrefs, writePrefs, type UiPrefs } from "@/lib/prefs";

// إعدادات الواجهة: الاهتزاز بس. بيتخزن في مفتاح منفصل.
export function UiSettings() {
  const [prefs, setPrefs] = useState<UiPrefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setPrefs(readPrefs());
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <section className="rounded-[24px] border border-[#E8EDF4] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black tracking-tight text-[#172033]">⚙️ إعدادات الواجهة</h2>
      <label className="mt-4 flex items-center justify-between gap-3 text-sm font-bold text-[#172033]">
        <span>الاهتزاز عند التسجيل <span className="block text-[11px] font-normal text-[#556070]">بيشتغل بس على الأجهزة اللي بتدعمه</span></span>
        <input
          type="checkbox"
          checked={prefs.haptics}
          onChange={(e) => {
            const next = { ...prefs, haptics: e.target.checked };
            setPrefs(next);
            writePrefs(next);
          }}
          className="h-5 w-5 accent-[#B94700]"
        />
      </label>
    </section>
  );
}
