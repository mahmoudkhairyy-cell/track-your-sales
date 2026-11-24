"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { haptic } from "@/lib/prefs";
import { HomeSkeleton } from "@/components/Skeleton";
import { ApiError, api } from "@/lib/client";
import { formatMoney, formatPercent, formatQty } from "@/lib/calculations";
import { useMonth } from "@/components/AppShell";
import { KpiIcon } from "@/components/KpiIcon";
import { DeltaChip } from "@/components/Sparkline";
import { overallBandLines, pickPhrase, sarcasticLine, timeLines } from "@/lib/phrases";
import { shareAchievement } from "@/lib/sharecard";
import { Rope } from "@/components/Rope";
import { AchievementDial } from "@/components/AchievementDial";
import { pushReport, readSyncStatus, type SyncStatus } from "@/lib/sync";

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
  series?: number[];
  previousToDate?: number | null;
};

type Dashboard = {
  profile: { name: string; branch: string };
  yearMonth: string;
  monthLabel: string;
  todaySummary: { kpiKey: string; quantity: number; count: number }[];
  settingsSaved: boolean;
  kpis: KpiRow[];
  overall: number;
  expectedOverall?: number | null;
  estimatedCommission: number;
  rules: { belowKpis: string[]; clawBacks: string[]; belowOverall: boolean; walletDone: boolean };
  fullCommission: number;
  weightSum: number;
  weightWarning: boolean;
  empty: boolean;
  entriesCount: number;
  work: { total: number; elapsed: number; elapsedBeforeToday?: number; remaining: number };
  pace: { remaining: number; remainingDays: number; perDay: number | null; message: string };
  projection?: { overall: number; commission: number; basisDays: number } | null;
};



function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Africa/Cairo" }).format(new Date()));
  if (hour >= 5 && hour < 12) return "صباح الخير يا";
  if (hour >= 12 && hour < 18) return "نهارك سعيد يا";
  return "مساء الخير يا";
}

