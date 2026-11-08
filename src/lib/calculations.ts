import { KPI_CATALOG, type KpiKey } from "@/lib/constants";
import {
  elapsedWorkingDates,
  remainingWorkingDates,
  workingDatesInMonth,
} from "@/lib/dates";
import type { WorkingDays } from "@/lib/types";

export type KpiSettingInput = {
  kpiKey: KpiKey;
  target: number;
  weight: number;
  unitAr: string;
};

export type AchievedMap = Partial<Record<KpiKey, number>>;

export function sumWeights(kpis: KpiSettingInput[]): number {
  return kpis.reduce((sum, kpi) => sum + kpi.weight, 0);
}

export function achievementPercent(achieved: number, target: number): number {
  if (target <= 0) return 0;
  return (achieved / target) * 100;
}

export function kpiContribution(achieved: number, target: number, weight: number): number {
  if (weight === 0) return 0;
  if (target <= 0) return 0;
  return (achieved / target) * weight;
}

export function estimatedCommission(fullCommission: number, overallPercent: number): number {
  // الكوميشن بيزيد مع الإنجاز لحد 200% بس، من غير ما يحتاج اختيار.
  const ratio = overallPercent / 100;
  const used = Math.min(Math.max(ratio, 0), 2);
  return Math.round(fullCommission * used);
}

export function expectedToDate(target: number, elapsed: number, total: number): number {
  if (total <= 0) return 0;
  return target * (elapsed / total);
}

export type NewLinesPace = {
  remaining: number;
  remainingDays: number;
  perDay: number | null;
  message: string;
};

export function linesWord(n: number): string {
  if (n === 1) return "خط";
  if (n === 2) return "خطين";
  if (n >= 3 && n <= 10) return "خطوط";
  return "خط";
}

export function newLinesDailyNeed(
  target: number,
  achieved: number,
  remainingDays: number,
): NewLinesPace {
  const remaining = Math.max(0, target - achieved);
  if (remaining <= 0) {
    return {
      remaining: 0,
      remainingDays,
      perDay: 0,
      message: "🏆 تارجت New Lines اتقفل! أي خط زيادة دلوقتي بونص.",
    };
  }
  if (remainingDays <= 0) {
    return {
      remaining,
      remainingDays: 0,
      perDay: null,
      message: "⏰ أيام الشغل خلصت ولسه فيه فاضل على تارجت New Lines.",
    };
  }
  const perDay = remaining / remainingDays;
  return {
    remaining,
    remainingDays,
    perDay,
    message: `📱 محتاج تقريبًا ${formatQty(Math.ceil(perDay))} ${linesWord(Math.ceil(perDay))} في اليوم عشان تلحق التارجت.`,
  };
}

export function formatQty(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatPercent(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
}

export function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function catalogByKey(key: string) {
  return KPI_CATALOG.find((item) => item.key === key);
}

export function buildWorkdayStats(
  yearMonth: string,
  workingDays: WorkingDays,
  holidays: string[],
  todayISO: string,
) {
  const totalDates = workingDatesInMonth(yearMonth, workingDays, holidays);
  const elapsedDates = elapsedWorkingDates(yearMonth, workingDays, holidays, todayISO);
  const remainingDates = remainingWorkingDates(yearMonth, workingDays, holidays, todayISO);
  return {
    total: totalDates.length,
    elapsed: elapsedDates.length,
    // الأيام اللي عدّت قبل النهارده بس (النهارده مش محسوب في المقارنة اليومية للتراك).
    elapsedBeforeToday: elapsedDates.filter((iso) => iso < todayISO).length,
    remaining: remainingDates.length,
    totalDates,
    elapsedDates,
    remainingDates,
  };
}

// قواعد حساب الكوميشن من نظام الشركة (موظف الفرع):
// - كل مؤشر له وزن وتارجت لازم يوصل 90% عشان يتحسب في التوتال، والزيادة فوق 100% بتتحسب عادي.
// - New Orange Cash وزنه صفر، لكنه شرط مستقل: عدد المحافظ الجديدة لا يقل عن 90% من عدد New Lines.
// - المؤشرات الفردية بلا سقف، بينما الإجمالي الشهري فقط سقفه 200%.
// - لو التوتال النهائي أقل من 80% مفيش حافز.
// - لا يوجد خصم إضافي للـ Postpaid أو DSL.
export const KPI_MIN_PERCENT = 90;
export const OVERALL_MIN_PERCENT = 80;
/** سقف الإجمالي الشهري بس (200%). المؤشرات الفردية ماليهاش سقف. */
export const OVERALL_MAX_PERCENT = 200;
export const NEW_WALLET_TO_LINES_MIN_RATIO = 0.9;

export type RulesKpi = KpiSettingInput & { achieved: number };

export function applyCompanyRules(kpis: RulesKpi[]) {
  const counted: { kpiKey: KpiKey; contribution: number; percent: number; gated: boolean }[] = kpis.map((kpi) => {
    const percent = achievementPercent(kpi.achieved, kpi.target);
    const eligible = kpi.weight > 0 && kpi.target > 0;
    const gated = eligible && percent < KPI_MIN_PERCENT;
    const contribution = eligible && !gated ? kpiContribution(kpi.achieved, kpi.target, kpi.weight) : 0;
    return { kpiKey: kpi.kpiKey, contribution, percent, gated };
  });

  const newLines = kpis.find((kpi) => kpi.kpiKey === "new_lines");
  const newWallets = kpis.find((kpi) => kpi.kpiKey === "new_orange_cash");
  const walletDone = Boolean(
    newLines &&
      newWallets &&
      newLines.target > 0 &&
      newWallets.target > 0 &&
      newWallets.achieved >= newLines.achieved * NEW_WALLET_TO_LINES_MIN_RATIO,
  );

  const rawTotal = counted.reduce((sum, row) => sum + row.contribution, 0);
  const total = Math.min(OVERALL_MAX_PERCENT, Math.max(0, rawTotal));
  const belowKpis = counted.filter((row) => row.gated).map((row) => row.kpiKey);
  const belowOverall = total < OVERALL_MIN_PERCENT;
  const commissionEligible = !belowOverall && walletDone;
  return { counted, total, rawTotal, belowKpis, clawBacks: [] as string[], belowOverall, walletDone, commissionEligible };
}
