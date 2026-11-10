import type { WorkingDays } from "@/lib/types";

export const APP_NAME = "Track Your Sales";
export const BRAND_BY = "by Mahmoud Khairy";
export const APP_DISCLAIMER =
  "أداة مستقلة لمتابعة التارجت الشخصي، وليست منتجًا رسميًا أو معتمدًا من Orange.";

export const CAIRO_TZ = "Africa/Cairo";
export const SESSION_COOKIE = "targetx_session";
export const SESSION_DAYS = 30;
export const SCHEMA_VERSION = 1;
export const DEFAULT_COMMISSION = 6000;

/** الفروع المتاحة: الموظف بيختار فرعه أول مرة. */
export const BRANCHES = [
  "OB. Hagar Elnawatya",
  "OB. Janacklise",
  "OB. Mawaser st1",
  "OB. Talaten St",
  "OB. Borg El Borolos",
  "OB. Hamoul",
  "OB. Motobas",
  "OB. Al Teraa St",
  "OB. Cablat St",
  "OB. Eshreen St",
  "OB. Eshreen St2",
  "OB. Nasria",
  "OB. Edco",
  "OB. Markaz Bader",
  "OB. Abo Youssef",
  "OB. Dekihla 2",
  "OB. Ras El Hekma",
  "OB. El Arab Old City",
  "EXP Desouk",
  "EXP Desouk 2",
  "EXP EL Mhmodia",
  "Exp Kafr El Sheikh",
  "EXP Sidi Salem",
  "EXP Amryia ElQesm",
  "EXP Amryia Gomhrya St",
  "EXP Roz Garden",
  "EXP Zawyet Abdel Kader",
  "EXP Hosh Eissy",
  "EXP Kafer EL Dawar 2",
  "EXP Kom Hamada",
  "EXP Montazah",
  "EXP Abo El Matamer",
  "EXP Alamin Old city",
  "EXP Dekhila",
  "EXP El Dabaa",
  "EXP Madenet Elhamam",
  "EXP Matrouh",
  "EXP Camp Shezar",
  "EXP Cleopatra",
  "EXP Mamoura 25st",
  "Fr Montazah2",
  "Fr Smouha Alexandria2",
  "Fr Asafra",
] as const;

/** مديرو المناطق (الأريا مانجر): الموظف بيختار مديره، ومديره بس يشوف تقاريره. */
export const AREA_MANAGERS = ["Abd Elrahman Mahmoud", "Adham Mohey Eldin", "Khaled Mahdy", "Nesma Nassar", "Rana Mohamed"] as const;

/** اختيار لمن مش تابع لفرع: بيتسجل عنده، ومايظهرش في لوحة المدير. */
export const OUTSIDE_BRANCHES = "خارج الفروع";

export const WEEK_DAYS = [
  { key: "sat", label: "السبت", jsDay: 6 },
  { key: "sun", label: "الأحد", jsDay: 0 },
  { key: "mon", label: "الاثنين", jsDay: 1 },
  { key: "tue", label: "الثلاثاء", jsDay: 2 },
  { key: "wed", label: "الأربعاء", jsDay: 3 },
  { key: "thu", label: "الخميس", jsDay: 4 },
  { key: "fri", label: "الجمعة", jsDay: 5 },
] as const;

export type WeekKey = (typeof WEEK_DAYS)[number]["key"];

export const DEFAULT_WORKING_DAYS: WorkingDays = {
  sat: true,
  sun: true,
  mon: true,
  tue: true,
  wed: true,
  thu: true,
  fri: true,
};

export const KPI_CATALOG = [
  {
    key: "new_lines",
    nameEn: "GAs",
    nameAr: "الخطوط الجديدة",
    emoji: "📱",
    unitAr: "خط",
    defaultTarget: 175,
    defaultWeight: 40,
  },
  {
    key: "new_orange_cash",
    nameEn: "New Orange Cash Wallets",
    nameAr: "محافظ Orange Cash الجديدة",
    emoji: "👛",
    unitAr: "محفظة",
    defaultTarget: 158,
    defaultWeight: 0,
  },
  {
    key: "existing_wallets",
    nameEn: "Excite",
    nameAr: "المحافظ القائمة",
    emoji: "💳",
    unitAr: "محفظة",
    defaultTarget: 74,
    defaultWeight: 15,
  },
  {
    key: "points",
    nameEn: "Points",
    nameAr: "النقاط",
    emoji: "⭐",
    unitAr: "نقطة",
    defaultTarget: 1737,
    defaultWeight: 10,
  },
  {
    key: "postpaid_lines",
    nameEn: "Postpaid",
    nameAr: "خطوط Postpaid",
    emoji: "📞",
    unitAr: "خط",
    defaultTarget: 10,
    defaultWeight: 10,
  },
  {
    key: "dsl",
    nameEn: "Home ADSL",
    nameAr: "إنترنت منزلي DSL",
    emoji: "🌐",
    unitAr: "خط",
    defaultTarget: 1,
    defaultWeight: 10,
  },
  {
    // المدير بس: إنتاجية الفرع (تارجت الـ GAs والـ OC). للموظف وزنها صفر ومش بتظهر.
    key: "productivity",
    nameEn: "Productivity (GA & OC)",
    nameAr: "الإنتاجية",
    emoji: "📈",
    unitAr: "%",
    defaultTarget: 100,
    defaultWeight: 0,
  },
  {
    key: "quality",
    nameEn: "KYC & Compliance",
    nameAr: "الجودة",
    emoji: "✅",
    unitAr: "%",
    defaultTarget: 100,
    defaultWeight: 15,
  },
] as const;

export const KPI_EMOJI: Record<string, string> = Object.fromEntries(
  KPI_CATALOG.map((item) => [item.key, item.emoji]),
);

export function kpiEmoji(key: string): string {
  return KPI_EMOJI[key] ?? "🎯";
}

export type KpiKey = (typeof KPI_CATALOG)[number]["key"];

export type Role = "agent" | "team_leader" | "manager" | "area_manager";

// أوزان المدير من شيت الـ KPIs (Agent & Store Manager). المدير مش بيتحسب عليه الـ Existing ولا الـ New Orange Cash كبنود مستقلة بوزن مختلف.
const MANAGER_WEIGHTS: Partial<Record<KpiKey, number>> = {
  new_lines: 30,
  existing_wallets: 15,
  points: 5,
  postpaid_lines: 10,
  dsl: 10,
  productivity: 15,
  quality: 15,
};

/** الوزن الثابت للمؤشر حسب الدور. الأوزان مش بتتعدل من التطبيق، بتتغير من الكود بس. */
export function kpiWeight(key: KpiKey, role: Role): number {
  // التيم ليدر أوزانه زي الموظف بالظبط.
  if (role === "manager") return MANAGER_WEIGHTS[key] ?? 0;
  return KPI_CATALOG.find((item) => item.key === key)?.defaultWeight ?? 0;
}

export const KPI_KEYS = KPI_CATALOG.map((item) => item.key);

export const ARABIC_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
