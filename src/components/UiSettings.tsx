"use client";

import { useEffect, useState } from "react";
import { DEFAULT_PREFS, readPrefs, writePrefs, type HomeOptionalId, type UiPrefs } from "@/lib/prefs";

const LABELS: Record<HomeOptionalId, string> = {
  timeline: "🕒 إنجاز النهارده",
  insights: "💡 ملاحظات ذكية",
  forecast: "🔮 توقع نهاية الشهر",
  badges: "🏅 الأوسمة",
};

// إعدادات الواجهة: الاهتزاز وترتيب/إخفاء عناصر الرئيسية. بتتخزن في مفتاح منفصل.
export function UiSettings() {
  const [prefs, setPrefs] = useState<UiPrefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setPrefs(readPrefs());
    setReady(true);
  }, []);

  function update(next: UiPrefs) {
    setPrefs(next);
    writePrefs(next);
  }

  function move(id: HomeOptionalId, dir: -1 | 1) {
    const order = [...prefs.homeOrder];
    const i = order.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    update({ ...prefs, homeOrder: order });
  }

  function toggleHidden(id: HomeOptionalId) {
    const hidden = prefs.homeHidden.includes(id) ? prefs.homeHidden.filter((x) => x !== id) : [...prefs.homeHidden, id];
    update({ ...prefs, homeHidden: hidden });
  }

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
            update({ ...prefs, haptics: e.target.checked });
          }}
          className="h-5 w-5 accent-[#B94700]"
        />
      </label>

      <p className="mt-2 text-[10px] text-[#778398]">الإعدادات دي بتتحفظ على جهازك بس، ومش بتأثر على بيانات المبيعات أو التارجت.</p>
    </section>
  );
}
