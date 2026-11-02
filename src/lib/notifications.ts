// مركز الإشعارات الداخلي: مفيش push، وكل إشعار بيتعرض مرة واحدة بس، وبحد أقصى كام إشعار في اليوم.

export type AppNotification = { id: string; day: string; type: string; text: string; read: boolean };

export const MAX_PER_DAY = 3;
export const MAX_KEPT = 40;

export function buildCandidates(input: {
  day: string;
  overall: number;
  remainingDays: number;
  lagging: { nameEn: string; percent: number }[];
  newBadges: string[];
  challenge: { title: string; done: boolean } | null;
}): { id: string; type: string; text: string }[] {
  const { day, overall, remainingDays, lagging, newBadges, challenge } = input;
  const out: { id: string; type: string; text: string }[] = [];
  for (const title of newBadges) out.push({ id: `badge|${title}`, type: "achievement", text: `🏅 كسبت شارة: ${title}` });
  if (overall >= 100) out.push({ id: `target|100|${day}`, type: "target", text: "🏆 قفلت التارجت! برافو عليك" });
  else if (overall >= 90) out.push({ id: `target|90|${day}`, type: "target", text: "🔥 وصلت 90%، فاضل خطوة صغيرة" });
  if (remainingDays > 0 && remainingDays <= 5) out.push({ id: `month|lastweek|${day}`, type: "month", text: `⏳ فاضل ${remainingDays} أيام شغل بس في الشهر` });
  if (lagging.length) {
    const worst = [...lagging].sort((a, b) => a.percent - b.percent)[0];
    out.push({ id: `lag|${worst.nameEn}|${day}`, type: "lag", text: `⚠️ ${worst.nameEn} محتاج تركيز (${Math.round(worst.percent)}%)` });
  }
  if (challenge?.done) out.push({ id: `challenge|${day}`, type: "challenge", text: `✅ خلصت تحدي اليوم: ${challenge.title}` });
  return out;
}

/** بيدمج الإشعارات الجديدة مع القديمة: مايكررش، وبيحترم حد اليوم، وبيحتفظ بآخر MAX_KEPT. */
export function mergeNotifications(stored: AppNotification[], candidates: { id: string; type: string; text: string }[], day: string): AppNotification[] {
  const ids = new Set(stored.map((n) => n.id));
  const todayCount = stored.filter((n) => n.day === day).length;
  let added = 0;
  const next = [...stored];
  for (const c of candidates) {
    if (ids.has(c.id)) continue;
    if (todayCount + added >= MAX_PER_DAY) break;
    next.push({ id: c.id, day, type: c.type, text: c.text, read: false });
    ids.add(c.id);
    added += 1;
  }
  return next.slice(-MAX_KEPT);
}
