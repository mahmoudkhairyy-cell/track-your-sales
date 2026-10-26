import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { entries } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import {
  achievementPercent,
  buildWorkdayStats,
  computeOverall,
  estimatedCommission,
  expectedToDate,
  formatPercent,
  kpiContribution,
  newLinesDailyNeed,
  sumWeights,
} from "@/lib/calculations";
import { KPI_CATALOG, YEAR_MONTH_RE, type KpiKey } from "@/lib/constants";
import { cairoISODate, cairoYearMonth, monthDateRange, monthLabelAr } from "@/lib/dates";
import { handleRouteError, jsonOk, HttpError } from "@/lib/http";
import { loadMonthBundle } from "@/lib/settings";

export const dynamic = "force-dynamic";

function parseMonth(value: string | null): string {
  if (!value) return cairoYearMonth();
  if (!YEAR_MONTH_RE.test(value)) {
    throw new HttpError(400, "الشهر اللي اخترته مش صح");
  }
  return value;
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const yearMonth = parseMonth(url.searchParams.get("month"));
    const today = cairoISODate();
    const bundle = await loadMonthBundle(user.id, yearMonth);
    const { start, end } = monthDateRange(yearMonth);

    const monthEntries = await db
      .select()
      .from(entries)
      .where(and(eq(entries.userId, user.id), gte(entries.entryDate, start), lte(entries.entryDate, end)))
      .orderBy(desc(entries.entryDate), desc(entries.createdAt));

    const achieved = {} as Record<KpiKey, number>;
    for (const kpi of KPI_CATALOG) achieved[kpi.key] = 0;
    // Quality is a percentage: sum would overstate it, so average its entries instead.
    const qualityValues: number[] = [];
    for (const entry of monthEntries) {
      const key = entry.kpiKey as KpiKey;
      if (key === "quality") {
        qualityValues.push(entry.quantity);
        continue;
      }
      if (achieved[key] === undefined) achieved[key] = 0;
      achieved[key] += entry.quantity;
    }
    achieved.quality = qualityValues.length
      ? qualityValues.reduce((sum, value) => sum + value, 0) / qualityValues.length
      : 0;

    const holidays = bundle.holidays.map((item) => item.date);
    const work = buildWorkdayStats(yearMonth, bundle.workingDays, holidays, today);
    const overall = computeOverall(bundle.kpis, achieved);
    const commission = estimatedCommission(
      bundle.fullCommission,
      overall,
      bundle.allowCommissionOver100,
    );
    const weightSum = sumWeights(bundle.kpis);
    const newLines = bundle.kpis.find((kpi) => kpi.kpiKey === "new_lines");
    const pace = newLinesDailyNeed(
      newLines?.target ?? 175,
      achieved.new_lines ?? 0,
      work.remaining,
    );

    const todayEntries = monthEntries.filter((entry) => entry.entryDate === today);
    const todaySummary = KPI_CATALOG.map((kpi) => ({
      kpiKey: kpi.key,
      nameEn: kpi.nameEn,
      nameAr: kpi.nameAr,
      unitAr: kpi.unitAr,
      quantity: todayEntries
        .filter((entry) => entry.kpiKey === kpi.key)
        .reduce((sum, entry) => sum + entry.quantity, 0),
      count: todayEntries.filter((entry) => entry.kpiKey === kpi.key).length,
    }));

    const kpis = bundle.kpis.map((kpi) => {
      const catalog = KPI_CATALOG.find((item) => item.key === kpi.kpiKey)!;
      const value = achieved[kpi.kpiKey] ?? 0;
      const pct = achievementPercent(value, kpi.target);
      const contribution = kpiContribution(value, kpi.target, kpi.weight);
      const expected = expectedToDate(kpi.target, work.elapsed, work.total);
      return {
        ...kpi,
        nameEn: catalog.nameEn,
        nameAr: catalog.nameAr,
        achieved: value,
        percent: pct,
        contribution,
        expectedToDate: expected,
        remaining: Math.max(0, kpi.target - value),
        overTarget: value > kpi.target,
      };
    });

    return jsonOk({
      profile: { name: user.name, branch: user.branch, role: user.role },
      yearMonth,
      monthLabel: monthLabelAr(yearMonth),
      today,
      settingsSaved: bundle.saved,
      fullCommission: bundle.fullCommission,
      allowCommissionOver100: bundle.allowCommissionOver100,
      workingDays: bundle.workingDays,
      holidays: bundle.holidays,
      work,
      kpis,
      overall,
      overallLabel: formatPercent(overall),
      estimatedCommission: commission,
      weightSum,
      weightWarning: Math.abs(weightSum - 100) > 0.01,
      pace,
      todaySummary,
      entriesCount: monthEntries.length,
      empty: monthEntries.length === 0,
      hasAnySavedData: bundle.saved || monthEntries.length > 0,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
