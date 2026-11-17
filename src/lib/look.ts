export type Look = "classic" | "toon";
const KEY = "tys.look";

export function readLook(): Look {
  try {
    return localStorage.getItem(KEY) === "toon" ? "toon" : "classic";
  } catch {
    return "classic";
  }
}

export function applyLook(look: Look) {
  try {
    if (look === "toon") document.documentElement.setAttribute("data-look", "toon");
    else document.documentElement.removeAttribute("data-look");
  } catch {}
}

export function saveLook(look: Look) {
  try {
    localStorage.setItem(KEY, look);
  } catch {}
  applyLook(look);
}
