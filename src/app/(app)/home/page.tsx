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
  Excite: "Excite",
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
  const sarcastic = sarcasticLine(data.overall);

  return (
    <div className="tys-page tys-page-home mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 pb-28">
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

      {/* الهيرو الرئيسي — لوحة إنجاز دائرية */}
      <section style={{ boxShadow: onTrack === null ? "0 12px 30px rgba(126,65,24,.10)" : onTrack ? "0 0 0 1px rgba(22,163,74,.10), 0 0 22px rgba(22,163,74,.15), 0 16px 38px rgba(22,163,74,.10)" : "0 0 0 1px rgba(220,38,38,.10), 0 0 22px rgba(220,38,38,.15), 0 16px 38px rgba(220,38,38,.10)" }} className="relative isolate overflow-hidden rounded-[30px] border border-[#dfb995] bg-[linear-gradient(125deg,#fff3e8_0%,#fffaf5_48%,#ffe2c7_100%)] p-4 sm:p-6">
        <div className="pointer-events-none absolute -left-12 -top-16 h-52 w-52 rounded-full bg-[#ff9d38]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-1/3 h-52 w-52 rounded-full bg-[#e96812]/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3 border-b border-[#f0d9c5] pb-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff9d38] to-[#e96812] text-lg text-white shadow-md">◎</span>
              <div className="min-w-0">
                <p className="text-[10px] font-black tracking-[0.14em] text-[#bd6b39]">MONTHLY PERFORMANCE</p>
                <p className="mt-0.5 text-sm font-black text-[#38291f]">إجمالي التارجت الشهري</p>
              </div>
            </div>
            <span className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-extrabold ${onTrack === null ? "border-[#ead8c9] bg-white text-[#8b7565]" : onTrack ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-orange-200 bg-orange-50 text-[#bd4b0a]"}`}>
              <span className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full ${onTrack === null ? "bg-[#b9a494]" : onTrack ? "bg-emerald-500" : "bg-[#e96812]"}`} />
              {onTrack === null ? "Waiting for data" : onTrack ? "On track" : "Behind"}
            </span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_112px] items-center gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_136px] sm:gap-6 sm:py-5">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-[#927763]">نسبة تحقيقك للتارجت</p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-mono text-[52px] font-black leading-none tracking-[-0.065em] text-[#bd4b0a] sm:text-[68px]">{formatPercent(data.overall)}</span>
                <span className="text-xl font-black text-[#e58a4a]">%</span>
              </div>
              <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-xl border border-[#f0d9c5] bg-white/85 px-3 py-2 shadow-sm">
                <span className="text-[10px] font-bold text-[#9a806c]">{gap > 0 ? "فاضلك على الهدف" : "حالة التارجت"}</span>
                <strong className="truncate font-mono text-sm font-black text-[#38291f]">{gap > 0 ? `${formatPercent(gap)}%` : "محقق الهدف ✓"}</strong>
              </div>
            </div>
            <div className="relative mx-auto h-[108px] w-[108px] sm:h-[132px] sm:w-[132px]">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#f3dfce" strokeWidth="9" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="url(#hero-progress)" strokeWidth="9" strokeLinecap="round" strokeDasharray={ringLen} strokeDashoffset={ringLen - (ringLen * Math.min(100, Math.max(0, data.overall))) / 100} className="transition-all duration-700" />
                <defs><linearGradient id="hero-progress" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffad58" /><stop offset="100%" stopColor="#bd4b0a" /></linearGradient></defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-lg font-black text-[#bd4b0a] sm:text-xl">{Math.round(Math.min(200, data.overall))}%</span>
              </div>
            </div>
          </div>
          <div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-[#f2dfcf]">
              <div className="h-full rounded-full bg-gradient-to-l from-[#ffad58] via-[#ed741d] to-[#bd4b0a] shadow-[0_1px_5px_rgba(189,75,10,0.22)] transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, data.overall))}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[9px] font-bold text-[#a18a78]" dir="ltr">
              <span>100% target</span><span>0%</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-[#8c725f]">
            <span className="font-extrabold text-[#bd4b0a]">{statusTextEgy}</span><span className="text-[#d9bda7]">•</span><span>{timeText}</span>
          </div>

          {sarcastic ? <p className="mt-3 text-[11px] font-bold text-[#a75b2c]">{sarcastic}</p> : null}
        </div>
      </section>

      {/* المطلوب انهاردة */}
      <section className="flex items-stretch overflow-hidden rounded-[26px] border border-[#f1dfd0] bg-white shadow-[0_12px_28px_rgba(100,55,25,0.05)]">
        <div className="flex w-24 shrink-0 flex-col items-center justify-center bg-gradient-to-br from-[#a94308] to-[#e96812] px-2.5 py-3.5 text-white sm:w-28 sm:px-3 sm:py-4">
          <span className="font-mono text-2xl font-black leading-none sm:text-3xl">{data.pace.perDay === null ? "—" : formatQty(Math.ceil(data.pace.perDay))}</span>
          <span className="mt-1 text-[10px] font-bold text-[#fff0e2]">{data.pace.perDay === null ? "" : linesWord(Math.ceil(data.pace.perDay)) + " / يوم"}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-3.5">
          <span className="flex items-center gap-1.5 text-xs font-black text-[#2d2119]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#e96812]" />
            المطلوب انهاردة عشان تفضل On Track
          </span>
          <span className="text-[11px] font-semibold leading-relaxed text-[#927b69]">{data.pace.message}</span>
        </div>
      </section>

      {/* نسبة الإنجاز بالمحاور */}
      <section className="flex flex-col gap-3 rounded-[26px] border border-[#f1dfd0] bg-white/70 p-4 shadow-[0_12px_28px_rgba(100,55,25,0.04)]">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-black tracking-tight text-[#38291f]">
            <span>نسبة الإنجاز بالمحاور</span>
            <span className="rounded border border-[#f1dfd0] bg-[#fff0e2] px-1.5 text-[11px] font-bold text-[#bd4b0a]">{data.kpis.length} مؤشرات</span>
          </h2>
          <span className="text-[11px] font-bold text-[#9a7963]">اسحب ←</span>
        </div>
        <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1 pt-0.5">
          {data.kpis.map((kpi) => {
            const ok = kpi.achieved >= kpi.expectedToDate;
            return (
              <div key={kpi.kpiKey} className="flex w-[104px] shrink-0 flex-col items-center rounded-[22px] border border-[#e8cdb7] bg-[#fff8f1] p-3 text-center">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-mono text-xs font-black ${ok ? "border-emerald-500 text-emerald-700" : "border-red-500 text-red-700"}`}>
                  {Math.round(kpi.percent)}%
                </div>
                <span className="mt-1.5 w-full truncate text-[11px] font-bold text-[#38291f]" dir="ltr">{shortKpiName(kpi.nameEn)}</span>
                <span className={`mt-0.5 text-[10px] font-extrabold ${ok ? "text-emerald-700" : "text-red-700"}`}>{ok ? "On Track" : "متأخر"}</span>
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
          <span className="text-[11px] font-bold text-[#927b69]">{data.kpis.length} مؤشر</span>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {data.kpis.map((kpi) => {
            const onTrackKpi = kpi.achieved >= kpi.expectedToDate;
            const ringLen = 2 * Math.PI * 18;
            const pct = Math.min(100, Math.max(0, kpi.percent));
            return (
              <article key={kpi.kpiKey} style={{ boxShadow: onTrackKpi ? "0 0 0 1px rgba(22,163,74,.12), 0 0 20px rgba(22,163,74,.17), 0 8px 22px rgba(16,185,129,.10)" : "0 0 0 1px rgba(220,38,38,.12), 0 0 20px rgba(220,38,38,.16), 0 8px 22px rgba(220,38,38,.09)" }} className={`flex min-w-0 items-center gap-2.5 rounded-[20px] border p-3 transition-all duration-300 sm:gap-3 sm:p-3.5 ${onTrackKpi ? "border-emerald-300 bg-[#e2f5e9]" : "border-red-300 bg-[#fde5e5]"}`}>
                <div className="relative h-12 w-12 shrink-0 sm:h-14 sm:w-14">
                  <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90">
                    <circle cx="22" cy="22" r="18" fill="none" stroke="#f6e9df" strokeWidth="5" />
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
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-xs font-black text-[#2d2119]">{Math.round(kpi.percent)}%</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <KpiIcon kpiKey={kpi.kpiKey} className="h-3.5 w-3.5 shrink-0 text-[#e96812]" />
                      <span className="truncate text-xs font-black text-[#2d2119]" dir="ltr">{kpi.nameEn}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${onTrackKpi ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                      {onTrackKpi ? "On Track" : `ناقص ${formatQty(Math.max(0, Math.ceil(kpi.expectedToDate - kpi.achieved)))}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-[#927b69]">
                    <span>
                      <strong className="font-mono text-[#2d2119]">{formatQty(kpi.achieved)}</strong> / {formatQty(kpi.target)}
                    </span>
                    <span>المتبقي <strong className="font-mono text-[#2d2119]">{formatQty(kpi.remaining)}</strong></span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f6e9df]">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#e96812] to-[#ff9d38] transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                  {kpi.overTarget ? <p className="text-[10px] font-bold text-[#e96812]">عدّيت التارجت 🎉</p> : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

    </div>
  );
}
