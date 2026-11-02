// مكتبة الجمل: فاضية حاليًا، والجمل الجديدة هتتضاف هنا.
// الجمل للعرض والتحفيز بس، ومالهاش أي دخل في الحسابات.
// الاختيار بيتغير مع كل تحميل للتطبيق، ومش بيتغير مع إعادة الرسم.

export const OVERALL_BANDS: { min: number; max: number; lines: string[] }[] = [
  { min: 0, max: 20, lines: [] },
  { min: 21, max: 40, lines: [] },
  { min: 41, max: 60, lines: [] },
  { min: 61, max: 80, lines: [] },
  { min: 81, max: 99, lines: [] },
  { min: 100, max: 119, lines: [] },
  { min: 120, max: 150, lines: [] },
  { min: 151, max: Infinity, lines: [] },
];

// جمل المؤشرات: بتتعرض على كارت كل مؤشر لما يكون لسه ما اتقفلش.
export const KPI_LINES: Record<string, string[]> = {
  new_lines: [],
  new_orange_cash: [],
  existing_wallets: [],
  postpaid_lines: [],
  points: [],
  dsl: [],
  quality: [],
};

// جمل الوقت المتبقي من الشهر.
export const TIME_LINES: Record<"start" | "middle" | "last10" | "lastWeek" | "lastDay", string[]> = {
  start: [],
  middle: [],
  last10: [],
  lastWeek: [],
  lastDay: [],
};

export const TREND_LINES = {
  up: [] as string[],
  steady: [] as string[],
  firstSale: [] as string[],
};

export const OVERALL_LINES: string[] = [];

export const LIGHT_LINES: string[] = [];

const lastShownByKey = new Map<string, string>();
const pageChoice = new Map<string, string>();
let lastShown = "";

/** اختيار عشوائي من مجموعة جمل، بيتغير مع كل تحميل للتطبيق، ومش بيكرر الجملة اللي قبلها. */
export function pickPhrase(lines: string[], key: string): string {
  if (lines.length === 0) return "";
  const cacheKey = `${key}|${lines.length}`;
  const cached = pageChoice.get(cacheKey);
  if (cached) return cached;
  let pick = lines[Math.floor(Math.random() * lines.length)];
  if (lines.length > 1 && pick === lastShown) pick = lines[(lines.indexOf(pick) + 1) % lines.length];
  lastShown = pick;
  lastShownByKey.set(key, pick);
  pageChoice.set(cacheKey, pick);
  return pick;
}

export function overallBandLines(overall: number): string[] {
  // الأرقام الكسرية (زي 99.5) لازم تقع في الشريحة الصح، فبنقارن بالحد الأدنى بس.
  let band = OVERALL_BANDS[0];
  for (const b of OVERALL_BANDS) if (overall >= b.min) band = b;
  return band.lines;
}

export function timeLines(remainingDays: number, totalDays: number, elapsedDays: number): string[] {
  if (remainingDays <= 0) return TIME_LINES.lastDay;
  if (remainingDays <= 5) return [...TIME_LINES.lastWeek, ...MONTH_END_LINES];
  if (remainingDays <= 10) return TIME_LINES.last10;
  if (totalDays > 0 && elapsedDays / totalDays < 0.4) return TIME_LINES.start;
  return TIME_LINES.middle;
}

// ===== الدفعة التانية: بداية اليوم، الأداء الضعيف، قرب التارجت، 90%، 100%، صفر، وإضافات المؤشرات =====

export const MORNING_LINES: string[] = [];
export const LOW_LINES: string[] = [];
export const NEAR_LINES: string[] = [];
export const NINETY_LINES: string[] = [];
export const OVER_100_LINES: string[] = [];
export const ZERO_LINES: string[] = [];

export const KPI_EXTRA_LINES: Record<string, string[]> = {};

export const COMPARE_UP_LINES: string[] = [];
export const COMPARE_DOWN_LINES: string[] = [];

