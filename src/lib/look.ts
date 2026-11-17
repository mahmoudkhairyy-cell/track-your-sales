export type Look = "classic" | "toon" | "bank";
const KEY = "tys.look";

export function readLook(): Look {
  try {
    const v = localStorage.getItem(KEY);
    return v === "toon" || v === "bank" ? v : "classic";
  } catch {
    return "classic";
  }
}

export function applyLook(look: Look) {
  try {
    if (look === "classic") document.documentElement.removeAttribute("data-look");
    else document.documentElement.setAttribute("data-look", look);
  } catch {}
}

export function saveLook(look: Look) {
  try {
    localStorage.setItem(KEY, look);
  } catch {}
  applyLook(look);
}
