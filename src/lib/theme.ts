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

export function applyTheme(theme: Theme) {
  try {
    const h = document.documentElement;
    h.removeAttribute("data-skin");
    if (theme === "light") h.removeAttribute("data-theme");
    else h.setAttribute("data-theme", theme);
  } catch {}
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {}
  applyTheme(theme);
}
