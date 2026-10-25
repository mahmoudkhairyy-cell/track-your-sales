"use client";

import { useEffect, useState } from "react";
import { Banner, Spinner } from "@/components/ui";
import { ApiError, api } from "@/lib/client";
import { formatMoney, formatPercent, formatQty } from "@/lib/calculations";
import { useMonth } from "@/components/AppShell";
import { kpiEmoji } from "@/lib/constants";
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
  settingsSaved: boolean;
  kpis: KpiRow[];
  overall: number;
  estimatedCommission: number;
  fullCommission: number;
  weightSum: number;
  weightWarning: boolean;
  empty: boolean;
  entriesCount: number;
  work: { total: number; elapsed: number; remaining: number };
  pace: { remaining: number; remainingDays: number; perDay: number | null; message: string };
};

function ScoreRing({ value }: { value: number }) {
  const visual = Math.min(100, Math.max(0, value));
  const radius = 48;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (visual / 100) * circ;
  return (
    <svg viewBox="0 0 130 130" className="h-32 w-32 shrink-0">
      <circle cx="65" cy="65" r={radius} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="12" />
      <circle
        cx="65"
        cy="65"
        r={radius}
        fill="none"
        stroke="#fff"
        strokeWidth="12"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 65 65)"
      />
      <text x="65" y="62" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="800">
        {Math.round(visual)}%
      </text>
      <text x="65" y="80" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="10">
        الإنجاز
      </text>
    </svg>
  );
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Africa/Cairo" }).format(new Date()));
  if (hour >= 5 && hour < 12) return "صباح الخير يا";
  if (hour >= 12 && hour < 18) return "نهارك سعيد يا";
  return "مساء الخير يا";
}

