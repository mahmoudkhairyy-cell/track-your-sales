export type Theme = "light" | "dark";
const KEY = "tys.theme";

export function readTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme) {
  try {
    const h = document.documentElement;
    if (theme === "dark") h.setAttribute("data-theme", "dark");
    else h.removeAttribute("data-theme");
  } catch {}
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {}
  applyTheme(theme);
}
