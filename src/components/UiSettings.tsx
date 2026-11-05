"use client";

import { useEffect, useState } from "react";
import { DEFAULT_PREFS, haptic, readPrefs, writePrefs, type HomeOptionalId, type UiPrefs } from "@/lib/prefs";

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
            if (e.target.checked) haptic(18);
          }}
          className="h-5 w-5 accent-[#B94700]"
        />
      </label>

      <p className="mt-5 text-sm font-black text-[#172033]">ترتيب عناصر الرئيسية</p>
      <ul className="mt-2 grid gap-2">
        {prefs.homeOrder.map((id, index) => {
          const hidden = prefs.homeHidden.includes(id);
          return (
            <li key={id} className="flex items-center justify-between gap-2 rounded-2xl border border-[#E8EDF4] bg-[#F5F8FC] px-3 py-2.5">
              <span className={`text-sm font-extrabold ${hidden ? "text-[#778398] line-through" : "text-[#172033]"}`}>{LABELS[id]}</span>
              <span className="flex items-center gap-1.5">
                <button type="button" aria-label="أطلع فوق" onClick={() => move(id, -1)} disabled={index === 0} className="h-8 w-8 rounded-full bg-white text-sm font-black text-[#B94700] disabled:opacity-40">↑</button>
                <button type="button" aria-label="أنزل تحت" onClick={() => move(id, 1)} disabled={index === prefs.homeOrder.length - 1} className="h-8 w-8 rounded-full bg-white text-sm font-black text-[#B94700] disabled:opacity-40">↓</button>
                <button type="button" onClick={() => toggleHidden(id)} className="rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-[#B94700]">{hidden ? "إظهار" : "إخفاء"}</button>
              </span>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => update(DEFAULT_PREFS)}
        className="mt-4 min-h-11 w-full rounded-2xl border border-[#E8EDF4] bg-white text-sm font-extrabold text-[#556070]"
      >
        استعادة الترتيب الافتراضي
      </button>
      <p className="mt-2 text-[10px] text-[#778398]">الإعدادات دي بتتحفظ على جهازك بس، ومش بتأثر على بيانات المبيعات أو التارجت.</p>
    </section>
  );
}
