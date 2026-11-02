// الإنجازات والشارات: بتتحسب من السجلات والنسب الحالية. مبتأثرش على أي حساب.

export type BadgeEntry = { kpiKey: string; quantity: number; entryDate: string };
export type BadgeKpi = { kpiKey: string; weight: number; target: number; percent: number };

export type BadgeDef = { id: string; title: string; icon: string; hint: string };

export const BADGES: BadgeDef[] = [
  { id: "first_sale", title: "أول عملية بيع", icon: "🎉", hint: "سجّل أول عملية" },
  { id: "ten_lines", title: "أول 10 خطوط", icon: "📱", hint: "سجّل 10 خطوط New Lines" },
  { id: "reach_50", title: "وصلت 50%", icon: "🌱", hint: "وصّل إجمالي 50% في الشهر" },
  { id: "reach_90", title: "وصلت 90%", icon: "🔥", hint: "وصّل إجمالي 90% في الشهر" },
  { id: "reach_100", title: "قفلت التارجت 100%", icon: "🏆", hint: "وصّل إجمالي 100% في الشهر" },
  { id: "reach_120", title: "تخطيت 120%", icon: "👑", hint: "وصّل إجمالي 120% في الشهر" },
  { id: "record_day", title: "رقم قياسي جديد", icon: "⚡", hint: "أعلى يوم في كل السجلات، وفيه أيام قبله" },
  { id: "all_kpis", title: "كل المؤشرات مكتملة", icon: "💎", hint: "كل مؤشر بوزن وصل 100% في الشهر" },
];

/** أعلى يوم في كل السجلات لازم يكون فيه أكتر من يوم عشان يتحسب رقم قياسي */
function isRecordDay(entries: BadgeEntry[], today: string): boolean {
  const byDay = new Map<string, number>();
  for (const e of entries) byDay.set(e.entryDate, (byDay.get(e.entryDate) ?? 0) + e.quantity);
  const todayTotal = byDay.get(today) ?? 0;
  if (todayTotal <= 0) return false;
  const earlier = [...byDay.entries()].filter(([day]) => day < today);
  if (earlier.length === 0) return false;
  return earlier.every(([, total]) => todayTotal > total);
}

export function evaluateBadges(input: {
  entries: BadgeEntry[];
  overall: number;
  kpis: BadgeKpi[];
  today: string;
}): { id: string; earned: boolean }[] {
  const { entries, overall, kpis, today } = input;
  const newLines = entries.filter((e) => e.kpiKey === "new_lines").reduce((sum, e) => sum + e.quantity, 0);
  const weighted = kpis.filter((k) => k.weight > 0 && k.target > 0);
  const results: Record<string, boolean> = {
    first_sale: entries.length > 0,
    ten_lines: newLines >= 10,
    reach_50: overall >= 50,
    reach_90: overall >= 90,
    reach_100: overall >= 100,
    reach_120: overall >= 120,
    record_day: isRecordDay(entries, today),
    all_kpis: weighted.length > 0 && weighted.every((k) => k.percent >= 100),
  };
  return BADGES.map((b) => ({ id: b.id, earned: Boolean(results[b.id]) }));
}

/** بيدمج الشارات المحسوبة مع اللي اتسجلت قبل كده (عشان ما تتكررش ولا تتلغى). */
export function mergeEarnedDates(
  computed: { id: string; earned: boolean }[],
  stored: Record<string, string>,
  today: string,
): { updated: Record<string, string>; items: { id: string; earnedOn: string | null; isNewToday: boolean }[] } {
  const updated: Record<string, string> = { ...stored };
  const items = computed.map((item) => {
    if (item.earned && !updated[item.id]) updated[item.id] = today;
    const earnedOn = updated[item.id] ?? null;
    return { id: item.id, earnedOn, isNewToday: earnedOn === today };
  });
  return { updated, items };
}
