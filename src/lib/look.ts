export const LOOKS = [
  { key: "classic", icon: "🎨", title: "الهادي", text: "الألوان الدافية والكروت الناعمة", swatch: ["#fff4eb", "#e96812", "#ffffff"] },
  { key: "toon", icon: "🤪", title: "الكارتوني", text: "حدود سميكة وألوان جريئة", swatch: ["#ff6a13", "#ffd24a", "#1b1209"] },
  { key: "bank", icon: "🏦", title: "الرسمي", text: "أزرق غامق وأبيض واضح", swatch: ["#f3f6fb", "#0f2a5c", "#1d5fd1"] },
  { key: "dark", icon: "🌙", title: "داكن هادي", text: "فحمي دافي وبرتقالي واحد", swatch: ["#1a1613", "#26201b", "#ff8a3d"] },
  { key: "paper", icon: "📓", title: "ورقي", text: "ورق كريمي وخط يد", swatch: ["#f6efdd", "#fffdf4", "#b4532a"] },
  { key: "retro", icon: "👾", title: "ريترو نيون", text: "بنفسجي ليلي ونيون", swatch: ["#120c2b", "#ff3df2", "#28e0ff"] },
  { key: "nature", icon: "🌿", title: "طبيعة", text: "أخضر زيتوني وزوايا مدورة", swatch: ["#eef2e6", "#4f7a36", "#fbfdf6"] },
  { key: "gold", icon: "👑", title: "ذهبي فخم", text: "أسود وذهبي أنيق", swatch: ["#0e0e0e", "#d4af37", "#181613"] },
  { key: "pastel", icon: "🍬", title: "باستيل ناعم", text: "وردي وليلكي مريح", swatch: ["#fdf4f8", "#c78bd9", "#fbe3f0"] },
  { key: "terminal", icon: "💻", title: "تيرمينال", text: "أخضر على أسود، خط كمبيوتر", swatch: ["#050805", "#39ff14", "#0a120a"] },
  { key: "news", icon: "📰", title: "جرائد", text: "أبيض وأسود وخطوط رفيعة", swatch: ["#ffffff", "#111111", "#d8d8d8"] },
] as const;

export type Look = (typeof LOOKS)[number]["key"];
const KEY = "tys.look";

export function readLook(): Look {
  try {
    const v = localStorage.getItem(KEY);
    return LOOKS.some((l) => l.key === v) ? (v as Look) : "classic";
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
