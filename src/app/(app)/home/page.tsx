"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Banner } from "@/components/ui";
import { HomeSkeleton } from "@/components/Skeleton";
import { ApiError, api } from "@/lib/client";
import { formatMoney, formatPercent, formatQty, linesWord } from "@/lib/calculations";
import { useMonth } from "@/components/AppShell";
import { KpiIcon } from "@/components/KpiIcon";
import { overallBandLines, overallLine, pickPhrase, sarcasticLine, timeLines } from "@/lib/phrases";
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
  work: { total: number; elapsed: number; elapsedBeforeToday?: number; remaining: number };
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
  "Existing OC Wallets": "Existing",
};

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
  if (loading) return <HomeSkeleton />;
  if (error) return <Banner tone="error">{error}</Banner>;
  if (!data) return <Banner tone="error">مفيش بيانات نعرضها</Banner>;

  const gap = Math.max(0, 100 - data.overall);
  // اون تراك: الإجمالي وصل لنسبة الأيام اللي عدّت من الشهر (أيام الشغل). لو مفيش أيام، مبنحكمش.
  // النهارده مش محسوب في الأيام اللي عدّت.
  const doneDays = data.work.elapsedBeforeToday ?? data.work.elapsed;
  const onTrack: boolean | null = data.work.total > 0 ? data.overall >= (doneDays / data.work.total) * 100 : null;
  const statusTextEgy = onTrack === false
    ? pickPhrase(overallBandLines(Math.min(data.overall, 69.9)), `overall|off|${data.yearMonth}`)
    : pickPhrase(overallBandLines(data.overall), `overall|${data.yearMonth}`);
  const timeText = pickPhrase(
    timeLines(data.work.remaining, data.work.total, data.work.elapsedBeforeToday ?? data.work.elapsed),
    `time|${data.yearMonth}`,
  );



  const ringLen = 251.2;
  const ringOffset = ringLen - (ringLen * Math.min(100, Math.max(0, data.overall))) / 100;
  const sarcastic = sarcasticLine(data.overall);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 pb-28">
      {sync ? (
        <p className={`text-[11px] font-bold ${sync.ok ? "text-emerald-700" : "text-red-600"}`} dir="rtl">
          {sync.ok
            ? `☁️ اتبعت للمدير ${new Date(sync.at).toLocaleTimeString("en-US", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hour12: false })}`
            : `⚠️ ماتبعتش للمدير: ${sync.error ?? ""}`}
        </p>
      ) : null}

      <section className="flex items-end justify-between gap-3 rounded-[26px] border border-[#f2e2d4] bg-white/80 px-4 py-4 shadow-[0_10px_30px_rgba(100,55,25,0.045)] sm:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-black tracking-[0.16em] text-[#d66a27]">YOUR SALES OVERVIEW</p>
          <h1 className="mt-1 text-xl font-black tracking-tight text-[#2d2119] sm:text-2xl">
            {greeting()} {data.profile.name.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-xs font-semibold text-[#9a7e6b]">📍 {data.profile.branch}</p>
        </div>
        <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff0e2] text-2xl sm:flex">📈</div>
      </section>

      {/* الهيرو */}
      <section className="relative isolate overflow-hidden rounded-[30px] bg-gradient-to-br from-[#9f3f08] via-[#d95b0b] to-[#f28a32] p-4 text-white shadow-[0_24px_55px_-24px_rgba(145,61,13,0.55)] sm:p-6">
        
        <div className="pointer-events-none absolute -left-12 -top-16 h-52 w-52 rounded-full border-[28px] border-white/5" />
        <div className="pointer-events-none absolute -bottom-24 right-1/3 h-52 w-52 rounded-full bg-[#ffb66f]/15 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-bold text-white/90">
              <span
                role="img"
                aria-label={onTrack === null ? "" : onTrack ? "على المسار" : "متأخر عن المسار"}
                className={`inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white/60 ${onTrack === null ? "hidden" : onTrack ? "bg-emerald-300" : "bg-red-200"}`}
              />
              إجمالي التارجت الشهري
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-[#fffdfb]/20 px-2.5 py-0.5 text-[11px] font-bold">
              <span className="h-2 w-2 rounded-full bg-[#55B8F5]" />
              Live Run
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative h-24 w-24 shrink-0 sm:h-28 sm:w-28">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 50}
                  strokeDashoffset={2 * Math.PI * 50 * (1 - Math.min(100, Math.max(0, data.overall)) / 100)}
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-xl font-black leading-none">{formatPercent(data.overall)}<span className="text-sm">%</span></span>
                <span className="mt-1 text-[10px] font-bold text-white/85">من التارجت</span>
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="inline-block w-fit rounded-xl bg-[#fffdfb]/30 px-3 py-1 text-[12px] font-extrabold text-white shadow-sm">{statusTextEgy}</span>
              <p className="text-[11px] font-medium text-white/85">{timeText}</p>
              <p className="text-xs font-bold leading-5">{overallLine()}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 border-t border-white/20 pt-4 sm:gap-3">
            <div className="flex flex-col rounded-2xl bg-[#fffdfb]/15 p-3">
              <span className="text-[11px] font-medium text-white/85">{gap > 0 ? "المتبقي للهدف" : "الحالة"}</span>
              <span className="mt-1 font-mono text-base font-black">{gap > 0 ? `${formatPercent(gap)}%` : "قفلت الشهر ✅"}</span>
            </div>
            <div className="flex flex-col rounded-2xl bg-[#fffdfb]/15 p-3">
              <span className="text-[11px] font-medium text-white/85">الكوميشن المتوقع</span>
              <span className="mt-1 font-mono text-base font-black">
                {formatMoney(data.estimatedCommission)} <span className="text-[10px] font-bold text-white/80">من {formatMoney(data.fullCommission)} ج.م</span>
              </span>
            </div>
          </div>
          {sarcastic ? <p className="text-xs font-bold text-white/85">{sarcastic}</p> : null}
        </div>
      </section>



      {/* المطلوب انهاردة */}
      <section className="flex items-stretch overflow-hidden rounded-[26px] border border-[#f1dfd0] bg-white shadow-[0_12px_28px_rgba(100,55,25,0.05)]">
        <div className="flex w-28 shrink-0 flex-col items-center justify-center bg-gradient-to-br from-[#a94308] to-[#e96812] px-3 py-4 text-white">
          <span className="font-mono text-3xl font-black leading-none">{data.pace.perDay === null ? "—" : formatQty(Math.ceil(data.pace.perDay))}</span>
          <span className="mt-1 text-[10px] font-bold text-[#FCEBDD]">{data.pace.perDay === null ? "" : linesWord(Math.ceil(data.pace.perDay)) + " / يوم"}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-3.5">
          <span className="flex items-center gap-1.5 text-xs font-black text-slate-900">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D95B00]" />
            المطلوب انهاردة عشان تفضل On Track
          </span>
          <span className="text-[11px] font-semibold leading-relaxed text-slate-600">{data.pace.message}</span>
        </div>
      </section>

      {/* نسبة الإنجاز بالمحاور */}
      <section className="flex flex-col gap-3 rounded-[26px] border border-[#f1dfd0] bg-white/70 p-4 shadow-[0_12px_28px_rgba(100,55,25,0.04)]">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-black tracking-tight text-[#38291f]">
            <span>نسبة الإنجاز بالمحاور</span>
            <span className="rounded border border-[#F3D2B5] bg-[#fff0e2] px-1.5 text-[11px] font-bold text-[#bd4b0a]">{data.kpis.length} مؤشرات</span>
          </h2>
          <span className="text-[11px] font-bold text-slate-500">اسحب ←</span>
        </div>
        <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1 pt-0.5">
          {data.kpis.map((kpi) => {
            const ok = kpi.achieved >= kpi.expectedToDate;
            return (
              <div key={kpi.kpiKey} className="flex w-[104px] shrink-0 flex-col items-center rounded-[22px] border border-[#f1dfd0] bg-[#fffaf5] p-3 text-center shadow-[0_5px_16px_rgba(100,55,25,0.045)]">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-mono text-xs font-black ${ok ? "border-emerald-500 text-emerald-700" : "border-red-500 text-red-700"}`}>
                  {Math.round(kpi.percent)}%
                </div>
                <span className="mt-1.5 w-full truncate text-[11px] font-bold text-slate-800" dir="ltr">{shortKpiName(kpi.nameEn)}</span>
                <span className={`mt-0.5 text-[10px] font-extrabold ${ok ? "text-emerald-600" : "text-red-600"}`}>{ok ? "On Track" : "متأخر"}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* إجراءات سريعة (صفحات موجودة بس) */}
      <section className="grid grid-cols-3 gap-2.5">
        {[
          { href: "/log/", label: "تسجيل بيعة" },
          { href: "/target/", label: "التارجت" },
          { href: "/wiki/", label: "المرجع" },
        ].map((item) => (
          <Link key={item.href} href={`${item.href}?month=${month}`} className="rounded-[20px] border border-[#f1dfd0] bg-white px-2 py-4 text-center text-xs font-extrabold text-[#63391f] shadow-[0_8px_20px_rgba(100,55,25,0.05)] transition-all hover:-translate-y-0.5 hover:border-[#e8b58f] active:scale-95">
            {item.label}
          </Link>
        ))}
      </section>

      {/* المؤشرات */}
      <section className="flex flex-col gap-3 rounded-[28px] border border-[#f1dfd0] bg-white/75 p-4 shadow-[0_12px_30px_rgba(100,55,25,0.04)] sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black tracking-tight text-[#38291f]">مؤشرات الأداء (KPIs)</h2>
          <span className="text-[11px] font-bold text-[#556070]">{data.kpis.length} مؤشر</span>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {data.kpis.map((kpi) => {}
            const onTrackKpi = kpi.achieved >= kpi.expectedToDate;
            const ringLen = 2 * Math.PI * 18;
            const pct = Math.min(100, Math.max(0, kpi.percent));
            return (
              <article key={kpi.kpiKey} className={`flex min-w-0 items-center gap-3 rounded-[22px] border bg-white p-3.5 transition-all duration-300 ${onTrackKpi ? "border-emerald-200 shadow-[0_8px_22px_rgba(16,185,129,0.07)]" : "border-[#f0d8c8] shadow-[0_8px_22px_rgba(145,61,13,0.055)]"}`}>
                <div className="relative h-14 w-14 shrink-0">
                  <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90">
                    <circle cx="22" cy="22" r="18" fill="none" stroke="#F1F4F9" strokeWidth="5" />
                    <circle
                      cx="22"
                      cy="22"
                      r="18"
                      fill="none"
                      stroke={onTrackKpi ? "#16B981" : "#DC2626"}
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={ringLen}
                      strokeDashoffset={ringLen * (1 - pct / 100)}
                      className="transition-all duration-700"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-xs font-black text-[#172033]">{Math.round(kpi.percent)}%</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <KpiIcon kpiKey={kpi.kpiKey} className="h-3.5 w-3.5 shrink-0 text-[#D95B00]" />
                      <span className="truncate text-xs font-black text-[#172033]" dir="ltr">{kpi.nameEn}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${onTrackKpi ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                      {onTrackKpi ? "On Track" : `ناقص ${formatQty(Math.max(0, Math.ceil(kpi.expectedToDate - kpi.achieved)))}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-[#556070]">
                    <span>
                      <strong className="font-mono text-[#172033]">{formatQty(kpi.achieved)}</strong> / {formatQty(kpi.target)}
                    </span>
                    <span>المتبقي <strong className="font-mono text-[#172033]">{formatQty(kpi.remaining)}</strong></span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F1F4F9]">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#D95B00] to-[#E87518] transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                  {kpi.overTarget ? <p className="text-[10px] font-bold text-[#D95B00]">عدّيت التارجت 🎉</p> : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* زرار التسجيل العايم */}
      <div className="pointer-events-none fixed bottom-[76px] left-1/2 z-40 flex w-full max-w-[520px] -translate-x-1/2 justify-center px-4">
        <Link href={`/log/?month=${month}`} className="pointer-events-auto flex items-center gap-2 rounded-full border-2 border-white bg-gradient-to-r from-[#a94308] to-[#ed741d] px-7 py-3 text-sm font-black text-white shadow-[0_14px_32px_-8px_rgba(145,61,13,0.42)] transition-transform active:scale-95">
          <span className="text-lg">＋</span>
          <span>تسجيل بيعة جديدة</span>
        </Link>
      </div>
    </div>
  );
}
