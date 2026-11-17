"use client";

import { useEffect, useState } from "react";
import { haptic } from "@/lib/prefs";
import { readTheme, saveTheme, type Theme } from "@/lib/theme";

const OPTIONS: { key: Theme; icon: string; title: string; text: string; swatch: string[] }[] = [
  { key: "light", icon: "☀️", title: "فاتح", text: "الشكل الأساسي الدافي", swatch: ["#fff4eb", "#ffffff", "#e96812"] },
  { key: "dark", icon: "🌙", title: "داكن بريميم", text: "Midnight Graphite · Orange Glow", swatch: ["#101216", "#191D24", "#FF7900"] },
  { key: "glass", icon: "🖤", title: "أسود زجاجي", text: "أسود تمامًا وبطاقات زجاجية", swatch: ["#000000", "#1b1b1b", "#FF7900"] },
];

export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    queueMicrotask(() => setTheme(readTheme()));
  }, []);
  const pick = (next: Theme) => {
    setTheme(next);
    saveTheme(next);
    haptic(15);
  };
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="المظهر">
      {OPTIONS.map((o) => {
        const active = theme === o.key;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => pick(o.key)}
            className={`tys-theme-option flex min-h-[84px] items-center gap-3 rounded-2xl border px-3 py-3 text-right ${active ? "border-[#bd4b0a] bg-[#fff0e2]" : "border-[#f2e4d8] bg-white"}`}
          >
            <span className="flex h-12 w-16 shrink-0 overflow-hidden rounded-xl border border-black/10" aria-hidden>
              {o.swatch.map((c) => (
                <span key={c} className="h-full flex-1" style={{ background: c }} />
              ))}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black">{o.icon} {o.title}</span>
              <span className="block text-[11px] text-[var(--color-text-secondary)]">{o.text}</span>
            </span>
            {active ? <span className="text-lg" aria-label="مختار">✔</span> : null}
          </button>
        );
      })}
    </div>
  );
}
