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
  { key: "sky", icon: "☁️", title: "سما", text: "أزرق سماوي خفيف", swatch: ["#eaf4ff", "#2b8fe6", "#ffffff"] },
  { key: "mint", icon: "🍃", title: "نعناع", text: "أخضر نعناع منعش", swatch: ["#e8faf3", "#1fb584", "#ffffff"] },
  { key: "coral", icon: "🪸", title: "مرجاني", text: "مرجاني دافي", swatch: ["#fff1ee", "#ff6b5a", "#ffffff"] },
  { key: "sand", icon: "🏜️", title: "رملي", text: "درجات الرمل", swatch: ["#f4ead8", "#c08a3e", "#fffaf0"] },
  { key: "lavender", icon: "💜", title: "لافندر", text: "بنفسجي هادي", swatch: ["#f3effc", "#7c5cd6", "#ffffff"] },
  { key: "lemon", icon: "🍋", title: "ليمون", text: "أصفر مشرق", swatch: ["#fffbe0", "#e0c400", "#ffffff"] },
  { key: "ocean", icon: "🌊", title: "محيط", text: "تركواز وبحري", swatch: ["#e3f6f8", "#0aa5b8", "#ffffff"] },
  { key: "rose", icon: "🌹", title: "وردي", text: "وردي دافي", swatch: ["#fff0f3", "#e0457b", "#ffffff"] },
  { key: "cream", icon: "🍦", title: "كريمي", text: "كريمي وبني ناعم", swatch: ["#fbf5e9", "#a0733a", "#fffdf8"] },
  { key: "mono", icon: "⚪", title: "رمادي", text: "رمادي محايد", swatch: ["#f2f2f2", "#444444", "#ffffff"] },
  { key: "candy", icon: "🍭", title: "حلوى", text: "وردي حلو", swatch: ["#fff0fa", "#ff4fb8", "#ffffff"] },
  { key: "steel", icon: "🔩", title: "حديد", text: "رمادي معدني أزرق", swatch: ["#e6eaee", "#3a5873", "#f8fafb"] },
  { key: "midnight", icon: "🌌", title: "منتصف الليل", text: "أزرق ليلي عميق", swatch: ["#0b1224", "#5b8cff", "#131c36"] },
  { key: "forest", icon: "🌲", title: "غابة", text: "أخضر غامق", swatch: ["#0e1a12", "#3ddc84", "#16261b"] },
  { key: "wine", icon: "🍷", title: "نبيذ", text: "خمري غامق", swatch: ["#1c0f14", "#e0476e", "#2a161d"] },
  { key: "sunset", icon: "🌇", title: "غروب", text: "بنفسجي وبرتقالي", swatch: ["#1d1226", "#ff7a59", "#2b1b38"] },
  { key: "ice", icon: "🧊", title: "ثلج داكن", text: "أزرق جليدي", swatch: ["#0f1a22", "#4fd0ff", "#172733"] },
  { key: "coffee", icon: "☕", title: "قهوة", text: "بني قهوة", swatch: ["#1f1611", "#c98b4f", "#2c2019"] },
  { key: "cyber", icon: "🤖", title: "سايبر", text: "أسود ونيون أزرق", swatch: ["#05060f", "#00f0ff", "#0c0f24"] },
  { key: "amoled", icon: "🖤", title: "أسود تمامًا", text: "أسود AMOLED", swatch: ["#000000", "#ff8a3d", "#0d0d0d"] },
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
    const h = document.documentElement;
    if (look === "classic") {
      h.removeAttribute("data-look");
      h.removeAttribute("data-lk");
    } else {
      h.setAttribute("data-look", look);
      if (look === "toon" || look === "bank") h.removeAttribute("data-lk");
      else h.setAttribute("data-lk", "1");
    }
  } catch {}
}

export function saveLook(look: Look) {
  try {
    localStorage.setItem(KEY, look);
  } catch {}
  applyLook(look);
}
