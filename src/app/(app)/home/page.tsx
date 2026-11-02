"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Banner, Spinner } from "@/components/ui";
import { ApiError, api } from "@/lib/client";
import { formatMoney, formatPercent, formatQty } from "@/lib/calculations";
import { cairoISODate } from "@/lib/dates";
import { buildCandidates as buildNotificationCandidates, mergeNotifications as mergeNotificationList } from "@/lib/notifications";
import { useMonth } from "@/components/AppShell";
import { KpiIcon } from "@/components/KpiIcon";
import { kpiMood } from "@/lib/motivation";
import { MORNING_LINES, kpiLines, nudgeFor, overallBandLines, overallLine, pickPhrase, sarcasticLine, timeLines, welcomeLine } from "@/lib/phrases";
import { readSyncStatus, type SyncStatus } from "@/lib/sync";

type KpiRow = {
  kpiKey: string;
  nameEn: string;
  unitAr: string;
  target: number;
  weight: number;
  achieved: number;
  percent: number;
  contribution: number;
  expectedToDate: number;
  remaining: number;
  overTarget: boolean;
};

type AssistantKpiView = {
  kpiKey: string;
  nameEn: string;
  weight: number;
  achieved: number;
  target: number;
  percent: number;
  remaining: number;
  needPerDayTo90: number | null;
  needPerDayTo100: number | null;
  status: "done" | "ahead" | "behind" | "no-target";
  averagePerDay: number | null;
  reach90On: string | null;
  reach100On: string | null;
  projectedPercent: number | null;
  gapToExpected: number;
  note: string | null;
};

type AssistantView = {
  enoughData: boolean;
  dataMessage: string | null;
  overall: { percent: number; expectedPercent: number; status: "ahead" | "on" | "behind" | "done" | "no-days"; gapPoints: number };
  kpis: AssistantKpiView[];
  recommendations: string[];
};

type AnalysisView = {
  hasData: boolean;
  strongest: { kpiKey: string; nameEn: string; percent: number } | null;
  weakest: { kpiKey: string; nameEn: string; percent: number } | null;
  ranking: { kpiKey: string; nameEn: string; percent: number }[];
  needsIntervention: { kpiKey: string; nameEn: string; percent: number }[];
  overallText: string;
};

type BadgeView = { id: string; earned: boolean };

type CommissionView = {
  hasFullCommission: boolean;
  message: string | null;
  current: { overall: number; commission: number; belowMinimum: boolean };
  scenarios: { label: string; overall: number; commission: number }[];
  perOnePercent: number;
};

type DailyLogView = {
  days: { date: string; operations: number; byKpi: Record<string, number> }[];
  today: { date: string; operations: number; yesterdayOperations: number; diff: number };
  best: { date: string; operations: number } | null;
  worst: { date: string; operations: number } | null;
  weekdayAverages: { weekday: number; average: number; days: number }[];
  byKpiTotals: Record<string, number>;
};

const WEEKDAY_AR = ["الأحد", "الاتنين", "التلات", "الأربعاء", "الخميس", "الجمعة", "السبت"];

type ChallengeView = { id: string; title: string; target: number; progress: number; done: boolean; note: string };

type Dashboard = {
  challenge: ChallengeView;
  dailyLog: DailyLogView;
  badges: BadgeView[];
  commissionScenarios: CommissionView;
  assistant: AssistantView;
  analysis: AnalysisView;
  profile: { name: string; branch: string };
  yearMonth: string;
  monthLabel: string;
  todaySummary: { kpiKey: string; quantity: number; count: number }[];
  settingsSaved: boolean;
  kpis: KpiRow[];
  overall: number;
  estimatedCommission: number;
  rules: { belowKpis: string[]; clawBacks: string[]; belowOverall: boolean; walletDone: boolean };
  fullCommission: number;
  weightSum: number;
  weightWarning: boolean;
  empty: boolean;
  entriesCount: number;
  work: { total: number; elapsed: number; remaining: number };
  pace: { remaining: number; remainingDays: number; perDay: number | null; message: string };
};


function formatAssistDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Cairo" }).format(new Date(`${iso}T12:00:00+02:00`));
}

