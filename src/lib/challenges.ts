// تحدي اليوم: اختياري وتحفيزي بس. مابيأثرش على التارجت ولا العمولة.

export type ChallengeEntry = { kpiKey: string; quantity: number; entryDate: string };

export type DailyChallenge = {
  id: string;
  title: string;
  target: number;
  progress: number;
  done: boolean;
  note: string;
};

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

export function buildDailyChallenge(input: {
  today: string;
  entries: ChallengeEntry[];
  weakestKpiKey: string | null;
}): DailyChallenge {
  const { today, entries, weakestKpiKey } = input;
  const todays = entries.filter((e) => e.entryDate === today);
  const sumOf = (key: string) => todays.filter((e) => e.kpiKey === key).reduce((s, e) => s + e.quantity, 0);

  const pool: { id: string; title: string; target: number; progress: number; note: string }[] = [
    { id: "lines3", title: "بيع 3 خطوط New Lines النهارده", target: 3, progress: sumOf("new_lines"), note: "كل خط بيفرق في التارجت" },
    { id: "ops5", title: "سجّل 5 عمليات النهارده", target: 5, progress: todays.length, note: "عدد العمليات المسجلة في يوم واحد" },
    { id: "points10", title: "اجمع 10 نقاط النهارده", target: 10, progress: sumOf("points"), note: "النقاط بتتجمع مع بعض" },
  ];
  if (weakestKpiKey) {
    pool.push({
      id: "weakest1",
      title: "حسّن أضعف مؤشر عندك: سجّل عملية واحدة فيه",
      target: 1,
      progress: todays.filter((e) => e.kpiKey === weakestKpiKey).length,
      note: "بيساعدك تقوّي المؤشر اللي محتاج تركيز",
    });
  }

  // اختيار ثابت طول اليوم
  const pick = pool[hash(today) % pool.length];
  const progress = Math.min(pick.progress, pick.target);
  return { id: pick.id, title: pick.title, target: pick.target, progress, done: pick.progress >= pick.target, note: `${pick.note}. اختياري ومايأثرش على التارجت أو العمولة.` };
}
