export type Theme = "light" | "aurora";
const KEY = "tys.theme";

export function readTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === "aurora" ? "aurora" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme) {
  try {
    const h = document.documentElement;
    h.removeAttribute("data-skin");
    if (theme === "aurora") h.setAttribute("data-theme", "aurora");
    else h.removeAttribute("data-theme");
  } catch {}
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {}
  applyTheme(theme);
}
