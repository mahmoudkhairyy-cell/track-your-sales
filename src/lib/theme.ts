export type Theme = "light" | "dark";
const KEY = "tys.theme";

export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    // Migrate the retired glass theme to the single supported premium dark theme.
    if (v === "glass") {
      localStorage.setItem(KEY, "dark");
      return "dark";
    }
    return v === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme) {
  try {
    const h = document.documentElement;
    h.removeAttribute("data-skin");
    if (theme === "light") h.removeAttribute("data-theme");
    else h.setAttribute("data-theme", "dark");
  } catch {}
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {}
  applyTheme(theme);
}
