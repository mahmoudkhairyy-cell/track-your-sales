import type { ReactNode } from "react";

// لوجوهات قريبة للتطبيقات اللي في الباقات (مش الأصلية بالظبط): بتتعرض كدايرة/مربع بلون التطبيق.

type Brand = { bg: string; svg: ReactNode };

const W = "#ffffff";

const BRANDS: Record<string, Brand> = {
  tiktok: {
    bg: "#000000",
    svg: (
      <>
        <path d="M14 4h2.6c.3 2 1.6 3.4 3.6 3.6v2.6c-1.3 0-2.5-.4-3.6-1.1v5.6a4.9 4.9 0 1 1-4.9-4.9h.4v2.6a2.3 2.3 0 1 0 2 2.3V4z" fill={W} />
        <path d="M13 3h2.6c.3 2 1.6 3.4 3.6 3.6v2.6c-1.3 0-2.5-.4-3.6-1.1v5.6a4.9 4.9 0 1 1-4.9-4.9h.4v2.6a2.3 2.3 0 1 0 2 2.3V3z" fill="#25F4EE" opacity=".8" />
      </>
    ),
  },
  spotify: {
    bg: "#1DB954",
    svg: (
      <>
        <path d="M5 9c4-1.3 9.5-1 13 1.2" stroke={W} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M6 13c3.4-1 8-.7 11 1" stroke={W} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M7 16.6c2.8-.8 6.4-.5 9 .9" stroke={W} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  amazon: {
    bg: "#232F3E",
    svg: (
      <>
        <text x="12" y="13" textAnchor="middle" fontSize="10" fontWeight="900" fill={W} fontFamily="Arial, sans-serif">a</text>
        <path d="M6 16c3.5 2.2 8.5 2.2 12 0" stroke="#FF9900" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  facebook: {
    bg: "#1877F2",
    svg: <text x="12.5" y="19" textAnchor="middle" fontSize="18" fontWeight="900" fill={W} fontFamily="Arial, sans-serif">f</text>,
  },
  whatsapp: {
    bg: "#25D366",
    svg: (
      <>
        <circle cx="12" cy="11.5" r="6.5" stroke={W} strokeWidth="2" fill="none" />
        <path d="M6.5 18.5l-.8 2.6 2.7-.9" stroke={W} strokeWidth="1.8" fill="none" strokeLinejoin="round" />
      </>
    ),
  },
  youtube: {
    bg: "#FF0000",
    svg: <path d="M9.5 8.5v7l6-3.5z" fill={W} />,
  },
  instagram: {
    bg: "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)",
    svg: (
      <>
        <rect x="6" y="6" width="12" height="12" rx="3.5" stroke={W} strokeWidth="1.8" fill="none" />
        <circle cx="12" cy="12" r="2.8" stroke={W} strokeWidth="1.8" fill="none" />
      </>
    ),
  },
  snapchat: {
    bg: "#FFFC00",
    svg: <path d="M12 6c2.3 0 3.6 1.7 3.6 3.6v1.4c.5.2 1 .3 1.4.2-.2.8-1 1.2-1.7 1.4.5.8 1.2 1.2 2 1.3-.7.9-2.1.9-3.2.7-.3.9-1.2 1.4-2.1 1.4s-1.8-.5-2.1-1.4c-1.1.2-2.5.2-3.2-.7.8-.1 1.5-.5 2-1.3-.7-.2-1.5-.6-1.7-1.4.4.1.9 0 1.4-.2V9.6C8.4 7.7 9.7 6 12 6z" fill="#000" />,
  },
  telegram: {
    bg: "#229ED9",
    svg: <path d="M6 11.5l11.5-4.5-2 10.5-3.4-2.5-1.8 1.8v-2.6l5.5-5-6.8 4.2z" fill={W} />,
  },
  x: {
    bg: "#000000",
    svg: <text x="12" y="17" textAnchor="middle" fontSize="15" fontWeight="900" fill={W} fontFamily="Arial, sans-serif">X</text>,
  },
  skype: {
    bg: "#00AFF0",
    svg: <text x="12" y="17" textAnchor="middle" fontSize="15" fontWeight="900" fill={W} fontFamily="Arial, sans-serif">S</text>,
  },
  pubg: {
    bg: "#F2A900",
    svg: <text x="12" y="15" textAnchor="middle" fontSize="6.5" fontWeight="900" fill="#000" fontFamily="Arial, sans-serif">PUBG</text>,
  },
  kazeon: {
    bg: "#D95B00",
    svg: <text x="12" y="16.5" textAnchor="middle" fontSize="11" fontWeight="900" fill={W} fontFamily="Arial, sans-serif">K</text>,
  },
  netflix: {
    bg: "#E50914",
    svg: <text x="12" y="17.5" textAnchor="middle" fontSize="15" fontWeight="900" fill={W} fontFamily="Arial, sans-serif">N</text>,
  },
};

/** يحوّل نص (اسم باقة أو ميزة) لمفاتيح لوجوهات. */
export function brandKeysFrom(text: string): string[] {
  const t = text.toLowerCase();
  const keys: string[] = [];
  const add = (k: string) => { if (!keys.includes(k)) keys.push(k); };
  if (t.includes("tiktok") || t.includes("تيك")) add("tiktok");
  if (t.includes("spotify")) add("spotify");
  if (t.includes("amazon") || t.includes("امازون")) add("amazon");
  if (t.includes("facebook") || t.includes("فيسبوك")) add("facebook");
  if (t.includes("whatsapp") || t.includes("واتساب")) add("whatsapp");
  if (t.includes("youtube") || t.includes("يوتيوب")) add("youtube");
  if (t.includes("instagram") || t.includes("انستجرام") || t.includes("إنستجرام")) add("instagram");
  if (t.includes("snapchat") || t.includes("سناب")) add("snapchat");
  if (t.includes("telegram") || t.includes("تيليجرام")) add("telegram");
  if (t.includes("twitter") || t.includes("x ")) add("x");
  if (t.includes("skype")) add("skype");
  if (t.includes("pubg") || t.includes("play")) add("pubg");
  if (t.includes("netflix")) add("netflix");
  if (t.includes("كازيون") || t.includes("kazeon") || t.includes("kazyon")) add("kazeon");
  return keys;
}

export function BrandLogo({ id, size = 28 }: { id: string; size?: number }) {
  const brand = BRANDS[id];
  if (!brand) return null;
  const isGradient = brand.bg.startsWith("linear");
  return (
    <span
      aria-label={id}
      className="inline-flex shrink-0 items-center justify-center rounded-lg shadow-sm ring-1 ring-white/70"
      style={{ width: size, height: size, background: brand.bg, backgroundColor: isGradient ? undefined : brand.bg }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.72} height={size * 0.72} aria-hidden>
        {brand.svg}
      </svg>
    </span>
  );
}
