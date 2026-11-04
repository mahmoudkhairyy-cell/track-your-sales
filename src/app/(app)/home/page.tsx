"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Banner, Spinner } from "@/components/ui";
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



  const ringLen = 251.2;
  const ringOffset = ringLen - (ringLen * Math.min(100, Math.max(0, data.overall))) / 100;
  const sarcastic = sarcasticLine(data.overall);

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-[#faf5e8] pb-28">
      {sync ? (
        <p className={`text-[11px] font-bold ${sync.ok ? "text-emerald-700" : "text-red-600"}`} dir="rtl">
          {sync.ok
            ? `☁️ اتبعت للمدير ${new Date(sync.at).toLocaleTimeString("en-US", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hour12: false })}`
            : `⚠️ ماتبعتش للمدير: ${sync.error ?? ""}`}
        </p>
      ) : null}

      <section className="flex flex-col gap-1">
        <h1 className="text-lg font-black text-[#1a1b1e]">
          {greeting()} {data.profile.name.split(" ")[0]} 👋
        </h1>
        <p className="text-[11px] text-[#584235]">📍 {data.profile.branch}</p>
      </section>

      {/* الهيرو */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FF7900] via-[#FF8510] to-[#E05300] p-5 text-white shadow-[0_10px_25px_-5px_rgba(255,121,0,0.3)]">
        <div className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-bold text-orange-100">
              <span
                aria-label={onTrack === null ? "" : onTrack ? "على المسار" : "متأخر عن المسار"}
                className={`inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white/60 ${onTrack === null ? "hidden" : onTrack ? "bg-emerald-400" : "bg-red-500"}`}
              />
              إجمالي التارجت الشهري
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2.5 py-0.5 text-[11px] font-bold backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-sm" />
              Live Run
            </span>
          </div>
          <div className="flex items-end justify-between">
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-5xl font-black tracking-tight">{formatPercent(data.overall)}</span>
              <span className="text-2xl font-bold text-orange-200">%</span>
            </div>
            <div className="max-w-[210px] text-right">
              <div className="inline-block rounded-xl border border-white/25 bg-white/20 px-3 py-1 text-[11px] font-bold">{statusTextEgy}</div>
              <p className="mt-1 text-[10px] font-medium text-orange-100">{timeText}</p>
            </div>
          </div>
          <div className="h-3.5 w-full rounded-full bg-black/25 p-0.5 shadow-inner">
            <div className="relative h-full rounded-full bg-gradient-to-r from-amber-200 to-white transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, data.overall))}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-white/15 pt-2.5">
            <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-black/15 p-2.5">
              <span className="text-[11px] font-medium text-orange-100">{gap > 0 ? "فاضل" : "الحالة"}</span>
              <span className="mt-0.5 text-base font-black font-mono">{gap > 0 ? `${formatPercent(gap)}%` : "قفلت الشهر ✅"}</span>
            </div>
            <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-black/15 p-2.5">
              <span className="text-[11px] font-medium text-orange-100">الكوميشن المتوقع</span>
              <span className="mt-0.5 text-base font-black font-mono">
                {formatMoney(data.estimatedCommission)} <span className="text-[10px] text-orange-200">من {formatMoney(data.fullCommission)} ج.م</span>
              </span>
            </div>
          </div>
          <p className="text-xs font-bold text-orange-100">{overallLine()}</p>
          {sarcastic ? <p className="text-xs font-bold text-orange-100/80">{sarcastic}</p> : null}
        </div>
      </section>

      {/* المطلوب انهاردة */}
      <section className="flex items-stretch overflow-hidden rounded-2xl border border-orange-200/80 bg-white shadow-sm">
        <div className="flex w-24 shrink-0 flex-col items-center justify-center bg-gradient-to-br from-[#FF7900] to-[#E05300] px-2 py-3 text-white">
          <span className="font-mono text-3xl font-black leading-none">{data.pace.perDay === null ? "—" : formatQty(Math.ceil(data.pace.perDay))}</span>
          <span className="mt-1 text-[10px] font-bold text-orange-100">{data.pace.perDay === null ? "" : linesWord(Math.ceil(data.pace.perDay)) + " / يوم"}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-3.5">
          <span className="flex items-center gap-1.5 text-xs font-black text-slate-900">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF7900]" />
            المطلوب انهاردة عشان تفضل On Track
          </span>
          <span className="text-[11px] font-semibold leading-relaxed text-slate-600">{data.pace.message}</span>
        </div>
      </section>

      {/* نسبة الإنجاز بالمحاور */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-slate-800">
            <span>نسبة الإنجاز بالمحاور</span>
            <span className="rounded border border-orange-200 bg-orange-50 px-1.5 text-[11px] font-bold text-[#e06600]">{data.kpis.length} مؤشرات</span>
          </h2>
          <span className="text-[11px] font-bold text-slate-400">اسحب ←</span>
        </div>
        <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1 pt-0.5">
          {data.kpis.map((kpi) => {
            const ok = kpi.achieved >= kpi.expectedToDate;
            return (
              <div key={kpi.kpiKey} className="flex w-24 shrink-0 flex-col items-center rounded-2xl border border-slate-200/80 bg-white p-2.5 text-center shadow-sm">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-mono text-xs font-black ${ok ? "border-emerald-500 text-emerald-700" : "border-[#ff7900] text-[#9a4600]"}`}>
                  {Math.round(kpi.percent)}%
                </div>
                <span className="mt-1.5 w-full truncate text-[11px] font-bold text-slate-800" dir="ltr">{shortKpiName(kpi.nameEn)}</span>
                <span className={`mt-0.5 text-[9px] font-extrabold ${ok ? "text-emerald-600" : "text-red-600"}`}>{ok ? "On Track" : "متأخر"}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* المؤشرات */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black tracking-tight text-slate-900">مؤشرات الأداء (KPIs)</h2>
          <span className="text-xs font-bold text-[#e06600]">تحديث فوري ⚡</span>
        </div>
        {data.kpis.map((kpi) => {
          const visual = Math.min(100, Math.max(0, kpi.percent));
          const onTrackKpi = kpi.achieved >= kpi.expectedToDate;
          return (
            <article key={kpi.kpiKey} className={`rounded-2xl border p-3.5 shadow-sm ${kpi.achieved >= kpi.expectedToDate ? "border-emerald-200/80 bg-emerald-50/70" : "border-red-200/80 bg-red-50/70"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-100 bg-orange-50 text-[#e06600]">
                    <KpiIcon kpiKey={kpi.kpiKey} className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="flex items-center gap-1.5 text-sm font-black text-slate-800" dir="ltr">
                      {kpi.nameEn}
                      <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${onTrackKpi ? "border-emerald-200/60 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-600"}`}>
                        {onTrackKpi ? "On Track ●" : `ناقص ${formatQty(Math.max(0, Math.ceil(kpi.expectedToDate - kpi.achieved)))}`}
                      </span>
                    </h3>
                    <span className="text-[10px] font-semibold text-slate-400">الوزن النسبي: {kpi.weight}%</span>
                  </div>
                </div>
                <span className="font-mono text-xl font-black text-slate-900">{formatPercent(kpi.percent)}<span className="text-xs font-bold text-slate-500">%</span></span>
              </div>
              <div className="my-2.5 grid grid-cols-3 gap-2 rounded-xl bg-slate-50/80 p-2 text-center text-xs">
                <div>
                  <span className="block text-[10px] font-medium text-slate-400">المستهدف</span>
                  <span className="font-mono font-bold text-slate-700">{formatQty(kpi.target)}</span>
                </div>
                <div className="border-x border-slate-200/70">
                  <span className="block text-[10px] font-bold text-[#e06600]">المحقق</span>
                  <span className="font-mono font-extrabold text-[#e06600]">{formatQty(kpi.achieved)}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-medium text-slate-400">الباقي</span>
                  <span className="font-mono font-bold text-rose-600">{formatQty(kpi.remaining)}</span>
                </div>
              </div>
              <div className="mb-2 h-2 w-full rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-[#ff7900] transition-all" style={{ width: `${visual}%` }} />
              </div>
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                <span>المفروض تكون عند <strong className="font-bold text-slate-700">{formatQty(kpi.expectedToDate)} {kpi.unitAr}</strong> دلوقتي</span>
                <span className="font-bold text-amber-600">مساهمة: {formatPercent(kpi.contribution)}%</span>
              </div>
              {kpi.kpiKey === "new_lines" && kpi.percent >= 5 && kpi.percent < 90 ? <p className="mt-1 text-[10px] font-bold text-[#e06600]">🔹 وصلت لـ 5% من الخطوط، كمّل عشان توصل 90%.</p> : null}
              {kpi.overTarget ? <p className="mt-1 text-[10px] font-bold text-[#e06600]">🎉 عدّيت التارجت! الشريط واقف عند 100% بس الرقم الحقيقي ظاهر فوق.</p> : null}
            </article>
          );
        })}
      </section>

      {/* زرار التسجيل العايم */}
      <div className="pointer-events-none fixed bottom-20 left-1/2 z-40 flex w-full max-w-[440px] -translate-x-1/2 justify-center px-4">
        <Link href="/log/" className="pointer-events-auto flex items-center gap-2 rounded-full border-2 border-white bg-gradient-to-r from-[#ff7900] to-[#FF9100] px-6 py-2.5 text-sm font-black text-white shadow-[0_10px_25px_-5px_rgba(255,121,0,0.3)] transition-transform active:scale-95">
          <span className="text-lg">＋</span>
          <span>تسجيل بيعة جديدة</span>
        </Link>
      </div>
    </div>
  );
}
