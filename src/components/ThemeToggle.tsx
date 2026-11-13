"use client";

const THEME_KEY = "tys-theme";

// The icon is switched by CSS (html.dark), so no state is needed and server/client markup match.
export function ThemeToggle() {
  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
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
      aria-label="تبديل الوضع الفاتح والداكن"
      title="تبديل الوضع"
      className="tys-theme-toggle flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-[0_4px_12px_rgba(217,104,18,0.12)] ring-1 ring-[#f2e4d8] transition active:scale-95"
    >
      <span aria-hidden="true" className="tys-theme-icon-light">🌙</span>
      <span aria-hidden="true" className="tys-theme-icon-dark">☀️</span>
    </button>
  );
}