const OVERALL_STATUS_TEXT: Record<AssistantView["overall"]["status"], string> = {
  done: "خلصت التارجت، والمساعد بيراقب بس.",
  ahead: "إنت متقدم على المعدل المطلوب 👏",
  on: "إنت ماشي على المعدل المطلوب.",
  behind: "إنت متأخر عن المعدل المطلوب شوية، زوّد إيقاعك.",
  "no-days": "أيام الشغل خلصت.",
};

function AnalysisBlock({ analysis }: { analysis: AnalysisView }) {
  if (!analysis.hasData) return null;
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-orange-200/70">
      <p className="font-black">📊 تحليل الأداء</p>
      <p className="mt-1 text-xs leading-6 text-neutral-600">{analysis.overallText}</p>
      {analysis.strongest ? <p className="mt-1 text-xs">💪 أقوى مؤشر: <span className="font-black" dir="ltr">{analysis.strongest.nameEn}</span> ({formatPercent(analysis.strongest.percent)}%)</p> : null}
      {analysis.weakest ? <p className="text-xs">🎯 أضعف مؤشر: <span className="font-black" dir="ltr">{analysis.weakest.nameEn}</span> ({formatPercent(analysis.weakest.percent)}%)</p> : null}
      {analysis.needsIntervention.length ? (
        <p className="mt-1 text-xs text-red-700">محتاجين تدخل في: {analysis.needsIntervention.map((k) => k.nameEn).join("، ")}</p>
      ) : null}
      <div className="mt-2 space-y-1">
        {analysis.ranking.map((k, i) => (
          <div key={k.kpiKey} className="flex items-center justify-between text-xs">
            <span dir="ltr">{i + 1}. {k.nameEn}</span>
            <span className="font-black text-[#e06600]">{formatPercent(k.percent)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssistantCard({ assistant, analysis }: { assistant: AssistantView; analysis: AnalysisView }) {
  return (
    <div className="rounded-[20px] bg-orange-50/40 p-4 ring-1 ring-orange-100">
      <h2 className="text-base font-black">🧭 مساعد التارجت</h2>
      <div className="mt-3 space-y-3 text-sm">
        {assistant.dataMessage ? <p className="rounded-2xl bg-orange-50 px-3 py-2 font-bold text-[#8f4300]">{assistant.dataMessage}</p> : null}
        <p className="font-extrabold">{OVERALL_STATUS_TEXT[assistant.overall.status]}</p>
        <p className="text-xs text-neutral-500">
          المفروض تكون عند {formatPercent(assistant.overall.expectedPercent)}% لحد النهارده · فرقك {assistant.overall.gapPoints >= 0 ? "+" : ""}
          {formatPercent(assistant.overall.gapPoints)} نقطة
        </p>
        <div className="space-y-2">
          {assistant.kpis.map((kpi) => (
            <div key={kpi.kpiKey} className="rounded-2xl bg-orange-50/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-extrabold" dir="ltr">{kpi.nameEn}</p>
                <p className="text-xs font-bold text-[#e06600]">{formatPercent(kpi.percent)}%</p>
              </div>
              {kpi.status === "no-target" || kpi.note ? (
                <p className="mt-1 text-xs text-neutral-500">{kpi.note ?? "من غير تارجت."}</p>
              ) : (
                <div className="mt-1 grid grid-cols-2 gap-1 text-xs leading-5 text-neutral-600">
                  <p>فاضل: <span className="font-black">{formatQty(kpi.remaining)}</span></p>
                  <p>{kpi.status === "ahead" ? "متقدم" : kpi.status === "done" ? "اتقفل ✅" : "متأخر"} {kpi.status === "done" ? "" : `عن المعدل بـ ${formatQty(Math.abs(kpi.gapToExpected))}`}</p>
                  {kpi.needPerDayTo90 !== null ? <p>لـ 90%: <span className="font-black">{formatQty(kpi.needPerDayTo90)}</span> في اليوم</p> : null}
                  {kpi.needPerDayTo100 !== null ? <p>لـ 100%: <span className="font-black">{formatQty(kpi.needPerDayTo100)}</span> في اليوم</p> : null}
                  {kpi.reach90On ? <p className="col-span-2">بالمعدل ده توصل 90% يوم {formatAssistDate(kpi.reach90On)}</p> : null}
                  {kpi.projectedPercent !== null ? <p className="col-span-2">متوقع تقفل الشهر على {formatPercent(kpi.projectedPercent)}%</p> : null}
                </div>
              )}
            </div>
          ))}
        </div>
        <AnalysisBlock analysis={analysis} />
        {assistant.recommendations.length ? (
          <div>
            <p className="font-black">توصيات:</p>
            <ul className="mt-1 space-y-1 text-xs leading-6">
              {assistant.recommendations.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const BADGE_META: Record<string, { title: string; icon: string; hint: string }> = {
  first_sale: { title: "أول عملية بيع", icon: "🎉", hint: "سجّل أول عملية" },
  ten_lines: { title: "أول 10 خطوط", icon: "📱", hint: "سجّل 10 خطوط New Lines" },
  reach_50: { title: "وصلت 50%", icon: "🌱", hint: "وصّل إجمالي 50% في الشهر" },
  reach_90: { title: "وصلت 90%", icon: "🔥", hint: "وصّل إجمالي 90% في الشهر" },
  reach_100: { title: "قفلت التارجت 100%", icon: "🏆", hint: "وصّل إجمالي 100% في الشهر" },
  reach_120: { title: "تخطيت 120%", icon: "👑", hint: "وصّل إجمالي 120% في الشهر" },
  record_day: { title: "رقم قياسي جديد", icon: "⚡", hint: "أعلى يوم في كل السجلات" },
  all_kpis: { title: "كل المؤشرات مكتملة", icon: "💎", hint: "كل مؤشر بوزن وصل 100%" },
};
const BADGES_STORE_KEY = "tys.badges.v1";

/** الشارات: بتتحسب من السجلات، وتاريخ أول مرة اتكسبت بيتحفظ عشان ما تتكررش. */
function ChallengeCard({ challenge }: { challenge: ChallengeView }) {
  const pct = Math.min(100, Math.round((challenge.progress / challenge.target) * 100));
  return (
    <section className="rounded-[24px] bg-white p-4 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)] ring-1 ring-orange-200/70">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-black">🎯 تحدي اليوم</h2>
        {challenge.done ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-800">خلصته ✅</span> : null}
      </div>
      <p className="mt-2 text-sm font-extrabold">{challenge.title}</p>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-orange-100">
        <div className="h-full rounded-full bg-gradient-to-r from-[#ff9a3c] to-[#e06600]" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-neutral-600">{challenge.progress} / {challenge.target}</p>
      <p className="mt-1 text-[11px] text-neutral-500">{challenge.note}</p>
    </section>
  );
}

type NotificationItem = { id: string; day: string; type: string; text: string; read: boolean };
const NOTIF_KEY = "tys.notifications.v1";

/** مركز الإشعارات: بيتحسب من الأرقام الحالية وبيتحفظ محلياً، ومفيش إشعار يتكرر أو يزيد عن حد اليوم. */
function NotificationsCard({ data }: { data: Dashboard }) {
  const today = cairoISODate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  useEffect(() => {
    let stored: NotificationItem[] = [];
    try {
      const raw = localStorage.getItem(NOTIF_KEY);
      if (raw) stored = JSON.parse(raw) as NotificationItem[];
    } catch {
      stored = [];
    }
    let newBadges: string[] = [];
    try {
      const earned = JSON.parse(localStorage.getItem(BADGES_STORE_KEY) ?? "{}") as Record<string, string>;
      newBadges = data.badges.filter((b) => b.earned && earned[b.id] === today).map((b) => BADGE_META[b.id]?.title ?? b.id);
    } catch {
      newBadges = [];
    }
    const lagging = data.kpis.filter((k) => k.weight > 0 && k.target > 0 && k.percent < 90 && k.remaining > 0).map((k) => ({ nameEn: k.nameEn, percent: k.percent }));
    const candidates = buildNotificationCandidates({
      day: today,
      overall: data.overall,
      remainingDays: data.work.remaining,
      lagging,
      newBadges,
      challenge: data.challenge ? { title: data.challenge.title, done: data.challenge.done } : null,
    });
    const merged = mergeNotificationList(stored, candidates, today) as NotificationItem[];
    try {
      localStorage.setItem(NOTIF_KEY, JSON.stringify(merged));
    } catch {
      // لو التخزين مش متاح، الإشعارات هتتحسب تاني في الزيارة الجاية.
    }
    setItems(merged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.overall, data.work.remaining, data.badges.length]);

  const unread = items.filter((n) => !n.read).length;
  const shown = [...items].reverse().slice(0, 10);
  return (
    <section className="rounded-[24px] bg-white p-4 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)] ring-1 ring-orange-200/70">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black">🔔 الإشعارات {unread > 0 ? <span className="mr-1 rounded-full bg-[#e06600] px-2 py-0.5 text-[11px] text-white">{unread}</span> : null}</h2>
        {unread > 0 ? (
          <button
            type="button"
            onClick={() => {
              const all = items.map((n) => ({ ...n, read: true }));
              setItems(all);
              try {
                localStorage.setItem(NOTIF_KEY, JSON.stringify(all));
              } catch {
                // لو التخزين مش متاح، الحالة هتفضل في الشاشة دي بس.
              }
            }}
            className="text-xs font-extrabold text-[#e06600]"
          >
            علّم الكل كمقروء
          </button>
        ) : null}
      </div>
      {shown.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-600">مفيش إشعارات لسه.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {shown.map((n) => (
            <li key={n.id} className={`rounded-2xl px-3 py-2 text-xs leading-6 ${n.read ? "bg-neutral-50" : "bg-orange-50 font-bold"}`}>
              {n.text} <span className="text-[10px] text-neutral-400">· {n.day}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DailyLogCard({ log }: { log: DailyLogView }) {
  const max = Math.max(1, ...log.days.map((d) => d.operations));
  const diff = log.today.diff;
  return (
    <section className="rounded-[24px] bg-white p-4 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)] ring-1 ring-orange-200/70">
      <h2 className="text-lg font-black">📈 سجل الأداء اليومي</h2>
      {log.days.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-600">لسه مفيش سجلات الشهر ده. أول ما تسجل عملية هتظهر هنا.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-2xl bg-orange-50/70 p-2.5">
              <p className="text-neutral-500">النهارده</p>
              <p className="text-lg font-black text-[#e06600]">{log.today.operations}</p>
            </div>
            <div className="rounded-2xl bg-orange-50/70 p-2.5">
              <p className="text-neutral-500">مقارنة بامبارح</p>
              <p className={`text-lg font-black ${diff >= 0 ? "text-emerald-700" : "text-red-600"}`}>{diff > 0 ? `+${diff}` : diff}</p>
            </div>
          </div>
          <div className="mt-4 flex h-28 items-end gap-1 overflow-hidden">
            {log.days.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center justify-end" title={`${d.date}: ${d.operations}`}>
                <div className="w-full rounded-t-md bg-gradient-to-t from-[#e06600] to-[#ff9a3c]" style={{ height: `${(d.operations / max) * 100}%`, minHeight: 4 }} />
              </div>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-neutral-500">عدد العمليات في كل يوم سجّلت فيه</p>
          <div className="mt-3 space-y-1 text-xs">
            {log.best ? <p>أحسن يوم: <span className="font-black">{log.best.date}</span> ({log.best.operations} عملية)</p> : null}
            {log.worst && log.best && log.worst.date !== log.best.date ? <p>أقل يوم: <span className="font-black">{log.worst.date}</span> ({log.worst.operations} عملية)</p> : null}
            <p className="text-neutral-600">متوسط أيام الأسبوع: {log.weekdayAverages.filter((w) => w.days > 0).map((w) => `${WEEKDAY_AR[w.weekday]} ${w.average}`).join("، ")}</p>
          </div>
        </>
      )}
    </section>
  );
}

function CommissionCard({ data }: { data: CommissionView }) {
  return (
    <section className="rounded-[24px] bg-white p-4 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)] ring-1 ring-orange-200/70">
      <h2 className="text-lg font-black">💰 توقع العمولة</h2>
      {!data.hasFullCommission ? (
        <p className="mt-2 text-sm text-neutral-600">{data.message}</p>
      ) : (
        <>
          <p className="mt-2 text-sm">
            حسب أداءك الحالي ({formatPercent(data.current.overall)}%): <span className="font-black text-[#e06600]">{formatMoney(data.current.commission)} ج</span>
            {data.current.belowMinimum ? <span className="block text-xs text-neutral-500">لازم توصل {OVERALL_MIN_PERCENT_UI}% عشان يبدأ الحافز.</span> : null}
          </p>
          <div className="mt-3 space-y-1.5">
            {data.scenarios.map((sc) => (
              <div key={sc.label} className="flex items-center justify-between rounded-2xl bg-orange-50/70 px-3 py-2 text-xs">
                <span>{sc.label}</span>
                <span className="font-black text-[#e06600]">{formatMoney(sc.commission)} ج</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-neutral-500">كل 1% بيزوّد حوالي {formatMoney(data.perOnePercent)} ج.</p>
        </>
      )}
    </section>
  );
}

const OVERALL_MIN_PERCENT_UI = 80;

function BadgesCard({ badges, today }: { badges: BadgeView[]; today: string }) {
  const [earnedOn, setEarnedOn] = useState<Record<string, string>>({});
  useEffect(() => {
    let stored: Record<string, string> = {};
    try {
      const raw = localStorage.getItem(BADGES_STORE_KEY);
      if (raw) stored = JSON.parse(raw) as Record<string, string>;
    } catch {
      stored = {};
    }
    const updated = { ...stored };
    for (const b of badges) if (b.earned && !updated[b.id]) updated[b.id] = today;
    try {
      localStorage.setItem(BADGES_STORE_KEY, JSON.stringify(updated));
    } catch {
      // لو التخزين مش متاح، الشارات هتتحسب تاني من السجلات.
    }
    setEarnedOn(updated);
  }, [badges, today]);
  const earnedCount = badges.filter((b) => b.earned).length;
  return (
    <section className="rounded-[24px] bg-white p-4 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)] ring-1 ring-orange-200/70">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black">🏅 الإنجازات</h2>
        <p className="text-xs font-bold text-neutral-500">{earnedCount} / {badges.length}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {badges.map((b) => {
          const meta = BADGE_META[b.id];
          const on = b.earned || Boolean(earnedOn[b.id]);
          const isNew = on && earnedOn[b.id] === today;
          return (
            <div key={b.id} className={`rounded-2xl p-3 text-center ring-1 ${on ? "bg-orange-50 ring-orange-200" : "bg-neutral-50 ring-neutral-200 opacity-60"}`}>
              <p className="text-2xl">{on ? meta.icon : "🔒"}</p>
              <p className="mt-1 text-xs font-black leading-5">{meta.title}</p>
              <p className="text-[10px] leading-4 text-neutral-500">{on ? (isNew ? "اتكسبت النهارده 🎉" : "اتكسبت") : meta.hint}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** قسم قابل للفتح والإغلاق: مقفول افتراضياً، وفتحه/قفله مش بيأثر على أي بيانات. */
function Collapsible({ title, badge, children }: { title: string; badge?: string; children: ReactNode }) {
  return (
    <details className="group rounded-[24px] bg-white ring-1 ring-orange-200/70 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-[24px] px-4 py-3.5 text-base font-black [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">{title}{badge ? <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-extrabold text-[#8f4300]">{badge}</span> : null}</span>
        <span aria-hidden className="text-[#e06600] transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="space-y-3 px-3 pb-3">{children}</div>
    </details>
  );
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Africa/Cairo" }).format(new Date()));
  if (hour >= 5 && hour < 12) return "صباح الخير يا";
  if (hour >= 12 && hour < 18) return "نهارك سعيد يا";
  return "مساء الخير يا";
}

const SHORT_KPI_NAMES: Record<string, string> = {
  "New Orange Cash Wallets": "New",
  "Exist": "Exist",
};

// تنبيه داخلي واحد بس في اليوم، بيتقفل لوحده ومبيتكررش في نفس اليوم.
function NudgeBanner({ overall, remainingDays }: { overall: number; remainingDays: number }) {
  const nudge = nudgeFor(overall, remainingDays);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!nudge) return;
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
    const key = "tys.nudge.last";
    try {
      if (localStorage.getItem(key) === `${day}|${nudge.kind}`) return;
      localStorage.setItem(key, `${day}|${nudge.kind}`);
    } catch {
      // لو التخزين مش متاح، التنبيه هيظهر بس من غير منع التكرار.
    }
    setShown(true);
  }, [nudge?.kind]);
  if (!nudge || !shown) return null;
  return (
    <section className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-extrabold text-amber-900 ring-1 ring-amber-200">
      🔔 {nudge.text}
    </section>
  );
}


function WelcomeCard({ name, yearMonth, monthLabel, overall }: { name: string; yearMonth: string; monthLabel: string; overall: number }) {
  const key = `tys.welcome.${yearMonth}`;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(key) === "1";
    } catch {
      seen = false;
    }
    setHidden(seen);
  }, [key]);
  if (hidden) return null;
  return (
    <section className="rounded-[24px] bg-gradient-to-br from-[#fff3e6] to-[#fde1c4] p-5 text-[#8f4300] ring-1 ring-orange-200/70">
      <p className="text-lg font-black">أهلاً يا {name.trim().split(" ")[0] || "بطل"} 👋</p>
      <p className="mt-1 text-sm font-bold">نورتنا في شهر {monthLabel}</p>
      <p className="mt-2 text-sm leading-7">{welcomeLine(overall)}</p>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem(key, "1");
          } catch {
            // لو التخزين مش متاح، الكارت هيفضل.
          }
          setHidden(true);
        }}
        className="mt-3 rounded-full bg-white px-4 py-2 text-xs font-extrabold text-[#8f4300] ring-1 ring-orange-200/70"
      >
        تمام، يلا بينا
      </button>
    </section>
  );
}

function shortKpiName(name: string) {
  return SHORT_KPI_NAMES[name] ?? name;
}

export default function HomePage() {
  const [copied, setCopied] = useState(false);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  useEffect(() => {
    const refresh = () => setSync(readSyncStatus());
    refresh();
    window.addEventListener("tys-sync-status", refresh);
    return () => window.removeEventListener("tys-sync-status", refresh);
  }, []);
  const month = useMonth();
  // بنخزّن الشهر مع البيانات عشان نعرف إن اللي معروض يخص الشهر الحالي من غير setState متزامن جوه الـ effect.
  const [state, setState] = useState<{ month: string; data: Dashboard | null; error: string }>({
    month: "",
    data: null,
    error: "",
  });

  useEffect(() => {
    let cancelled = false;
    api<Dashboard>(`/api/dashboard?month=${month}`)
      .then((result) => {
        if (!cancelled) setState({ month, data: result, error: "" });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            month,
            data: null,
            error: err instanceof ApiError || err instanceof Error ? err.message : "مقدرناش نحمّل اللوحة",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const loading = state.month !== month;
  const { data, error } = state;

  if (loading) return <Spinner label="ثواني… بنحمّل لوحة الأداء" />;
  if (error) return <Banner tone="error">{error}</Banner>;
  if (!data) return <Banner tone="error">مفيش بيانات نعرضها</Banner>;

  const gap = Math.max(0, 100 - data.overall);
  const statusTextEgy = pickPhrase(overallBandLines(data.overall), `overall|${data.yearMonth}`);
  const timeText = pickPhrase(
    timeLines(data.work.remaining, data.work.total, data.work.elapsed),
    `time|${data.yearMonth}`,
  );



  return (
    <div className="space-y-5">
      {sync ? (
        <p className={`px-1 text-[11px] font-bold ${sync.ok ? "text-emerald-700" : "text-red-600"}`} dir="rtl">
          {sync.ok
            ? `☁️ اتبعت للمدير ${new Date(sync.at).toLocaleTimeString("en-US", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hour12: false })}`
            : `⚠️ ماتبعتش للمدير: ${sync.error ?? ""}`}
        </p>
      ) : null}
      <NudgeBanner overall={data.overall} remainingDays={data.work.remaining} />
      {data.entriesCount === 0 ? (
        <WelcomeCard name={data.profile.name} yearMonth={data.yearMonth} monthLabel={data.monthLabel} overall={data.overall} />
      ) : null}

      <section className="text-right">
        <p className="text-sm font-extrabold text-neutral-700">
          {greeting()} {data.profile.name.split(" ")[0]} 👋
        </p>
        <p className="text-[11px] text-neutral-400">📍 {data.profile.branch}</p>
        {new Date().getHours() < 12 ? <p className="mt-1 text-xs font-bold text-[#8f4300]">{pickPhrase(MORNING_LINES, `morning|${data.yearMonth}`)}</p> : null}
      </section>

      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#f0802a] via-[#e06600] to-[#b84700] p-6 text-white shadow-[0_20px_50px_rgba(190,90,0,0.35)] ring-1 ring-white/30">
        <div className="pointer-events-none absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/15" />
        <p className="text-sm font-bold text-white/90">إجمالي التارجت الشهري</p>
        <p className="mt-1 text-5xl font-black tabular-nums tracking-tight">{formatPercent(data.overall)}%</p>
        <p className="mt-1 text-sm font-extrabold text-white">{statusTextEgy}</p>
        <p className="mt-1 text-xs font-bold text-white/80">{timeText}</p>
        <div className="mt-5 flex h-4 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white transition-all" style={{ width: `${Math.min(100, Math.max(0, data.overall))}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/15 px-3 py-2.5 ring-1 ring-white/25">
            <p className="text-[11px] text-white/80">{gap > 0 ? "فاضل" : "الحالة"}</p>
            <p className="text-base font-black tabular-nums">{gap > 0 ? `${formatPercent(gap)}%` : "قفلت الشهر ✅"}</p>
          </div>
          <div className="rounded-2xl bg-white/15 px-3 py-2.5 ring-1 ring-white/25">
            <p className="text-[11px] text-white/80">الكوميشن المتوقع</p>
            <p className="text-base font-black tabular-nums">
              {formatMoney(data.estimatedCommission)} <span className="text-[11px] font-bold text-white/80">من {formatMoney(data.fullCommission)} جنيه</span>
            </p>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={async () => {
          const lines = [
            `📊 ملخص ${data.monthLabel}`,
            `التوتال: ${formatPercent(data.overall)}%`,
            `الكوميشن: ${formatMoney(data.estimatedCommission)} من ${formatMoney(data.fullCommission)} جنيه`,
            ...data.kpis.map((kpi) => `• ${kpi.nameEn}: ${formatQty(kpi.achieved)} / ${formatQty(kpi.target)} (${formatPercent(kpi.percent)}%)`),
          ];
          const text = lines.join("\n");
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-orange-200/70 bg-white py-3 text-sm font-extrabold text-[#8f4300] shadow-[0_1px_2px_rgba(40,20,0,0.04)] active:scale-[0.99]"
      >
        {copied ? "✅ اتنسخ الملخص" : "📋 انسخ ملخص الشهر"}
      </button>

      {data.todaySummary.every((row) => row.count === 0) ? (
        <p className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-[#8f4300] shadow-[0_1px_2px_rgba(40,20,0,0.04)]">
          🔔 لسه مسجلتش إنجاز النهارده. سجّل من تبويب تسجيل.
        </p>
      ) : null}

      {data.pace.message ? <p className="px-1 text-xs leading-6 text-neutral-500">{data.pace.message}</p> : null}

      {(() => {
        const names = (keys: string[]) => keys.map((key) => data.kpis.find((k) => k.kpiKey === key)?.nameEn ?? key).join(" · ");
        const notes: string[] = [];
        if (data.rules.belowOverall) notes.push("التوتال أقل من 80%: مفيش حافز");
        if (data.rules.belowKpis.length > 0) notes.push(`أقل من 90% (متتحسبش): ${names(data.rules.belowKpis)}`);
        if (data.rules.clawBacks.length > 0) notes.push(`خصم 5 نقاط: ${names(data.rules.clawBacks)}`);
        if (data.weightWarning) notes.push(`الأوزان ${formatPercent(data.weightSum)}% (لازم 100%)`);
        if (notes.length === 0) return null;
        return (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-950">
            {notes.map((note) => (
              <p key={note}>⚠️ {note}</p>
            ))}
          </div>
        );
      })()}

      <section className="rounded-[24px] border border-orange-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
        <div className="flex items-end justify-between">
          <p className="text-sm font-black text-neutral-800">نسبة الإنجاز</p>
          <p className="text-xs text-neutral-400">{data.kpis.length} مؤشر</p>
        </div>
        <div className="mt-4 flex h-36 items-end justify-around gap-2">
          {data.kpis.map((kpi) => {
            const h = Math.min(100, Math.max(4, kpi.percent));
            return (
              <div key={kpi.kpiKey} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] font-extrabold text-[#8f4300]">{Math.round(kpi.percent)}%</span>
                <div className="w-full max-w-[28px] rounded-t-xl bg-gradient-to-t from-[#b84700] to-[#f0802a] transition-all" style={{ height: `${h}%` }} />
                <span className="w-full truncate text-center text-[9px] text-neutral-500" dir="ltr">{shortKpiName(kpi.nameEn)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <Collapsible title="🧭 المساعد وتحليل الأداء">
        <p className="rounded-2xl bg-orange-50 px-3 py-2 text-xs font-bold text-[#8f4300]">{overallLine()}</p>
        {sarcasticLine(data.overall) ? <p className="px-1 text-xs font-bold text-neutral-500">{sarcasticLine(data.overall)}</p> : null}
        <AssistantCard assistant={data.assistant} analysis={data.analysis} />
      </Collapsible>

      <Collapsible title="🏅 الإنجازات وتحدي اليوم" badge={`${data.badges.filter((b) => b.earned).length}/${data.badges.length}`}>
        <ChallengeCard challenge={data.challenge} />
        <BadgesCard badges={data.badges} today={cairoISODate()} />
      </Collapsible>

      <Collapsible title="📈 سجل الأداء وسيناريوهات العمولة">
        <DailyLogCard log={data.dailyLog} />
        <CommissionCard data={data.commissionScenarios} />
      </Collapsible>

      <Collapsible title="🔔 الإشعارات">
        <NotificationsCard data={data} />
      </Collapsible>

      <Collapsible title="📋 مؤشرات الأداء بالتفصيل" badge={`${data.kpis.length}`}>
      <div className="space-y-3">
        {data.kpis.map((kpi) => {
          const visual = Math.min(100, Math.max(0, kpi.percent));
          const kpiExpected = kpi.target > 0 ? (kpi.expectedToDate / kpi.target) * 100 : 0;
          const m = kpiMood({ percent: kpi.percent, expectedPercent: kpiExpected, weight: kpi.weight });
          const moodColor =
            m.tone === "good" ? "text-emerald-700" : m.tone === "warn" ? "text-yellow-700" : m.tone === "bad" ? "text-red-600" : "text-neutral-400";
          return (
            <article key={kpi.kpiKey} className="rounded-[24px] bg-white p-3.5 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)] ring-1 ring-orange-200/70">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-[#e06600]"><KpiIcon kpiKey={kpi.kpiKey} className="h-5 w-5" /></span>
                  <div>
                    <h3 className="font-extrabold text-neutral-900" dir="ltr">
                      {kpi.nameEn}
                    </h3>
                    <p className={`text-xs font-bold ${moodColor}`}>
                      {m.emoji} {kpi.weight === 0 || kpi.percent < 0 ? m.text : (() => { const lines = kpiLines(kpi.kpiKey, kpi.percent); return lines ? pickPhrase(lines, `kpi|${kpi.kpiKey}|${data.yearMonth}`) : m.text; })()}
                    </p>
                  </div>
                </div>
                <p className="text-lg font-black text-[#e06600]">{formatPercent(kpi.percent)}%</p>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-orange-50/70 p-2.5 text-center">
                <div>
                  <p className="text-[10px] text-neutral-500">المستهدف</p>
                  <p className="text-sm font-black tabular-nums">{formatQty(kpi.target)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-neutral-500">المحقق</p>
                  <p className="text-sm font-black tabular-nums text-[#b84700]">{formatQty(kpi.achieved)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-neutral-500">الباقي</p>
                  <p className="text-sm font-black tabular-nums">{formatQty(kpi.remaining)}</p>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-gradient-to-r from-[#f0802a] to-[#b84700] transition-all" style={{ width: `${visual}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs font-bold">
                <span className="text-[#e06600]">مساهمة: {formatPercent(kpi.contribution)}%</span>
                <span className="text-neutral-400">الوزن: {kpi.weight}%</span>
              </div>
              <p className="mt-1 text-[11px] text-neutral-400">
                المفروض تكون عند {formatQty(kpi.expectedToDate)} {kpi.unitAr} دلوقتي · فاضل {formatQty(kpi.remaining)}
              </p>
              {kpi.overTarget ? <p className="mt-2 text-xs font-bold text-[#e06600]">🎉 عدّيت التارجت! الشريط واقف عند 100% بس الرقم الحقيقي ظاهر فوق.</p> : null}
            </article>
          );
        })}
      </div>
      </Collapsible>
    </div>
  );
}
