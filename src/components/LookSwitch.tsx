"use client";

import { useEffect, useState } from "react";
import { haptic } from "@/lib/prefs";
import { readLook, saveLook, type Look } from "@/lib/look";

const OPTIONS: { key: Look; icon: string; title: string; text: string }[] = [
  { key: "classic", icon: "🎨", title: "الشكل الهادي", text: "الألوان الدافية والكروت الناعمة" },
  { key: "toon", icon: "🤪", title: "الشكل الكارتوني", text: "حدود سميكة وألوان جريئة" },
  { key: "bank", icon: "🏦", title: "الشكل الرسمي", text: "أزرق غامق وأبيض، واضح ومنظم" },
];

export function LookSwitch() {
  const [look, setLook] = useState<Look>("classic");
  useEffect(() => {
    queueMicrotask(() => setLook(readLook()));
  }, []);
  const pick = (next: Look) => {
    setLook(next);
    saveLook(next);
    haptic(15);
  };
  return (
    <section className="rounded-[24px] border border-white bg-white p-4 shadow-sm" aria-label="شكل التطبيق">
      <h2 className="text-base font-black tracking-tight">شكل التطبيق</h2>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={look === o.key}
            onClick={() => pick(o.key)}
            className={`min-h-20 rounded-2xl border px-3 py-3 text-right ${look === o.key ? "border-[#bd4b0a] bg-[#fff0e2]" : "border-[#f2e4d8] bg-white"}`}
          >
            <span className="block text-xl" aria-hidden>{o.icon}</span>
            <span className="block text-sm font-extrabold">{o.title}</span>
            <span className="block text-[11px] text-[var(--color-text-secondary)]">{o.text}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
