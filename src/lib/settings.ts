import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { holidays, kpiSettings, monthSettings, type WorkingDays } from "@/db/schema";
import { DEFAULT_COMMISSION, DEFAULT_WORKING_DAYS, KPI_CATALOG, type KpiKey } from "@/lib/constants";

export type MonthBundle = {
  saved: boolean;
  yearMonth: string;
  fullCommission: number;
  allowCommissionOver100: boolean;
  workingDays: WorkingDays;
  kpis: {
    kpiKey: KpiKey;
    target: number;
    weight: number;
    unitAr: string;
    sortOrder: number;
  }[];
  holidays: { id?: string; date: string; note: string | null }[];
  monthSettingsId: string | null;
};

export function defaultMonthBundle(yearMonth: string): MonthBundle {
  return {
    saved: false,
    yearMonth,
    fullCommission: DEFAULT_COMMISSION,
    allowCommissionOver100: false,
    workingDays: { ...DEFAULT_WORKING_DAYS },
    kpis: KPI_CATALOG.map((kpi, index) => ({
      kpiKey: kpi.key,
      target: kpi.defaultTarget,
      weight: kpi.defaultWeight,
      unitAr: kpi.unitAr,
      sortOrder: index,
    })),
    holidays: [],
    monthSettingsId: null,
  };
}

export async function loadMonthBundle(userId: string, yearMonth: string): Promise<MonthBundle> {
  const rows = await db
    .select()
    .from(monthSettings)
    .where(and(eq(monthSettings.userId, userId), eq(monthSettings.yearMonth, yearMonth)))
    .limit(1);
  const row = rows[0];
  if (!row) return defaultMonthBundle(yearMonth);

  const [kpiRows, holidayRows] = await Promise.all([
    db.select().from(kpiSettings).where(eq(kpiSettings.monthSettingsId, row.id)),
    db.select().from(holidays).where(eq(holidays.monthSettingsId, row.id)),
  ]);

  const kpiMap = new Map(kpiRows.map((item) => [item.kpiKey, item]));
  const kpis = KPI_CATALOG.map((kpi, index) => {
    const saved = kpiMap.get(kpi.key);
    return {
      kpiKey: kpi.key,
      target: saved?.target ?? kpi.defaultTarget,
      weight: saved?.weight ?? kpi.defaultWeight,
      unitAr: saved?.unitAr ?? kpi.unitAr,
      sortOrder: saved?.sortOrder ?? index,
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    saved: true,
    yearMonth,
    fullCommission: row.fullCommission,
    allowCommissionOver100: row.allowCommissionOver100,
    workingDays: row.workingDays,
    kpis,
    holidays: holidayRows
      .map((item) => ({ id: item.id, date: item.date, note: item.note }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    monthSettingsId: row.id,
  };
}
