"use client";

const KEY = "tys.theme";

/** زرار تبديل الوضع الأسود. بيغيّر attribute على <html> ويفتكر الاختيار. */
export function ThemeSwitch() {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "linear" ? "" : "linear";
    if (next) root.dataset.theme = next;
    else delete root.dataset.theme;
    try {
      if (next) localStorage.setItem(KEY, next);
      else localStorage.removeItem(KEY);
    } catch {
      // لو التخزين مش متاح، الاختيار بيفضل لحد ما الصفحة تتقفل.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="fixed bottom-4 left-4 z-50 rounded-full border border-[var(--brand-border)] bg-[var(--brand-card)] px-3 py-2 text-xs font-bold text-[var(--brand-text)] shadow-md"
    >
      الوضع الأسود
    </button>
  );
}
