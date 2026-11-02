// سجل الأداء اليومي: بيتحسب من السجلات نفسها (مفيش تخزين جديد، فمفيش احتساب مكرر).

export type DailyEntry = { id: string; kpiKey: string; quantity: number; entryDate: string };

export type DayRow = { date: string; operations: number; byKpi: Record<string, number> };

export type DailyLog = {
  days: DayRow[];
  today: { date: string; operations: number; yesterdayOperations: number; diff: number };
  cumulative: { date: string; total: number }[];
  best: DayRow | null;
  worst: DayRow | null;
  weekdayAverages: { weekday: number; average: number; days: number }[];
  byKpiTotals: Record<string, number>;
};

/** اليوم كرقم أسبوع: 0 = الأحد */
export function weekdayOf(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

export function buildDailyLog(entries: DailyEntry[], yearMonth: string, today: string): DailyLog {
  // بنعد كل سجل مرة واحدة بالـ id، فمفيش احتساب مكرر
  const seen = new Set<string>();
  const monthEntries = entries.filter((e) => {
    if (!e.entryDate.startsWith(`${yearMonth}-`)) return false;
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  const byDate = new Map<string, DayRow>();
  for (const e of monthEntries) {
    const row = byDate.get(e.entryDate) ?? { date: e.entryDate, operations: 0, byKpi: {} };
    row.operations += 1;
    row.byKpi[e.kpiKey] = (row.byKpi[e.kpiKey] ?? 0) + e.quantity;
    byDate.set(e.entryDate, row);
  }
  const days = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));

  const operationsOn = (iso: string) => byDate.get(iso)?.operations ?? 0;
  const yesterdayIso = (() => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  let running = 0;
  const cumulative = days.map((d) => {
    running += d.operations;
    return { date: d.date, total: running };
  });

  const active = days.filter((d) => d.operations > 0);
  const best = active.length ? active.reduce((a, b) => (b.operations > a.operations ? b : a)) : null;
  const worst = active.length ? active.reduce((a, b) => (b.operations < a.operations ? b : a)) : null;

  const weekdayAverages = [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
    const matching = active.filter((d) => weekdayOf(d.date) === weekday);
    const total = matching.reduce((sum, d) => sum + d.operations, 0);
    return { weekday, average: matching.length ? Math.round((total / matching.length) * 10) / 10 : 0, days: matching.length };
  });

  const byKpiTotals: Record<string, number> = {};
  for (const e of monthEntries) byKpiTotals[e.kpiKey] = (byKpiTotals[e.kpiKey] ?? 0) + e.quantity;

  const todayOps = operationsOn(today);
  const yesterdayOps = operationsOn(yesterdayIso);
  return {
    days,
    today: { date: today, operations: todayOps, yesterdayOperations: yesterdayOps, diff: todayOps - yesterdayOps },
    cumulative,
    best,
    worst,
    weekdayAverages,
    byKpiTotals,
  };
}
