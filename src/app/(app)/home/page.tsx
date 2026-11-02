"use client";

import { useEffect, useState } from "react";
import { Banner, Spinner } from "@/components/ui";
import { ApiError, api } from "@/lib/client";
import { formatMoney, formatPercent, formatQty } from "@/lib/calculations";
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

type Dashboard = {
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
    <div className="space-y-3">
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

      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#f0802a] via-[#e06600] to-[#b84700] p-4 text-white shadow-[0_20px_50px_rgba(190,90,0,0.35)] ring-1 ring-white/30">
        <div className="pointer-events-none absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/15" />
        <p className="text-xs font-bold text-white/90">إجمالي التارجت الشهري</p>
        <p className="mt-0.5 text-4xl font-black tabular-nums tracking-tight">{formatPercent(data.overall)}%</p>
        <p className="mt-1 text-sm font-extrabold text-white">{statusTextEgy}</p>
        <p className="mt-1 text-xs font-bold text-white/80">{timeText}</p>
        <p className="mt-1 text-xs font-bold text-white/80">{overallLine()}</p>
        {sarcasticLine(data.overall) ? <p className="mt-1 text-xs font-bold text-white/70">{sarcasticLine(data.overall)}</p> : null}
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white transition-all" style={{ width: `${Math.min(100, Math.max(0, data.overall))}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/15 px-3 py-2 ring-1 ring-white/25">
            <p className="text-[11px] text-white/80">{gap > 0 ? "فاضل" : "الحالة"}</p>
            <p className="text-base font-black tabular-nums">{gap > 0 ? `${formatPercent(gap)}%` : "قفلت الشهر ✅"}</p>
          </div>
          <div className="rounded-2xl bg-white/15 px-3 py-2 ring-1 ring-white/25">
            <p className="text-[11px] text-white/80">الكوميشن المتوقع</p>
            <p className="text-base font-black tabular-nums">
              {formatMoney(data.estimatedCommission)} <span className="text-[11px] font-bold text-white/80">من {formatMoney(data.fullCommission)} جنيه</span>
            </p>
          </div>
        </div>
      </section>





      <section className="rounded-[22px] border border-orange-200/70 bg-white p-3.5 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
        <div className="flex items-end justify-between">
          <p className="text-sm font-black text-neutral-800">نسبة الإنجاز</p>
          <p className="text-xs text-neutral-400">{data.kpis.length} مؤشر</p>
        </div>
        <div className="mt-2 flex h-24 items-end justify-around gap-2">
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

      <h2 className="text-lg font-black">مؤشرات الأداء</h2>
      <div className="space-y-2">
        {data.kpis.map((kpi) => {
          const visual = Math.min(100, Math.max(0, kpi.percent));
          const kpiExpected = kpi.target > 0 ? (kpi.expectedToDate / kpi.target) * 100 : 0;
          const m = kpiMood({ percent: kpi.percent, expectedPercent: kpiExpected, weight: kpi.weight });
          const moodColor =
            m.tone === "good" ? "text-emerald-700" : m.tone === "warn" ? "text-yellow-700" : m.tone === "bad" ? "text-red-600" : "text-neutral-400";
          return (
            <article key={kpi.kpiKey} className="rounded-[18px] bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)] ring-1 ring-orange-200/70">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 text-[#e06600]"><KpiIcon kpiKey={kpi.kpiKey} className="h-4 w-4" /></span>
                  <div>
                    <h3 className="text-sm font-extrabold text-neutral-900" dir="ltr">
                      {kpi.nameEn}
                    </h3>
                    <p className={`text-xs font-bold ${moodColor}`}>
                      {m.emoji} {kpi.weight === 0 || kpi.percent < 0 ? m.text : (() => { const lines = kpiLines(kpi.kpiKey, kpi.percent); return lines ? pickPhrase(lines, `kpi|${kpi.kpiKey}|${data.yearMonth}`) : m.text; })()}
                    </p>
                  </div>
                </div>
                <p className="text-base font-black text-[#e06600]">{formatPercent(kpi.percent)}%</p>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-orange-50/70 px-1.5 py-1.5 text-center text-[11px]">
                <p>
                  <span className="text-neutral-500">المستهدف </span>
                  <span className="font-black tabular-nums">{formatQty(kpi.target)}</span>
                </p>
                <p>
                  <span className="text-neutral-500">المحقق </span>
                  <span className="font-black tabular-nums text-[#b84700]">{formatQty(kpi.achieved)}</span>
                </p>
                <p>
                  <span className="text-neutral-500">الباقي </span>
                  <span className="font-black tabular-nums">{formatQty(kpi.remaining)}</span>
                </p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-gradient-to-r from-[#f0802a] to-[#b84700] transition-all" style={{ width: `${visual}%` }} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 text-[10px] font-bold leading-4">
                <span className="text-[#e06600]">مساهمة: {formatPercent(kpi.contribution)}%</span>
                <span className="text-neutral-400">الوزن: {kpi.weight}%</span>
                <span className="w-full text-neutral-400">
                  المفروض تكون عند {formatQty(kpi.expectedToDate)} {kpi.unitAr} دلوقتي · فاضل {formatQty(kpi.remaining)}
                </span>
              </div>
              {kpi.overTarget ? <p className="mt-1 text-[10px] font-bold text-[#e06600]">🎉 عدّيت التارجت! الشريط واقف عند 100% بس الرقم الحقيقي ظاهر فوق.</p> : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
