"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banner, Spinner } from "@/components/ui";
import { ApiError, api } from "@/lib/client";
import { formatMoney, formatPercent, formatQty } from "@/lib/calculations";
import { useMonth } from "@/components/AppShell";
import { KpiIcon } from "@/components/KpiIcon";
import { overallBandLines, pickPhrase, timeLines } from "@/lib/phrases";
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
  const [qChecks, setQChecks] = useState<Partial<Record<string, boolean>>>({});
  useEffect(() => {
    let cancelled = false;
    api<{ settings?: { quality?: { checks?: Record<string, boolean> } } }>(`/api/months/${month}`)
      .then((r) => { if (!cancelled) setQChecks(r.settings?.quality?.checks ?? {}); })
      .catch(() => { if (!cancelled) setQChecks({}); });
    return () => { cancelled = true; };
  }, [month]);

  if (loading) return <Spinner label="ثواني… بنحمّل لوحة الأداء" />;
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



  const todayQty = data.todaySummary.reduce((sum, item) => sum + item.count, 0);
  const ringLen = 251.2;
  const ringOffset = ringLen - (ringLen * Math.min(100, Math.max(0, data.overall))) / 100;
  const quickLinks = [
    { href: "/log/", label: "تسجيل بيع جديد", icon: "add_circle", primary: true },
    { href: "/target/", label: "تحديث التارجت", icon: "tune", primary: false },
  ];

  return (
    <div className="flex flex-col gap-4 bg-[#faf9fd] pb-6">
      {sync ? (
        <p className={`text-[11px] font-bold ${sync.ok ? "text-emerald-700" : "text-red-600"}`} dir="rtl">
          {sync.ok
            ? `☁️ اتبعت للمدير ${new Date(sync.at).toLocaleTimeString("en-US", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hour12: false })}`
            : `⚠️ ماتبعتش للمدير: ${sync.error ?? ""}`}
        </p>
      ) : null}

      {/* الترحيب */}
      <section className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-[22px] font-extrabold text-[#1a1b1e]">
            {greeting()} {data.profile.name.split(" ")[0]} 👋
          </h1>
          <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[#584235]">
            <span>📍 {data.profile.branch}</span>
            <span className="h-1 w-1 rounded-full bg-[#e0c0af]" />
            <span>{data.monthLabel}</span>
          </div>
        </div>
        <span className="rounded-full bg-[#ffdbc9] px-2.5 py-1 text-[11px] font-bold text-[#321200]">{statusTextEgy}</span>
      </section>

      {/* التارجت الإجمالي */}
      <section className="flex flex-col gap-3.5 rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-bold text-[#1a1b1e]">التارجت الإجمالي لشهر {data.monthLabel}</span>
          <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${onTrack === false ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${onTrack === false ? "bg-red-500" : "bg-emerald-500"}`} />
            {onTrack === null ? "—" : onTrack ? "On Track" : "متأخر"}
          </span>
        </div>
        <div className="flex items-center justify-between px-1">
          <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
            <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#efedf1" strokeWidth="9" />
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#ff7900" strokeWidth="9" strokeLinecap="round" strokeDasharray={ringLen} strokeDashoffset={ringOffset} className="transition-all duration-1000 ease-out" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[24px] font-bold leading-none text-[#1a1b1e]">{formatPercent(data.overall)}%</span>
              <span className="mt-0.5 text-[10px] text-[#584235]">محقق</span>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-2.5 pr-4">
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold text-[#1a1b1e]">{gap > 0 ? `فاضل ${formatPercent(gap)}% للوصول للتارجت الكامل` : "وصلت للتارجت الكامل ✅"}</span>
              <span className="text-[12px] text-[#8c7263]">{timeText}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#efedf1]">
              <div className="h-full rounded-full bg-[#ff7900] transition-all" style={{ width: `${Math.min(100, Math.max(0, data.overall))}%` }} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-[#ffdbc9]/40 px-3 py-2.5">
          <span className="text-[13px] font-bold text-[#1a1b1e]">💰 العمولة المتوقعة: {formatMoney(data.estimatedCommission)} ج.م</span>
          <span className="text-[11px] font-bold text-[#584235]">من {formatMoney(data.fullCommission)}</span>
        </div>
      </section>

      {/* أزرار سريعة */}
      <section className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-bold shadow-sm transition-transform active:scale-95 ${link.primary ? "bg-[#ff7900] text-white" : "bg-white text-[#1a1b1e]"}`}
          >
            <span className="material-symbols-outlined text-[18px]">{link.icon}</span>
            <span>{link.label}</span>
          </Link>
        ))}
      </section>

      {/* أداء اليوم */}
      <section className="flex flex-col gap-2.5 rounded-xl bg-white p-3.5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-[#1a1b1e]">أداء اليوم</h2>
          <span className="text-[11px] text-[#584235]">{sync?.ok ? "محدث" : "غير محدث"}</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="flex flex-col items-center rounded-lg bg-[#f4f3f7] p-2 text-center">
            <span className="text-[10px] text-[#584235]">مبيعات اليوم</span>
            <span className="mt-0.5 text-[20px] font-bold text-[#1a1b1e]">{todayQty}</span>
            <span className="text-[10px] font-bold text-[#8e4f00]">عملية</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-[#f4f3f7] p-2 text-center">
            <span className="text-[10px] text-[#584235]">إجمالي الشهر</span>
            <span className="mt-0.5 text-[20px] font-bold text-[#1a1b1e]">{data.entriesCount}</span>
            <span className="text-[10px] text-[#8c7263]">عملية</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-[#f4f3f7] p-2 text-center">
            <span className="text-[10px] text-[#584235]">المعدل اليومي</span>
            <span className="mt-0.5 text-[20px] font-bold text-[#1a1b1e]">{data.work.elapsedBeforeToday ? formatQty(Math.round((data.entriesCount / data.work.elapsedBeforeToday) * 10) / 10) : "0"}</span>
            <span className="text-[10px] text-[#8c7263]">عملية/يوم</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-[#f4f3f7] p-2 text-center">
            <span className="text-[10px] text-[#584235]">المطلوب يومياً</span>
            <span className="mt-0.5 text-[20px] font-bold text-[#9a4600]">{data.pace.perDay === null ? "—" : formatQty(Math.ceil(data.pace.perDay))}</span>
            <span className="text-[10px] font-bold text-[#ff7900]">عملية</span>
          </div>
        </div>
      </section>

      {/* المؤشرات */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-[#1a1b1e]">مؤشرات الأداء (KPIs)</h2>
          <span className="rounded-full bg-[#ffdbc9] px-2 py-0.5 text-[11px] font-bold text-[#321200]">{data.kpis.length} فئات</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {data.kpis.map((kpi) => {
            const visual = Math.min(100, Math.max(0, kpi.percent));
            const onTrackKpi = kpi.achieved >= kpi.expectedToDate;
            const isQuality = kpi.kpiKey === "quality";
            return (
              <article
                key={kpi.kpiKey}
                className={`flex flex-col justify-between gap-2 rounded-xl bg-white p-3 shadow-sm ${isQuality ? "col-span-2 flex-row items-center" : ""}`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <KpiIcon kpiKey={kpi.kpiKey} className="h-4 w-4 text-[#584235]" />
                    <span className="truncate text-[12px] font-bold text-[#1a1b1e]" dir="ltr">{kpi.nameEn}</span>
                  </div>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${onTrackKpi ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                    {formatPercent(kpi.percent)}%
                  </span>
                </div>
                <div className="flex w-full items-baseline justify-between">
                  <span className="text-[18px] font-bold text-[#1a1b1e]">{formatQty(kpi.achieved)}</span>
                  <span className="text-[11px] text-[#8c7263]">من {formatQty(kpi.target)}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#efedf1]">
                  <div className="h-full rounded-full bg-[#ff7900] transition-all" style={{ width: `${visual}%` }} />
                </div>
                <div className="flex w-full items-center justify-between pt-0.5">
                  <span className={`text-[11px] font-bold ${onTrackKpi ? "text-emerald-700" : "text-red-600"}`}>
                    {onTrackKpi ? "On Track" : `ناقص ${formatQty(Math.max(0, Math.ceil(kpi.expectedToDate - kpi.achieved)))} ${kpi.unitAr}`}
                  </span>
                  <span className="text-[10px] text-[#8c7263]">الوزن {kpi.weight}%</span>
                </div>
                {kpi.overTarget ? <p className="text-[10px] font-bold text-[#9a4600]">🎉 عدّيت التارجت</p> : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
