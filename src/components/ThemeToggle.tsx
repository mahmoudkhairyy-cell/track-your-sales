"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "tys-theme";

function readStoredDark(): boolean {
  try {
    return localStorage.getItem(THEME_KEY) === "dark";
  } catch {
    return false;
  }
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark") || readStoredDark());
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {
      // Storage can be blocked; the switch still works for this visit.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "التحويل للوضع الفاتح" : "التحويل للوضع الداكن"}
      title={dark ? "الوضع الفاتح" : "الوضع الداكن"}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-[0_4px_12px_rgba(217,104,18,0.12)] ring-1 ring-[#f2e4d8] transition active:scale-95"
    >
      <span aria-hidden="true">{dark ? "☀️" : "🌙"}</span>
    </button>
  );
}
