export const LOOKS = [
  { key: "classic", icon: "🎨", title: "الهادي", text: "الألوان الدافية والكروت الناعمة", swatch: ["#fff4eb", "#e96812", "#ffffff"] },
  { key: "toon", icon: "🤪", title: "الكارتوني", text: "حدود سميكة وشخصيات كرتونية في كل صفحة", swatch: ["#ff6a13", "#ffd24a", "#1b1209"] },
] as const;

export type Look = (typeof LOOKS)[number]["key"];
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
    const h = document.documentElement;
    h.removeAttribute("data-lk");
    if (look === "toon") h.setAttribute("data-look", "toon");
    else h.removeAttribute("data-look");
  } catch {}
}

export function saveLook(look: Look) {
  try {
    localStorage.setItem(KEY, look);
  } catch {}
  applyLook(look);
}
