// تحليلات محلية محسوبة من بيانات التطبيق الموجودة فقط. مش بتغيّر أي حساب في calculations.ts.

export type InsightKpi = {
  kpiKey: string;
  nameEn: string;
  weight: number;
  target: number;
  achieved: number;
  percent: number;
  remaining: number;
};

export type Insight = { label: string; value: string; tone: "good" | "warn" | "neutral" };

// ملاحظات ذكية: أقوى مؤشر، أضعف مؤشر، الأقرب للإكمال، والأهم في الباقي.
export function buildInsights(kpis: InsightKpi[]): Insight[] {
  const active = kpis.filter((k) => k.weight > 0 && k.target > 0);
  if (active.length === 0) return [];
  const byPercent = [...active].sort((a, b) => b.percent - a.percent);
  const strongest = byPercent[0];
  const weakest = byPercent[byPercent.length - 1];
  const notDone = active.filter((k) => k.percent < 100 && k.remaining > 0);
  const closest = [...notDone].sort((a, b) => b.percent - a.percent)[0];
  const biggestGap = [...notDone].sort((a, b) => b.weight * (100 - b.percent) - a.weight * (100 - a.percent))[0];
  const out: Insight[] = [];
  out.push({ label: "أقوى مؤشر", value: `${strongest.nameEn} · ${Math.round(strongest.percent)}%`, tone: "good" });
  if (weakest.kpiKey !== strongest.kpiKey) {
    out.push({ label: "أضعف مؤشر", value: `${weakest.nameEn} · ${Math.round(weakest.percent)}%`, tone: "warn" });
  }
  if (closest) out.push({ label: "الأقرب للإكمال", value: `${closest.nameEn} · فاضل ${Math.ceil(closest.remaining)}`, tone: "neutral" });
  if (biggestGap) out.push({ label: "أكبر فجوة في الوزن", value: biggestGap.nameEn, tone: "warn" });
  return out;
}

// توقع نهاية الشهر: تقدير خطي من متوسط الإنجاز لكل يوم شغل عدّى.
// ملاحظة: بيعتمد على أيام الشغل من الإعدادات، ومش بيغيّر أي حساب فعلي.
export function buildForecast(overall: number, elapsedWorkDays: number, totalWorkDays: number) {
  if (elapsedWorkDays <= 0 || totalWorkDays <= 0) return null;
  const perDay = overall / elapsedWorkDays;
  const estimate = Math.min(999, perDay * totalWorkDays);
  return {
    perDay,
    estimate,
    elapsed: elapsedWorkDays,
    remaining: Math.max(0, totalWorkDays - elapsedWorkDays),
    onPace: estimate >= 100,
  };
}

// أوسمة محسوبة من الحالة الحالية بس. مفيش تاريخ مكتوب لأن التطبيق مش بيخزن تواريخ الإنجاز بالضبط.
export type Badge = { id: string; title: string; unlocked: boolean };

export function buildBadges(overall: number, entriesCount: number): Badge[] {
  return [
    { id: "first", title: "أول بيعة", unlocked: entriesCount > 0 },
    { id: "p25", title: "25% من التارجت", unlocked: overall >= 25 },
    { id: "p50", title: "50% من التارجت", unlocked: overall >= 50 },
    { id: "p75", title: "75% من التارجت", unlocked: overall >= 75 },
    { id: "p100", title: "قفلت التارجت 100%", unlocked: overall >= 100 },
  ];
}
