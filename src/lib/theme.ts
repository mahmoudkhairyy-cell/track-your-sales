export type Theme = "light" | "aurora" | "aurora-dark" | "space";
const KEY = "tys.theme";

export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "aurora" || v === "aurora-dark" || v === "space" ? v : "light";
  } catch {
    return "light";
  }
}

/** لون شريط الحالة في المتصفح/الموبايل بيتبع المظهر (كان برتقالي ثابت حتى في الداكن). */
const THEME_COLOR: Record<Theme, string> = {
  light: "#e96812",
  aurora: "#e96812",
  "aurora-dark": "#0b0f1e",
  space: "#000000",
};

export function applyTheme(theme: Theme) {
  try {
    const h = document.documentElement;
    h.removeAttribute("data-skin");
    if (theme === "light") h.removeAttribute("data-theme");
    else h.setAttribute("data-theme", theme);
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute("content", THEME_COLOR[theme]));
  } catch {}
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {}
  applyTheme(theme);
}