export default function HomePage() {
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

  const newLines = data.kpis.find((kpi) => kpi.kpiKey === "new_lines");
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

      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#ff9a3c] via-[#ff7900] to-[#e85d00] p-6 text-white shadow-[0_20px_50px_rgba(255,121,0,0.35)] ring-1 ring-white/30">
        <div className="pointer-events-none absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
        <div className="flex items-center gap-4">
          <ScoreRing value={data.overall} />
          <div className="flex-1">
            <p className="text-sm font-bold text-white/90">إجمالي التارجت الشهري</p>
            <p className="mt-1 text-4xl font-black">{formatPercent(data.overall)}%</p>
            <p className="text-sm text-white/80">{gap > 0 ? `فاضل ${formatPercent(gap)}%` : "مفيش فاضل، قفلت الشهر"}</p>
            <p className="mt-2 text-sm font-extrabold text-white">{statusTextEgy}</p>
            <div className="mt-2 inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-[#ff7900]">
              💰 كوميشنك: {formatMoney(data.estimatedCommission)} من {formatMoney(data.fullCommission)} جنيه
            </div>
          </div>
        </div>
      </section>

      <article className="grid grid-cols-2 gap-2 rounded-[24px] border border-orange-100/70 bg-white p-2.5 shadow-[0_8px_20px_rgba(255,121,0,0.06)]">
        <div className="rounded-2xl bg-orange-50/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-500">الخطوط المحققة</span>
            <span className="text-sm">📱</span>
          </div>
          <p className="mt-1 text-xl font-black">{formatQty(newLines?.achieved ?? 0)}</p>
          <p className="text-[10px] text-neutral-400">من {formatQty(newLines?.target ?? 0)}</p>
        </div>
        <div className="rounded-2xl bg-orange-50/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-500">المتبقي للخطوط</span>
            <span className="text-sm">🎯</span>
          </div>
          <p className="mt-1 text-xl font-black">{formatQty(newLines?.remaining ?? 0)}</p>
          <p className="text-[10px] text-neutral-400">خط</p>
        </div>
      </article>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-[20px] border border-orange-100/70 bg-white p-3 text-center shadow-[0_6px_18px_rgba(255,121,0,0.06)]">
          <p className="text-[10px] font-bold text-neutral-500">المطلوب يوميًا</p>
          <p className="mt-1 text-lg font-black text-[#c45e00]">{data.pace.perDay === null ? "—" : formatQty(Math.ceil(data.pace.perDay))}</p>
        </div>
        <div className="rounded-[20px] border border-orange-100/70 bg-white p-3 text-center shadow-[0_6px_18px_rgba(255,121,0,0.06)]">
          <p className="text-[10px] font-bold text-neutral-500">أيام شغل فاضلة</p>
          <p className="mt-1 text-lg font-black text-neutral-900">{data.work.remaining}</p>
        </div>
        <div className="rounded-[20px] border border-orange-100/70 bg-white p-3 text-center shadow-[0_6px_18px_rgba(255,121,0,0.06)]">
          <p className="text-[10px] font-bold text-neutral-500">المتوقع للنهارده</p>
          <p className="mt-1 text-lg font-black text-neutral-900">{formatPercent(expectedPercent)}%</p>
        </div>
      </div>

      {data.pace.message ? <p className="px-1 text-xs leading-6 text-neutral-500">{data.pace.message}</p> : null}

      {data.weightWarning ? (
        <Banner tone="warn">⚠️ مجموع الأوزان {formatPercent(data.weightSum)}% مش 100%. راجع صفحة التارجت.</Banner>
      ) : null}


      <section className="rounded-[28px] border border-orange-100/70 bg-white p-5 shadow-[0_10px_30px_rgba(255,121,0,0.08)]">
        <div className="flex items-end justify-between">
          <p className="text-sm font-black text-neutral-800">نسبة الإنجاز لكل مؤشر</p>
          <p className="text-xs text-neutral-400">{data.kpis.length} مؤشر</p>
        </div>
        <div className="mt-4 flex h-36 items-end justify-around gap-2">
          {data.kpis.map((kpi) => {
            const h = Math.min(100, Math.max(4, kpi.percent));
            return (
              <div key={kpi.kpiKey} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] font-extrabold text-[#c45e00]">{Math.round(kpi.percent)}%</span>
                <div className="w-full max-w-[28px] rounded-t-xl bg-gradient-to-t from-[#e85d00] to-[#ff9a3c] transition-all" style={{ height: `${h}%` }} />
                <span className="w-full truncate text-center text-[9px] text-neutral-500" dir="ltr">{kpi.nameEn}</span>
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
            <article key={kpi.kpiKey} className="rounded-[20px] bg-white p-3.5 shadow-[0_6px_20px_rgba(255,121,0,0.07)] ring-1 ring-orange-100/70">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-lg">{kpiEmoji(kpi.kpiKey)}</span>
                  <div>
                    <h3 className="font-extrabold text-neutral-900" dir="ltr">
                      {kpi.nameEn}
                    </h3>
                    <p className={`text-xs font-bold ${moodColor}`}>
                      {m.emoji} {m.text}
                    </p>
                  </div>
                </div>
                <p className="text-lg font-black text-[#ff7900]">{formatPercent(kpi.percent)}%</p>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-neutral-500">المستهدف: {formatQty(kpi.target)}</span>
                <span className="font-bold">المحقق: {formatQty(kpi.achieved)}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-gradient-to-r from-[#ff9a3c] to-[#e85d00] transition-all" style={{ width: `${visual}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs font-bold">
                <span className="text-[#ff7900]">مساهمة: {formatPercent(kpi.contribution)}%</span>
                <span className="text-neutral-400">الوزن: {kpi.weight}%</span>
              </div>
              <p className="mt-1 text-[11px] text-neutral-400">
                المفروض تكون عند {formatQty(kpi.expectedToDate)} {kpi.unitAr} دلوقتي · فاضل {formatQty(kpi.remaining)}
              </p>
              {kpi.overTarget ? <p className="mt-2 text-xs font-bold text-[#ff7900]">🎉 عدّيت التارجت! الشريط واقف عند 100% بس الرقم الحقيقي ظاهر فوق.</p> : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
