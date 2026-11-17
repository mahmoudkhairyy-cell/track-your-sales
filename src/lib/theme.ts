export type Theme = "light" | "dark" | "glass";
const KEY = "tys.theme";

export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" || v === "glass" ? v : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme) {
  try {
    const h = document.documentElement;
    // الزجاجي مبني فوق الداكن: بيشيل الألوان من الداكن ويضيف skin فوقه.
    if (theme === "light") {
      h.removeAttribute("data-theme");
      h.removeAttribute("data-skin");
    } else {
      h.setAttribute("data-theme", "dark");
      if (theme === "glass") h.setAttribute("data-skin", "glass");
      else h.removeAttribute("data-skin");
    }
  } catch {}
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {}
  applyTheme(theme);
}
