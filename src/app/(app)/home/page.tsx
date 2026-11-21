"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
import { Rope, SpaceScene } from "@/components/Rope";
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
  useEffect(() => {
    const valueNode = overallValueRef.current;
    const barNode = overallBarRef.current;
    if (!valueNode || !barNode) return;

    const target = data ? Math.min(200, Math.max(0, data.overall)) : 0;
    // احترام تقليل الحركة: القيمة النهائية تتعرض فورًا من غير أنيميشن.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      valueNode.textContent = formatPercent(target);
      barNode.style.width = `${Math.min(100, target)}%`;
      return;
    }
    const duration = 1400;
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
        <p className={`tys2-sync ${sync.ok ? "tys2-sync-ok" : "tys2-sync-bad"}`} dir="rtl">
          {sync.ok
            ? `☁️ اتبعت للمدير ${new Date(sync.at).toLocaleTimeString("en-US", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hour12: false })}`
            : `⚠️ مااتبعتش للمدير: ${sync.error ?? ""}. `}
          {sync.ok ? null : (
            <button type="button" onClick={() => void pushReport()} className="tys2-sync-retry min-h-8 font-black">
              جرّب تبعت تاني
            </button>
          )}
        </p>
      ) : null}

      <section className="tys-home-greeting tys2-greet flex items-end justify-between gap-3 px-4 py-4 sm:px-5" dir="rtl">
        <div className="min-w-0">
          <p className="tys2-greet-kicker">YOUR SALES OVERVIEW</p>
          <h1 className="tys2-greet-title mt-1">
            {greeting()} {data.profile.name.split(" ")[0]} 👋
          </h1>
          <p className="tys2-greet-branch mt-1">📍 {data.profile.branch}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="tys2-greet-icon hidden h-12 w-12 items-center justify-center text-2xl sm:flex">📈</div>
        </div>
      </section>

      {/* الهيرو الرئيسي — كرت الحبر + مسار الشهر */}
      <section className="tys-home-hero tys2-hero relative isolate overflow-hidden p-5 sm:p-7">
        <div className="tys2-hero-glow-a" />
        <div className="tys2-hero-glow-b" />
        <SpaceScene pct={data.overall} />
        <div className="tys-hero-body relative">
          <div className="tys2-hero-head flex items-center justify-between gap-3 pb-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="tys2-hero-mark flex h-9 w-9 shrink-0 items-center justify-center text-lg">◎</span>
              <div className="min-w-0">
                <p className="tys2-hero-kicker">MONTHLY PERFORMANCE</p>
                <p className="tys2-hero-title mt-0.5">إجمالي التارجت الشهري</p>
              </div>
            </div>
            <span className={`tys2-badge shrink-0 ${onTrack === null ? "" : onTrack ? "tys2-badge-good" : "tys2-badge-bad"}`}>
              <span className="tys2-badge-dot" />
              {onTrack === null ? "Waiting for data" : onTrack ? "On track" : "Behind"}
            </span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3 py-4 sm:py-5">
            <div className="min-w-0">
              <p className="tys2-hero-label">نسبة تحقيقك للتارجت</p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="tys2-hero-num" ref={overallValueRef}>{formatPercent(0)}</span>
                <span className="tys2-hero-pct">%</span>
              </div>
            </div>
            <div className="tys2-comm inline-flex max-w-full shrink-0 flex-col items-end">
              <span className="tys2-comm-label">الكوميشن المحقق</span>
              <strong className={`tys2-comm-value truncate ${data.overall < 80 ? "tys2-comm-low" : "tys2-comm-ok"}`}>{formatMoney(data.estimatedCommission)} جنيه</strong>
            </div>
          </div>
          <div>
            <Rope pct={data.overall} label="نسبة تحقيق التارجت" />
            <div className="tys2-track">
              <div className="tys-bar tys2-bar relative h-2.5 overflow-hidden rounded-full">
                <div ref={overallBarRef} className="tys2-bar-fill h-full rounded-full" style={{ width: "0%" }} />
              </div>
              {typeof data.expectedOverall === "number" ? (
                <span
                  className="tys2-track-mark"
                  style={{ insetInlineStart: `${Math.min(100, Math.max(0, data.expectedOverall))}%` }}
                  aria-hidden="true"
                />
              ) : null}
            </div>
            <div className="tys2-scale mt-1 flex justify-between" dir="ltr">
              <span>100% target</span><span>0%</span>
            </div>
            {typeof data.expectedOverall === "number" ? (
              <p className="tys2-track-note mt-1.5">
                الخط المنقّط على المسار = المطلوب لحد النهارده <strong>{formatPercent(data.expectedOverall)}%</strong>
              </p>
            ) : null}
          </div>
          <div className="tys2-phrase mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
            <b>{statusTextEgy}</b>{statusTextEgy && timeText ? <span aria-hidden="true">•</span> : null}<span>{timeText}</span>
          </div>

          {data.projection ? (
            <p className="tys2-projection mt-3">
              لو كملت بنفس معدل آخر {data.projection.basisDays} أيام شغل، هتخلّص الشهر على تقريبًا{" "}
              <strong>{formatPercent(data.projection.overall)}%</strong>
              {" "}وكوميشن حوالي{" "}
              <strong>{formatMoney(data.projection.commission)}</strong> جنيه.
            </p>
          ) : null}

          {data.entriesCount > 0 ? (
            <button
              type="button"
              onClick={() => void shareAchievement({ monthLabel: data.monthLabel, percent: Math.round(data.overall), commission: formatMoney(data.estimatedCommission) })}
              className={`tys2-share mt-3 ${data.overall >= 100 ? "tys2-share-done" : ""}`}
            >
              📤 شارك إنجازك
            </button>
          ) : null}

          {sarcastic ? <p className="tys2-sarc mt-3">{sarcastic}</p> : null}
        </div>
      </section>

      {/* المطلوب */}
      <section className="tys-home-daily tys2-daily p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="tys2-sec-kicker">DAILY</p>
            <h2 className="tys2-sec-title mt-0.5">المطلوب كل يوم</h2>
          </div>
          <span className="tys2-pill shrink-0">
            فاضل {formatQty(data.work.remaining)} يوم عمل
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {data.kpis.filter((k) => k.kpiKey !== "quality" && k.remaining > 0).map((k) => {
            const dailyRequired = data.work.remaining > 0 ? Math.ceil(k.remaining / data.work.remaining) : k.remaining;
            return (
              <div
                key={k.kpiKey}
                className="tys2-daily-cell flex min-h-[46px] min-w-0 items-center justify-between gap-2 px-2.5 py-1.5"
              >
                <span className="tys2-daily-name min-w-0 truncate" dir="ltr">{k.nameEn}</span>
                <strong className="tys2-daily-value shrink-0 leading-none">
                  {formatQty(dailyRequired)}
                </strong>
              </div>
            );
          })}
          {data.kpis.filter((k) => k.kpiKey !== "quality").every((k) => k.remaining <= 0) ? (
            <p className="tys2-daily-done col-span-full px-3 py-2 text-center text-xs font-extrabold">كل المؤشرات مكتملة ✓</p>
          ) : null}
        </div>
      </section>

      {/* المؤشرات */}
      <section className="tys-home-kpis tys2-kpis flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="tys2-sec-title">مؤشرات الأداء (KPIs)</h2>
          <span className="tys2-sec-meta shrink-0">{data.kpis.length} مؤشر</span>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {data.kpis.map((kpi, kpiIndex) => {
            const onTrackKpi = kpi.achieved >= kpi.expectedToDate;
            const ringLen = 2 * Math.PI * 18;
            const pct = Math.min(100, Math.max(0, kpi.percent));
            return (
              <article key={kpi.kpiKey} style={{ animationDelay: `${kpiIndex * 100}ms` }} className={`tys-rise tys-home-kpi tys2-kpi flex min-w-0 items-center gap-2.5 p-3 sm:gap-3 ${kpi.percent >= 100 ? "tys2-kpi-done" : ""}`}>
                <div className="tys-ring relative h-12 w-12 shrink-0 sm:h-14 sm:w-14">
                  <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90">
                    <circle cx="22" cy="22" r="18" fill="none" stroke="var(--tys2-line)" strokeWidth="4" />
                    <circle
                      cx="22"
                      cy="22"
                      r="18"
                      fill="none"
                      stroke={onTrackKpi ? "var(--color-success-ring)" : "var(--color-danger-text)"}
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={ringLen}
                      strokeDashoffset={ringLen * (1 - pct / 100)}
                      className="transition-all duration-700"
                    />
                  </svg>
                  <span className="tys2-kpi-ring-num absolute inset-0 flex items-center justify-center">{Math.round(kpi.percent)}%</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span dir="rtl" className="flex min-w-0 items-center gap-1.5">
                      <span className="tys2-kpi-icon inline-flex shrink-0 items-center justify-center p-1.5">
                        <KpiIcon kpiKey={kpi.kpiKey} className="h-5 w-5" />
                      </span>
                      <span className="tys2-kpi-name truncate" dir="ltr">{kpi.nameEn}</span>
                    </span>
                    <span className={`tys2-tag shrink-0 ${onTrackKpi ? "tys2-tag-good" : "tys2-tag-bad"}`}>
                      {onTrackKpi ? "On Track" : `ناقص ${formatQty(Math.max(0, Math.ceil(kpi.expectedToDate - kpi.achieved)))}`}
                    </span>
                  </div>
                  <div className="tys2-kpi-stats flex items-center justify-between">
                    <span>
                      <strong>{formatQty(kpi.achieved)}</strong> / {formatQty(kpi.target)}
                    </span>
                    <span>المتبقي <strong>{formatQty(kpi.remaining)}</strong></span>
                  </div>
                  <Rope pct={pct} label={kpi.nameEn} />
                  <div className="tys-bar tys2-kpi-bar h-1.5 w-full overflow-hidden rounded-full">
                    <div className="tys2-kpi-fill h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  {kpi.series && kpi.series.length >= 2 ? (
                    <div className="flex justify-end">
                      <DeltaChip current={kpi.achieved} previous={kpi.previousToDate ?? null} />
                    </div>
                  ) : null}
                  {!kpi.overTarget && kpi.remaining > 0 && data.work.remaining > 0 ? (
                    <p className="tys2-kpi-need">
                      محتاج {formatQty(Math.ceil(kpi.remaining / data.work.remaining))} يوميًا لباقي الشهر
                    </p>
                  ) : null}
                  {kpi.overTarget ? <p className="tys2-kpi-over">عدّيت التارجت 🎉</p> : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

    </div>
  );
}