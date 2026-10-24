import { KPI_CATALOG, type KpiKey } from "@/lib/constants";
import {
  elapsedWorkingDates,
  remainingWorkingDates,
  workingDatesInMonth,
} from "@/lib/dates";
import type { WorkingDays } from "@/db/schema";

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
  const ratio = overallPercent / 100;
  const used = allowOver100 ? ratio : Math.min(Math.max(ratio, 0), 1);
  return fullCommission * used;
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
  return value.toLocaleString("ar-EG", { maximumFractionDigits: 2 });
}

export function formatPercent(value: number): string {
  return value.toLocaleString("ar-EG", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
}

export function formatMoney(value: number): string {
  return value.toLocaleString("ar-EG", { maximumFractionDigits: 2 });
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
