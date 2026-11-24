export type Theme = "light" | "dark";
const KEY = "tys.theme";

export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" || v === "aurora-dark" || v === "space" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** لون شريط الحالة في المتصفح/الموبايل بيتبع المظهر (كان برتقالي ثابت حتى في الداكن). */
const THEME_COLOR: Record<Theme,string>={light:'#faf9f6',dark:'#09090b'};

export function applyTheme(theme: Theme) {
  try {
    const h = document.documentElement;
    h.removeAttribute("data-skin");
    h.setAttribute("data-theme", theme);
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute("content", THEME_COLOR[theme]));
  } catch {}
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {}
  applyTheme(theme);
}
