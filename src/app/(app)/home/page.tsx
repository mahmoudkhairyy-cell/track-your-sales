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
import { RobotMascot } from "@/components/robot-mascot";
import { ReminderBell } from "@/components/ReminderBell";
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
  return (
    <div className="tys-page orn-home mx-auto flex min-h-screen w-full max-w-6xl translate-y-0 flex-col gap-4 pb-28 opacity-100 transition-all duration-500 ease-out" style={{ animation: "tys-page-enter 500ms ease-out backwards" }}>
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

      <section className="orn-greeting orn-card" dir="rtl">
        <div><h1>{greeting()} <bdi>{data.profile.name.trim().split(/\s+/)[0]}</bdi></h1><p><span className="orn-pin" /> <bdi>{data.profile.branch}</bdi></p></div>
        <span className="flex shrink-0 items-center gap-2">
          <ReminderBell kpis={data.kpis} remainingDays={data.work.remaining} paceMessage={data.pace.message} />
          <span className="orn-avatar" aria-hidden="true">{data.profile.name.trim().charAt(0).toUpperCase() || "M"}</span>
        </span>
      </section>
      <section className="orn-monthly orn-card" aria-label="الأداء الشهري">
        <div className="orn-month-ring" role="img" aria-label={`إجمالي تحقيق التارجت ${formatPercent(data.overall)}%`}>
          <svg viewBox="0 0 200 200" aria-hidden="true">
            <path className="orn-diamond-track" d="M100 4L196 100L100 196L4 100Z" />
            <path className="orn-diamond-fill" d="M100 4L196 100L100 196L4 100Z" pathLength="100" strokeDasharray={`${Math.min(100, Math.max(0, data.overall))} 100`} />
            <path className="orn-diamond-inner" d="M100 20L180 100L100 180L20 100Z" />
            <path className="orn-diamond-corners" d="M74 4H50L4 50V74 M126 196H150L196 150V126" />
          </svg>
          <div className="orn-month-center"><span>إجمالي تحقيق التارجت</span><strong dir="ltr">{formatPercent(data.overall)}<small>%</small></strong></div>
        </div>
        <RobotMascot size={54} className="orn-mascot-home" progress={data.overall} greetOnMount />
        <div className="orn-month-side"><span className={`orn-status ${onTrack === false ? "is-behind" : ""}`}>{onTrack === null ? "مستني بيانات" : onTrack ? "على المسار" : "متأخر"}</span><div className="orn-commission"><p>الكوميشن المحقق</p><strong dir="ltr">{formatMoney(data.estimatedCommission)}</strong><small>جنيه</small></div></div>
      </section>

      {/* المطلوب */}
      <section className="orn-daily orn-card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="mt-0.5 text-sm font-extrabold text-[var(--color-text-primary)]">المطلوب النهارده</h2>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--color-primary-50)] px-2.5 py-1 text-xs font-extrabold text-[var(--color-primary-700)]">
            فاضل {formatQty(data.work.remaining)} يوم عمل
          </span>
        </div>
        <div className="orn-daily-grid">
          {data.kpis.filter((k) => k.kpiKey !== "quality" && k.remaining > 0).map((k) => {
            const dailyRequired = data.work.remaining > 0 ? Math.ceil(k.remaining / data.work.remaining) : k.remaining;
            return (
              <div
                key={k.kpiKey}
                className="orn-daily-tile"
              >
                <span className="min-w-0 truncate text-[17px] font-extrabold tracking-wide text-orange-800" dir="ltr">{k.kpiKey === "new_orange_cash" ? "Wallets" : k.nameEn}</span>
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

      <section className="orn-kpis">
        <h2 className="orn-section-title">مؤشرات الأداء</h2>
        <div className="orn-kpi-grid">
          {data.kpis.map((kpi) => {
            const onTrackKpi = kpi.achieved >= kpi.expectedToDate;
            const pct = Math.min(100, Math.max(0, kpi.percent));
            return <article key={kpi.kpiKey} className={`orn-kpi orn-card ${kpi.percent >= 100 ? "is-win" : ""}`}>
              <span className="orn-watermark"><KpiIcon kpiKey={kpi.kpiKey}/></span>
              <div className="orn-kpi-head"><div className="orn-kpi-identity"><span className="orn-kpi-icon"><KpiIcon kpiKey={kpi.kpiKey}/></span><span dir="ltr">{kpi.nameEn}</span></div><span className={`orn-status ${onTrackKpi ? "" : "is-behind"}`}>{onTrackKpi ? "على المسار" : `ناقص ${formatQty(Math.max(0, Math.ceil(kpi.expectedToDate-kpi.achieved)))}`}</span></div>
              <div className="orn-kpi-body"><div className="orn-kpi-numbers" dir="ltr"><strong>{formatQty(kpi.achieved)}</strong><span>/ {formatQty(kpi.target)}</span></div><div className="orn-kpi-ring"><svg viewBox="0 0 55 55" aria-hidden="true"><circle cx="27.5" cy="27.5" r="24"/><circle className="orn-ring-fill" cx="27.5" cy="27.5" r="24" pathLength="100" strokeDasharray={`${pct} 100`}/></svg><b>{Math.round(kpi.percent)}%</b></div></div>
              <div className="orn-track" role="progressbar" aria-label={kpi.nameEn} aria-valuenow={Math.round(kpi.percent)} aria-valuemin={0} aria-valuemax={Math.max(100,Math.round(kpi.percent))}><i style={{width:`${pct}%`}}/></div>
              <p className="orn-kpi-foot">{kpi.percent >= 100 ? <><span>✦</span> {kpi.percent > 100 ? "عدّيت التارجت، عاش!" : "حققت التارجت، عاش!"}</> : kpi.remaining > 0 && data.work.remaining > 0 ? <>محتاج <b>{formatQty(Math.ceil(kpi.remaining/data.work.remaining))}</b> يوميًا</> : <>المتبقي {formatQty(kpi.remaining)} {kpi.unitAr}</>}</p>
            </article>;
          })}
        </div>
      </section>

      {/* المساعد الذكي */}
      <section
        className="orn-card flex cursor-pointer items-center gap-3 p-4"
        role="link"
        tabIndex={0}
        onClick={() => { haptic(); router.push("/assistant"); }}
        onKeyDown={(e) => { if (e.key === "Enter") { haptic(); router.push("/assistant"); } }}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[var(--color-primary-50)] text-xl" aria-hidden="true">🤖</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold text-[var(--color-text-primary)]">المساعد الذكي</span>
          <span className="mt-0.5 block text-xs leading-5 text-[var(--color-text-secondary)]">عندك سؤال عن باقة أو عرض أو إجراء؟ اسأل هنا وخد إجابة فورية.</span>
        </span>
        <span className="text-lg text-[var(--color-text-muted)]" aria-hidden="true">‹</span>
      </section>
    </div>
  );
}
