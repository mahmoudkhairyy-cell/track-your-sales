export type Theme = "light";

// Track Your Sales currently uses the original light appearance only.
export function readTheme(): Theme {
  try {
    localStorage.removeItem("tys.theme");
  } catch {}
  return "light";
}

export function applyTheme(_theme: Theme) {
  try {
    const root = document.documentElement;
    root.removeAttribute("data-theme");
    root.removeAttribute("data-skin");
  } catch {}
}

export function saveTheme(_theme: Theme) {
  applyTheme("light");
}