export default function HomePage() {
  const router = useRouter();
  const [copied, setCopied] = useState(false);


  const [sync, setSync] = useState<SyncStatus | null>(null);
  useEffect(() => {
    const refresh = () => setSync(readSyncStatus());
    refresh();
    window.addEventListener("tys-sync-status", refresh);
    return () => window.removeEventListener("tys-sync-status", refresh);
  }, []);
  const month = useMonth();
  const toast = useToast();
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

  // احتفال هادي مرة واحدة في الشهر لما الإجمالي يوصل 100%.
  useEffect(() => {
    if (!data || loading || data.overall < 100) return;
    const key = `tys.celebrated.${data.yearMonth}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
    } catch {
      return;
    }
    haptic([30, 50, 30]);
    toast.push("success", "وصلت التارجت الشهري. عاش يا بطل 👏");
  }, [data, loading, toast]);

  if (loading) return <HomeSkeleton />;
  if (error) return <ErrorState title="حصلت مشكلة في تحميل البيانات" description={error} onRetry={() => window.location.reload()} />;
  if (!data) return <EmptyState title="لسه مفيش بيانات" description="ابدأ بتسجيل أول بيعة ليك، وهتظهر مؤشرات أدائك هنا." actionLabel="تسجيل أول إنجاز" onAction={() => router.push(`/log?month=${month}`)} />;

  // اون تراك: الإجمالي وصل لنسبة الأيام اللي عدّت من الشهر (أيام الشغل). لو مفيش أيام، مبنحكمش.
  // النهارده مش محسوب في الأيام اللي عدّت.
  // نفس منطق شاشة المدير بالظبط: الإجمالي الفعلي مقابل نسبة الوقت المنقضي من الشهر (أيام الشغل اللي خلصت قبل النهارده).
  const doneDays = data.work.elapsedBeforeToday ?? data.work.elapsed;
  // نفس حساب صفحة المدير بالظبط: متوسط نسب المؤشرات بأوزانها (من غير الكواليتي) مقابل نسبة الأيام اللي عدّت.
  // كده لو كل مؤشراتك On Track ما يطلعش "Behind" بسبب بند الكواليتي أو قواعد الكوميشن.
  const tracked = data.kpis.filter((k) => k.kpiKey !== "quality" && !k.nameEn.trim().toLowerCase().startsWith("kyc") && k.weight > 0);
  const trackedWeight = tracked.reduce((sum, k) => sum + k.weight, 0);
  const trackPercent = trackedWeight > 0 ? tracked.reduce((sum, k) => sum + k.percent * k.weight, 0) / trackedWeight : data.overall;
  const onTrack: boolean | null = data.work.total > 0 ? trackPercent >= (doneDays / data.work.total) * 100 : null;
  const employeeName = data.profile.name.trim().split(/\s+/)[0] || "يا نجم";
  const statusPhrase = pickPhrase(overallBandLines(data.overall), `overall|${data.yearMonth}`);
  const statusTextEgy = statusPhrase.replaceAll("{name}", employeeName);
  const timeText = pickPhrase(
    timeLines(data.work.remaining, data.work.total, data.work.elapsedBeforeToday ?? data.work.elapsed),
    `time|${data.yearMonth}`,
  );



  const sarcastic = sarcasticLine(data.overall);

  return (
    <div className="tys-page tys-page-home tys-premium-home mx-auto flex min-h-screen w-full max-w-6xl translate-y-0 flex-col gap-4 pb-28 opacity-100 transition-all duration-500 ease-out" style={{ animation: "tys-page-enter 500ms ease-out backwards" }}>
      {sync ? (
        <p className={`text-xs font-bold ${sync.ok ? "text-emerald-700" : "text-red-600"}`} dir="rtl">
          {sync.ok
            ? `☁️ اتبعت للمدير ${new Date(sync.at).toLocaleTimeString("en-US", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hour12: false })}`
            : `⚠️ مااتبعتش للمدير: ${sync.error ?? ""}. `}
          {sync.ok ? null : (
            <button type="button" onClick={() => void pushReport()} className="min-h-8 rounded-lg px-2 font-black underline">
              جرّب تبعت تاني
            </button>
          )}
        </p>
      ) : null}

      <section className="tys-home-greeting flex items-end justify-between gap-3 px-1 pt-1" dir="rtl">
        <div className="min-w-0">
          <h1 className="mt-1 text-xl font-black tracking-tight text-[var(--color-text-primary)] sm:text-2xl">
            {greeting()} {data.profile.name.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-xs font-semibold text-[var(--color-text-secondary)]">{data.profile.branch}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
        </div>
      </section>

      <section className="bold-headline"><p>YOUR AMBITION. IN MOTION.</p><h2>إنجازك.<br/><span>على المكشوف.</span></h2></section>
      <section className="bold-performance">
        <div className="bold-performance-top"><span>التارجت الشهري</span><span className="bold-status">{onTrack === null ? "مستني بيانات" : onTrack ? "على الهدف" : "متأخر"}</span></div>
        <AchievementDial value={data.overall}/>
        <div className="bold-metrics"><div><p>الكوميشن المحقق</p><strong>{formatMoney(data.estimatedCommission)}</strong><small> جنيه</small></div><div><p>المتبقي للتارجت</p><strong>{formatPercent(Math.max(0,100-data.overall))}<small>%</small></strong></div></div>
        <div className="bold-performance-details"><p>{statusTextEgy} {timeText}</p>{data.projection ? <p>بنفس المعدل، المتوقع في آخر الشهر {formatPercent(data.projection.overall)}% وكوميشن {formatMoney(data.projection.commission)} جنيه.</p> : null}{data.entriesCount > 0 ? <button type="button" onClick={()=>void shareAchievement({monthLabel:data.monthLabel,percent:Math.round(data.overall),commission:formatMoney(data.estimatedCommission)})}>شارك إنجازك ↗</button>:null}{sarcastic?<p>{sarcastic}</p>:null}</div>
      </section>

      {/* المطلوب */}
      <section className="tys-home-daily px-1 py-1">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="mt-0.5 text-sm font-extrabold text-[var(--color-text-primary)]"><span className="bold-section-number">01</span>خطوتك النهارده</h2>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--color-primary-50)] px-2.5 py-1 text-xs font-extrabold text-[var(--color-primary-700)]">
            فاضل {formatQty(data.work.remaining)} يوم عمل
          </span>
        </div>
        <div className="bold-daily-grid grid grid-cols-3 gap-2">
          {data.kpis.filter((k) => k.kpiKey !== "quality" && k.remaining > 0).map((k) => {
            const dailyRequired = data.work.remaining > 0 ? Math.ceil(k.remaining / data.work.remaining) : k.remaining;
            return (
              <div
                key={k.kpiKey}
                className="bold-daily-tile flex min-h-[46px] min-w-0 items-center justify-between gap-2 rounded-lg border border-white bg-white px-2.5 py-1.5 text-orange-800 shadow-[0_1px_2px_rgba(43,20,0,.04)]"
              >
                <span className="min-w-0 truncate text-[11px] font-bold tracking-wide text-orange-800" dir="ltr">{k.nameEn}</span>
                <strong className="shrink-0 rounded-md border border-white bg-orange-50 px-2 py-1 text-base font-black leading-none tabular-nums text-orange-800">
                  {formatQty(dailyRequired)}
                </strong>
              </div>
            );
          })}
          {data.kpis.filter((k) => k.kpiKey !== "quality").every((k) => k.remaining <= 0) ? (
            <p className="col-span-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-extrabold text-emerald-700">كل المؤشرات مكتملة ✓</p>
          ) : null}
        </div>
      </section>

      {/* المؤشرات */}
      <section className="tys-home-kpis flex flex-col gap-3 rounded-[20px] border border-white bg-white p-5 shadow-[0_1px_2px_rgba(43,20,0,.04)]">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black tracking-tight text-[var(--color-text-primary)]"><span className="bold-section-number">02</span>نبض الأداء</h2>
          <span className="text-xs font-bold text-[var(--color-text-secondary)]">{data.kpis.length} مؤشر</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data.kpis.map((kpi, kpiIndex) => {
            const onTrackKpi = kpi.achieved >= kpi.expectedToDate;
            const ringLen = 2 * Math.PI * 18;
            const pct = Math.min(100, Math.max(0, kpi.percent));
            return (
              <article key={kpi.kpiKey} style={{ animationDelay: `${kpiIndex * 100}ms`, boxShadow: kpi.percent >= 100 ? "0 0 0 1px rgba(234,88,12,.12), 0 0 16px rgba(234,88,12,.20), 0 5px 14px rgba(100,55,25,.13)" : onTrackKpi ? "0 0 0 1px rgba(22,163,74,.06), 0 0 8px rgba(22,163,74,.07), 0 5px 14px rgba(100,55,25,.13)" : "0 0 0 1px rgba(220,38,38,.06), 0 0 8px rgba(220,38,38,.07), 0 5px 14px rgba(100,55,25,.13)" }} className={`tys-rise tys-home-kpi flex min-w-0 items-center gap-2.5 rounded-[20px] border p-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg sm:gap-3 sm:p-3 border-white bg-orange-50/50`}>
                <div className="tys-ring relative h-12 w-12 shrink-0 sm:h-14 sm:w-14">
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
                  <span className={`absolute inset-0 flex items-center justify-center font-mono font-black text-[var(--color-text-primary)] ${kpi.percent >= 100 ? "text-[10px] tracking-tighter" : "text-xs"}`}>{Math.round(kpi.percent)}%</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span dir="rtl" className="flex min-w-0 items-center gap-1.5">
                      <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-50)] px-2.5 py-1.5 text-[var(--color-primary-600)]">
                        <KpiIcon kpiKey={kpi.kpiKey} className="h-5 w-5" />
                      </span>
                      <span className="truncate text-xs font-black text-[var(--color-text-primary)]" dir="ltr">{kpi.nameEn}</span>
                    </span>
                    <span className={`shrink-0 text-xs ${onTrackKpi ? "font-bold text-[var(--color-text-muted)]" : "rounded-full bg-red-50 px-2 py-0.5 font-extrabold text-red-600"}`}>
                      {onTrackKpi ? "على الهدف" : `ناقص ${formatQty(Math.max(0, Math.ceil(kpi.expectedToDate - kpi.achieved)))}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-text-secondary)]">
                    <span>
                      <strong className="font-mono text-[var(--color-text-primary)]">{formatQty(kpi.achieved)}</strong> / {formatQty(kpi.target)}
                    </span>
                    <span>المتبقي <strong className="font-mono text-[var(--color-text-primary)]">{formatQty(kpi.remaining)}</strong></span>
                  </div>
                  <Rope pct={pct} label={kpi.nameEn} />
                  <div className="tys-bar h-1.5 w-full overflow-hidden rounded-full bg-orange-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-primary-500)] transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                  {kpi.series && kpi.series.length >= 2 ? (
                    <div className="flex justify-end">
                      <DeltaChip current={kpi.achieved} previous={kpi.previousToDate ?? null} />
                    </div>
                  ) : null}
                  {!kpi.overTarget && kpi.remaining > 0 && data.work.remaining > 0 ? (
                    <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
                      محتاج <strong className="font-mono font-black text-[var(--color-text-primary)]">{formatQty(Math.ceil(kpi.remaining / data.work.remaining))}</strong> يوميًا لباقي الشهر
                    </p>
                  ) : null}
                  {kpi.overTarget ? <p className="text-xs font-bold text-[var(--color-primary-600)]">عدّيت التارجت 🎉</p> : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

    </div>
  );
}
