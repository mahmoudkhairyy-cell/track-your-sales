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

export function computeOverall(kpis: KpiSettingInput[], achieved: AchievedMap): number {
  return kpis.reduce((sum, kpi) => {
    const value = achieved[kpi.kpiKey] ?? 0;
    return sum + kpiContribution(value, kpi.target, kpi.weight);
  }, 0);
}

export function estimatedCommission(
  fullCommission: number,
  overallPercent: number,
  allowOver100: boolean,
): number {
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
    message: `📱 محتاج تقريبًا ${formatQty(perDay)} خط New Lines في اليوم عشان تلحق التارجت.`,
  };
}

export function formatQty(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toLocaleString("ar-EG", { maximumFractionDigits: 0 });
}

export function formatPercent(value: number): string {
  return value.toLocaleString("ar-EG", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
}

export function formatMoney(value: number): string {
  return value.toLocaleString("ar-EG", { maximumFractionDigits: 0 });
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
    remaining: remainingDates.length,
    totalDates,
    elapsedDates,
    remainingDates,
  };
}

// قواعد حساب الكوميشن من نظام الشركة (موظف الفرع):
// - كل مؤشر (ليه تارجت ووزن) لازم يوصل 90% عشان يتحسب في التوتال، والزيادة فوق 100% بتتحسب عادي.
// - المؤشر اللي تحت 90% بيتشال من التوتال.
// - لو التوتال النهائي أقل من 80% مفيش حافز.
// - Postpaid أو DSL لو ما وصلوش 100%: وزنهم (10%) بيتشال + خصم 5 نقاط زيادة، يعني 15 نقطة.
export const KPI_MIN_PERCENT = 90;
export const OVERALL_MIN_PERCENT = 80;
export const CLAW_BACK_POINTS = 5;
export const CLAW_BACK_KEYS = ["postpaid_lines", "dsl"] as const;

export type RulesKpi = KpiSettingInput & { achieved: number };

export function applyCompanyRules(kpis: RulesKpi[]) {
  // كل مؤشر لازم يوصل 90% عشان يتحسب، ومفيش خصم للـ Postpaid أو DSL، ومفيش ربط للـ New Lines بالمحافظ.
  const counted: { kpiKey: KpiKey; contribution: number; percent: number; gated: boolean }[] = kpis.map((kpi) => {
    const percent = achievementPercent(kpi.achieved, kpi.target);
    const eligible = kpi.weight > 0 && kpi.target > 0;
    const gated = eligible && percent < KPI_MIN_PERCENT;
    const contribution = eligible && !gated ? kpiContribution(kpi.achieved, kpi.target, kpi.weight) : 0;
    return { kpiKey: kpi.kpiKey, contribution, percent, gated };
  });

  const rawTotal = counted.reduce((sum, row) => sum + row.contribution, 0);
  const total = Math.max(0, rawTotal);
  const belowKpis = counted.filter((row) => row.gated).map((row) => row.kpiKey);
  const belowOverall = total < OVERALL_MIN_PERCENT;
  return { counted, total, rawTotal, belowKpis, clawBacks: [] as string[], belowOverall, walletDone: true };
}
