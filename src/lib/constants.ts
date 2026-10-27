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
    nameEn: "New Lines",
    nameAr: "New Lines",
    emoji: "📱",
    unitAr: "خط",
    defaultTarget: 175,
    defaultWeight: 40,
  },
  {
    key: "new_orange_cash",
    nameEn: "New Orange Cash Wallets",
    nameAr: "New Orange Cash Wallets",
    emoji: "👛",
    unitAr: "محفظة",
    defaultTarget: 158,
    defaultWeight: 0,
  },
  {
    key: "existing_wallets",
    nameEn: "Existing Wallets",
    nameAr: "Existing Wallets",
    emoji: "💳",
    unitAr: "محفظة",
    defaultTarget: 74,
    defaultWeight: 15,
  },
  {
    key: "points",
    nameEn: "Points",
    nameAr: "Points",
    emoji: "⭐",
    unitAr: "نقطة",
    defaultTarget: 1737,
    defaultWeight: 10,
  },
  {
    key: "postpaid_lines",
    nameEn: "Postpaid Lines",
    nameAr: "Postpaid Lines",
    emoji: "📞",
    unitAr: "خط",
    defaultTarget: 10,
    defaultWeight: 10,
  },
  {
    key: "dsl",
    nameEn: "DSL",
    nameAr: "DSL",
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
    unitAr: "عملية",
    defaultTarget: 0,
    defaultWeight: 0,
  },
  {
    key: "quality",
    nameEn: "Quality",
    nameAr: "Quality",
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

export type Role = "agent" | "manager";

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