export const MONTH_END_LINES: string[] = [];

// جمل المحافظ: مش بتذكر خطوط أبدًا.
const WALLET_KEYS = ["new_orange_cash", "existing_wallets"];
const WALLET_LOW_LINES: string[] = [];
const WALLET_ZERO_LINES: string[] = [];

/** جمل المؤشر حسب نسبته: ضعيف، قرب، 90%+ */
export function kpiLines(kpiKey: string, percent: number): string[] | null {
  const isWallet = WALLET_KEYS.includes(kpiKey);
  if (percent >= 100) return OVER_100_LINES;
  if (percent >= 90) return NINETY_LINES;
  if (percent < 1) return isWallet ? WALLET_ZERO_LINES : ZERO_LINES;
  if (percent < 50) return isWallet ? WALLET_LOW_LINES : LOW_LINES;
  if (percent < 90) {
    const own = [...(KPI_LINES[kpiKey] ?? []), ...(KPI_EXTRA_LINES[kpiKey] ?? [])];
    return own.length ? own : NEAR_LINES;
  }
  return null;
}

// ===== الدفعة التالتة: تشغيل الجمل في الصفحات =====

const DAY = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });

// رسائل بعد تسجيل عملية ناجحة، حسب نوع المؤشر.
export const SALE_CHEERS: Record<string, string[]> = {
  new_lines: [],
  new_orange_cash: [],
  existing_wallets: [],
  points: [],
  postpaid_lines: [],
  dsl: [],
  productivity: [],
};

let lastCheer = "";
/** رسالة تشجيع حسب نوع البيع، بدون تكرار متتابع. */
export function saleCheer(kpiKeys: string[], fallback: string[]): string {
  const pool = kpiKeys.flatMap((k) => SALE_CHEERS[k] ?? []);
  const lines = pool.length ? pool : fallback;
  if (lines.length === 0) return "";
  let pick = lines[Math.floor(Math.random() * lines.length)];
  if (lines.length > 1 && pick === lastCheer) pick = lines[(lines.indexOf(pick) + 1) % lines.length];
  lastCheer = pick;
  return pick;
}

/** جملة الترحيب حسب مستوى الأداء. */
export function welcomeLine(overall: number): string {
  const lines = overall <= 0 ? ZERO_LINES : overallBandLines(overall);
  return pickPhrase(lines, `welcome|${DAY()}`);
}

/** جملة ساخرة لطيفة، بتظهر بس لما الأداء يكون في نطاق مريح (مش ضعيف، ومش مكتمل). */
export const SARCASTIC_EXTRA: string[] = [];
export function sarcasticLine(overall: number): string | null {
  if (overall < 41 || overall >= 100) return null;
  const line = pickPhrase([...LIGHT_LINES, ...SARCASTIC_EXTRA], `sarc|${DAY()}`);
  return line || null;
}

export function overallLine(): string {
  return pickPhrase(OVERALL_LINES, `overallLine|${DAY()}`);
}

/** تنبيه داخلي واحد بس في اليوم لأهم الجمل، مع تذكّر آخر تنبيه اتعرض. */
export type NudgeKind = "milestone" | "lastWeek";
export function nudgeFor(overall: number, remainingDays: number): { kind: NudgeKind; text: string } | null {
  let result: { kind: NudgeKind; text: string } | null = null;
  if (overall >= 90 && overall < 100) result = { kind: "milestone", text: pickPhrase(NINETY_LINES, `nudge|${DAY()}`) };
  else if (overall >= 100) result = { kind: "milestone", text: pickPhrase(OVER_100_LINES, `nudge|${DAY()}`) };
  else if (remainingDays > 0 && remainingDays <= 5) result = { kind: "lastWeek", text: pickPhrase(TIME_LINES.lastWeek, `nudge|${DAY()}`) };
  return result && result.text ? result : null;
}
