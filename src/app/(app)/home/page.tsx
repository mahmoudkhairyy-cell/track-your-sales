"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  const overallValueRef = useRef<HTMLSpanElement | null>(null);
  const overallBarRef = useRef<HTMLDivElement | null>(null);
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
            error: err instanceof ApiError || err instanceof Error ? err.message : "ماقدرناش نحمّل البيانات. اتأكد من النت وحاول تاني.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const loading = state.month !== month;
  const { data, error } = state;

  // Count-up خفيف: تحديث DOM مباشرة لتجنب إعادة رسم الصفحة في كل frame.
  useEffect(() => {
    const valueNode = overallValueRef.current;
    const barNode = overallBarRef.current;
    if (!valueNode || !barNode) return;

    const target = data ? Math.min(200, Math.max(0, data.overall)) : 0;
    const duration = 2800;
    let frame = 0;
    const start = performance.now();
    valueNode.textContent = formatPercent(0);
    barNode.style.width = "0%";

    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      const current = target * eased;
      valueNode.textContent = formatPercent(current);
      barNode.style.width = `${Math.min(100, current)}%`;
      if (progress < 1) frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [data?.yearMonth, data?.overall, loading]);

  if (loading) return <HomeSkeleton />;
  if (error) return <Banner tone="error">{error}</Banner>;
  if (!data) return <Banner tone="error">مفيش بيانات لسه. ابدأ بتسجيل أول بيعة النهارده.</Banner>;

  // اون تراك: الإجمالي وصل لنسبة الأيام اللي عدّت من الشهر (أيام الشغل). لو مفيش أيام، مبنحكمش.
  // النهارده مش محسوب في الأيام اللي عدّت.
  const doneDays = data.work.elapsedBeforeToday ?? data.work.elapsed;
  const onTrack: boolean | null = data.work.total > 0 ? data.overall >= (doneDays / data.work.total) * 100 : null;
  const employeeName = data.profile.name.trim().split(/\s+/)[0] || "يا نجم";
  const statusPhrase = pickPhrase(overallBandLines(data.overall), `overall|${data.yearMonth}`);
  const statusTextEgy = statusPhrase.replaceAll("{name}", employeeName);
  const timeText = pickPhrase(
    timeLines(data.work.remaining, data.work.total, data.work.elapsedBeforeToday ?? data.work.elapsed),
    `time|${data.yearMonth}`,
  );



  const sarcastic = sarcasticLine(data.overall);

  return (
    <div className="tys-page tys-page-home tys-premium-home mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 pb-28">
      {sync ? (
        <p className={`text-[11px] font-bold ${sync.ok ? "text-emerald-700" : "text-red-600"}`} dir="rtl">
          {sync.ok
            ? `☁️ اتبعت للمدير ${new Date(sync.at).toLocaleTimeString("en-US", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hour12: false })}`
            : `⚠️ مااتبعتش للمدير: ${sync.error ?? ""}. حاول تاني لما النت يرجع.`}
        </p>
      ) : null}

      <section className="tys-home-greeting flex items-end justify-between gap-3 rounded-[26px] border border-[#f5d9c2] bg-[linear-gradient(115deg,#fff8f1_0%,#fff_54%,#ffead8_100%)] px-4 py-4 shadow-[0_10px_28px_-12px_rgba(255,121,0,.20),0_2px_10px_-2px_rgba(43,20,0,.045)] sm:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-black tracking-[0.16em] text-[var(--color-primary-600)]">YOUR SALES OVERVIEW</p>
          <h1 className="mt-1 text-xl font-black tracking-tight text-[var(--color-text-primary)] sm:text-2xl">
            {greeting()} {data.profile.name.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-xs font-semibold text-[var(--color-text-secondary)]">📍 {data.profile.branch}</p>
        </div>
        <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary-50)] text-2xl sm:flex">📈</div>
      </section>

      {/* الهيرو الرئيسي — لوحة إنجاز دائرية */}
      <section style={{ boxShadow: onTrack === null ? "0 5px 14px rgba(100,55,25,.13)" : onTrack ? "0 0 0 1px rgba(22,163,74,.06), 0 0 10px rgba(22,163,74,.08), 0 5px 14px rgba(100,55,25,.13)" : "0 0 0 1px rgba(220,38,38,.06), 0 0 10px rgba(220,38,38,.08), 0 5px 14px rgba(100,55,25,.13)" }} className="tys-home-hero relative isolate overflow-hidden rounded-[30px] border border-[#FFE0C2] bg-[linear-gradient(125deg,#fff3e8_0%,#fffaf5_48%,#ffe2c7_100%)] p-4 sm:p-6">
        <div className="pointer-events-none absolute -left-12 -top-16 h-52 w-52 rounded-full bg-[var(--color-primary-500)]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-1/3 h-52 w-52 rounded-full bg-[var(--color-primary-600)]/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary-500)] to-[var(--color-primary-600)] text-lg text-white shadow-md">◎</span>
              <div className="min-w-0">
                <p className="text-[10px] font-black tracking-[0.14em] text-[var(--color-primary-700)]">MONTHLY PERFORMANCE</p>
                <p className="mt-0.5 text-sm font-black text-[var(--color-text-primary)]">إجمالي التارجت الشهري</p>
              </div>
            </div>
            <span className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-extrabold ${onTrack === null ? "border-[var(--color-border)] bg-white text-[var(--color-text-secondary)]" : onTrack ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-orange-200 bg-orange-50 text-[var(--color-primary-700)]"}`}>
              <span className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full ${onTrack === null ? "bg-[var(--color-text-muted)]" : onTrack ? "bg-emerald-500" : "bg-[var(--color-primary-600)]"}`} />
              {onTrack === null ? "Waiting for data" : onTrack ? "On track" : "Behind"}
            </span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3 py-4 sm:py-5">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-[var(--color-text-secondary)]">نسبة تحقيقك للتارجت</p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-mono text-[52px] font-black leading-none tracking-[-0.065em] text-[var(--color-primary-700)] sm:text-[68px]" ref={overallValueRef}>{formatPercent(0)}</span>
                <span className="text-xl font-black text-[var(--color-primary-600)]">%</span>
              </div>
            </div>
            <div className="inline-flex max-w-full shrink-0 flex-col items-end rounded-xl border border-[var(--color-border)] bg-white/85 px-3 py-2 shadow-sm">
              <span className="text-[10px] font-bold text-[var(--color-text-secondary)]">الكوميشن المحقق</span>
              <strong className={`truncate font-mono text-base font-black ${data.overall < 80 ? "text-red-600" : "text-emerald-700"}`}>{formatMoney(data.estimatedCommission)} جنيه</strong>
            </div>
          </div>
          <div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-[var(--color-border)]">
              <div ref={overallBarRef} className="h-full rounded-full bg-gradient-to-l from-[var(--color-primary-500)] via-[var(--color-primary-600)] to-[var(--color-primary-700)] shadow-[0_1px_5px_rgba(189,75,10,0.22)]" style={{ width: "0%" }} />
            </div>
            <div className="mt-1 flex justify-between text-[9px] font-bold text-[var(--color-text-secondary)]" dir="ltr">
              <span>100% target</span><span>0%</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">
            <span className="font-extrabold text-[var(--color-primary-700)]">{statusTextEgy}</span>{statusTextEgy && timeText ? <span className="text-[var(--color-border)]">•</span> : null}<span>{timeText}</span>
          </div>

          {sarcastic ? <p className="mt-3 text-[11px] font-bold text-[var(--color-primary-700)]">{sarcastic}</p> : null}
        </div>
      </section>

      <div className="fixed inset-x-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 flex flex-col gap-2 sm:static sm:flex-row">
        <Link href={`/log?month=${month}`} className="inline-flex min-h-10 w-auto flex-none self-start items-center justify-center gap-1.5 rounded-full border border-white/80 bg-[rgba(255,255,255,0.58)] px-4 py-2 text-sm font-extrabold text-[#a9430b] shadow-[0_4px_14px_rgba(126,65,24,0.10),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl transition hover:bg-[rgba(255,255,255,0.78)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd4b0a]">
          <span aria-hidden="true" className="text-base leading-none">＋</span> تسجيل إنجاز
        </Link>
      </div>

      {/* المطلوب */}
      <section className="tys-home-daily rounded-[24px] border border-[#f2dfcf] bg-[linear-gradient(160deg,#fff_0%,#fffaf6_100%)] p-3 shadow-[0_8px_24px_-12px_rgba(255,121,0,.16),0_2px_10px_-2px_rgba(43,20,0,.045)] sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="mt-0.5 text-sm font-extrabold text-[var(--color-text-primary)]">DAILY</h2>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--color-primary-50)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--color-primary-700)]">
            فاضل {formatQty(data.work.remaining)} يوم عمل
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {data.kpis.filter((k) => k.remaining > 0).map((k) => {
            const dailyRequired = data.work.remaining > 0 ? Math.ceil(k.remaining / data.work.remaining) : k.remaining;
            return (
              <div
                key={k.kpiKey}
                className="flex min-h-[46px] min-w-0 items-center justify-between gap-2 rounded-lg border border-[#e58a4b]/35 bg-gradient-to-br from-[#fff0e3]/90 via-[#ffe2cb]/75 to-[#ffd0ad]/65 px-2.5 py-1.5 text-[#873b12] shadow-[0_2px_8px_rgba(145,65,18,0.09)] backdrop-blur-md"
              >
                <span className="min-w-0 truncate text-[9px] font-bold tracking-wide text-[#8b421d]" dir="ltr">{k.nameEn}</span>
                <strong className="shrink-0 rounded-md border border-white/70 bg-white/65 px-2 py-1 text-base font-black leading-none tabular-nums text-[#7c320d] shadow-sm">
                  {formatQty(dailyRequired)}
                </strong>
              </div>
            );
          })}
          {data.kpis.every((k) => k.remaining <= 0) ? (
            <p className="col-span-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-extrabold text-emerald-700">كل المؤشرات مكتملة ✓</p>
          ) : null}
        </div>
      </section>

      {/* المؤشرات */}
      <section className="tys-home-kpis flex flex-col gap-3 rounded-[28px] border border-[#f2dfcf] bg-[linear-gradient(160deg,#fff_0%,#fffaf6_100%)] p-4 shadow-[0_8px_26px_-12px_rgba(255,121,0,.16),0_2px_10px_-2px_rgba(43,20,0,.045)] sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black tracking-tight text-[var(--color-text-primary)]">مؤشرات الأداء (KPIs)</h2>
          <span className="text-[11px] font-bold text-[var(--color-text-secondary)]">{data.kpis.length} مؤشر</span>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {data.kpis.map((kpi, kpiIndex) => {
            const onTrackKpi = kpi.achieved >= kpi.expectedToDate;
            const ringLen = 2 * Math.PI * 18;
            const pct = Math.min(100, Math.max(0, kpi.percent));
            return (
              <article key={kpi.kpiKey} style={{ animationDelay: `${kpiIndex * 70}ms`, boxShadow: onTrackKpi ? "0 0 0 1px rgba(22,163,74,.06), 0 0 8px rgba(22,163,74,.07), 0 5px 14px rgba(100,55,25,.13)" : "0 0 0 1px rgba(220,38,38,.06), 0 0 8px rgba(220,38,38,.07), 0 5px 14px rgba(100,55,25,.13)" }} className={`tys-rise tys-home-kpi flex min-w-0 items-center gap-2.5 rounded-[20px] border p-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg sm:gap-3 sm:p-3 border-[#f1d8c3] bg-[linear-gradient(145deg,#fffaf6_0%,#fff0e3_100%)]`}>
                <div className="relative h-12 w-12 shrink-0 sm:h-14 sm:w-14">
                  <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90">
                    <circle cx="22" cy="22" r="18" fill="none" stroke="var(--color-border)" strokeWidth="5" />
                    <circle
                      cx="22"
                      cy="22"
                      r="18"
                      fill="none"
                      stroke={onTrackKpi ? "var(--color-success-ring)" : "var(--color-danger-text)"}
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={ringLen}
                      strokeDashoffset={ringLen * (1 - pct / 100)}
                      className="transition-all duration-700"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-xs font-black text-[var(--color-text-primary)]">{Math.round(kpi.percent)}%</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span dir="rtl" className="flex min-w-0 items-center gap-1.5">
                      <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-50)] px-2.5 py-1.5 text-[var(--color-primary-600)]">
                        <KpiIcon kpiKey={kpi.kpiKey} className="h-5 w-5" />
                      </span>
                      <span className="truncate text-xs font-black text-[var(--color-text-primary)]" dir="ltr">{kpi.nameEn}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${onTrackKpi ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                      {onTrackKpi ? "On Track" : `ناقص ${formatQty(Math.max(0, Math.ceil(kpi.expectedToDate - kpi.achieved)))}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--color-text-secondary)]">
                    <span>
                      <strong className="font-mono text-[var(--color-text-primary)]">{formatQty(kpi.achieved)}</strong> / {formatQty(kpi.target)}
                    </span>
                    <span>المتبقي <strong className="font-mono text-[var(--color-text-primary)]">{formatQty(kpi.remaining)}</strong></span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
                    <div className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-primary-500)] transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                  {kpi.overTarget ? <p className="text-[10px] font-bold text-[var(--color-primary-600)]">عدّيت التارجت 🎉</p> : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

    </div>
  );
}
