"use client";

import { useEffect, useState } from "react";
import { Banner, Spinner } from "@/components/ui";
import { ApiError, api } from "@/lib/client";
import { formatMoney, formatPercent, formatQty } from "@/lib/calculations";
import { useMonth } from "@/components/AppShell";
import { KpiIcon } from "@/components/KpiIcon";
import { kpiMood } from "@/lib/motivation";

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

function shortKpiName(name: string) {
  return SHORT_KPI_NAMES[name] ?? name;
}

export default function HomePage() {
  const [copied, setCopied] = useState(false);
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
  const expectedPercent = data.work.total > 0 ? (data.work.elapsed / data.work.total) * 100 : 0;
  const statusTextEgy =
    data.overall >= 100
      ? "قفلت التارجت يا وحش 🏆 كمّل بنفس الروح"
      : data.overall >= 80
        ? "إنت على آخر خطوة! يلا يا بطل"
      : data.overall >= expectedPercent + 5
        ? "ماشي تمام جدًا، كمّل كده 💪"
        : data.overall >= expectedPercent - 5
          ? "إنت ماشي على الخط، شد حيلك 👊"
          : "لازم نزوّد شوية النهارده 🔥 ابدأ بالأهم";



  return (
    <div className="space-y-5">
      <section className="text-right">
        <p className="text-sm font-extrabold text-neutral-700">
          {greeting()} {data.profile.name.split(" ")[0]} 👋
        </p>
        <p className="text-[11px] text-neutral-400">📍 {data.profile.branch}</p>
      </section>

      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#f0802a] via-[#e06600] to-[#b84700] p-6 text-white shadow-[0_20px_50px_rgba(190,90,0,0.35)] ring-1 ring-white/30">
        <div className="pointer-events-none absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/15" />
        <p className="text-sm font-bold text-white/90">إجمالي التارجت الشهري</p>
        <p className="mt-1 text-5xl font-black tabular-nums tracking-tight">{formatPercent(data.overall)}%</p>
        <p className="mt-1 text-sm font-extrabold text-white">{statusTextEgy}</p>
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

      <h2 className="text-xl font-black">مؤشرات الأداء</h2>
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
                      {m.emoji} {m.text}
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
    </div>
  );
}
