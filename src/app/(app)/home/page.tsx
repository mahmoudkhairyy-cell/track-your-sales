"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banner, EmptyState, Spinner } from "@/components/ui";
import { ApiError, api } from "@/lib/client";
import { formatMoney, formatPercent, formatQty } from "@/lib/calculations";
import { useMonth } from "@/components/AppShell";
import { kpiEmoji } from "@/lib/constants";
import { MOOD_STYLES, kpiMood, overallMood } from "@/lib/motivation";

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

const STATUS_BADGE: Record<ReturnType<typeof overallMood>["tone"], string> = {
  celebrate: "قفلت التارجت",
  ahead: "متقدم",
  ontrack: "على الخطة",
  behind: "متأخر شوية",
  danger: "متأخر جامد",
  empty: "شهر جديد",
};

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Africa/Cairo" }).format(new Date()),
  );
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
  const mood = overallMood({
    overall: data.overall,
    expectedPercent,
    empty: data.empty,
    remainingDays: data.work.remaining,
  });
  const moodStyle = MOOD_STYLES[mood.tone];

  const behindKpis = data.kpis.filter((kpi) => kpi.weight > 0 && kpi.percent < 100 && kpi.remaining > 0);

  return (
    <div className="space-y-5">
      <section className="text-center">
        <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-extrabold ${moodStyle.box} ${moodStyle.title}`}>
          {mood.emoji} {STATUS_BADGE[mood.tone]}
        </span>
        <h1 className="mt-2 text-[1.65rem] font-black leading-10 text-neutral-900">
          {greeting()} {data.profile.name.split(" ")[0]} 👋
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          📍 {data.profile.branch} · {data.monthLabel}
        </p>
      </section>

      <section className="flex items-center gap-4 rounded-[18px] bg-white p-4 shadow-[0_8px_24px_rgba(255,121,0,0.06)]">
        <ScoreRing value={data.overall} />
        <div className="flex-1">
          <p className="text-sm font-bold text-neutral-500">إجمالي التارجت الشهري</p>
          <p className="mt-1 text-3xl font-black text-neutral-900">{formatPercent(data.overall)}%</p>
          <p className="text-sm text-neutral-500">{gap > 0 ? `فاضل ${formatPercent(gap)}%` : "مفيش فاضل، قفلت الشهر"}</p>
          <p className="mt-2 text-xs font-bold text-[#ff7900]">
            💰 كوميشنك: {formatMoney(data.estimatedCommission)} من {formatMoney(data.fullCommission)} جنيه
          </p>
        </div>
      </section>

      <section className={`rounded-[24px] border p-4 ${moodStyle.box}`}>
        <p className={`text-base font-black ${moodStyle.title}`}>
          {mood.emoji} {mood.headline}
        </p>
        <p className={`mt-1 text-sm leading-7 ${moodStyle.text}`}>{mood.detail}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-white/70 p-2">
            <p className="text-lg font-black text-neutral-900">{data.work.total}</p>
            <p className="text-[11px] text-neutral-500">أيام الشغل</p>
          </div>
          <div className="rounded-2xl bg-white/70 p-2">
            <p className="text-lg font-black text-neutral-900">{data.work.elapsed}</p>
            <p className="text-[11px] text-neutral-500">عدّت</p>
          </div>
          <div className="rounded-2xl bg-white/70 p-2">
            <p className="text-lg font-black text-neutral-900">{data.work.remaining}</p>
            <p className="text-[11px] text-neutral-500">فاضلة</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-500">المتوقع لحد النهارده: {formatPercent(expectedPercent)}%</p>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <article className="rounded-[24px] bg-white p-4 shadow-[0_8px_24px_rgba(255,121,0,0.06)]">
          <p className="text-sm font-bold text-neutral-500">📱 الخطوط اللي عملتها</p>
          <p className="mt-2 text-3xl font-black">{formatQty(newLines?.achieved ?? 0)}</p>
          <p className="text-xs text-neutral-400">من {formatQty(newLines?.target ?? 0)}</p>
        </article>
        <article className="rounded-[24px] bg-white p-4 shadow-[0_8px_24px_rgba(255,121,0,0.06)]">
          <p className="text-sm font-bold text-neutral-500">🎯 الفاضل في الخطوط</p>
          <p className="mt-2 text-3xl font-black">{formatQty(newLines?.remaining ?? 0)}</p>
          <p className="text-xs text-neutral-400">خط</p>
        </article>
      </div>

      {data.weightWarning ? (
        <Banner tone="warn">⚠️ مجموع الأوزان {formatPercent(data.weightSum)}% مش 100%. راجع صفحة التارجت.</Banner>
      ) : null}

      <section className="rounded-[24px] bg-orange-50 p-4 text-sm leading-7 text-[#c45e00]">
        <p className="font-extrabold">⚡ المطلوب منك النهارده عشان تفضل ON TRACK:</p>
        {behindKpis.length === 0 ? (
          <p className="mt-1 font-bold">كل المؤشرات تمام. مفيش حاجة ضاغطة النهارده 👌</p>
        ) : data.work.remaining <= 0 ? (
          <p className="mt-1 font-bold">أيام الشغل خلصت. اللي فاضل: {behindKpis.map((k) => `${kpiEmoji(k.kpiKey)} ${k.nameEn} ${formatQty(k.remaining)}`).join(" · ")}</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {behindKpis.map((kpi) => (
              <li key={kpi.kpiKey} className="flex items-center justify-between gap-2">
                <span className="font-bold">
                  {kpiEmoji(kpi.kpiKey)} {kpi.nameEn}
                </span>
                <span className="font-black">
                  {formatQty(Math.ceil(kpi.remaining / data.work.remaining))} {kpi.unitAr} — فاضل {formatQty(kpi.remaining)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.empty ? (
        <EmptyState
          title="ابدأ الشهر بقوة 🚀"
          text="لسه مفيش سجلات الشهر ده. الأرقام اللي تحت من إعدادات التارجت بس، والمحقق صفر عشان مفيش عمليات محفوظة."
          action={
            <Link href={`/log?month=${month}`} className="inline-flex min-h-12 items-center rounded-full bg-[#ff7900] px-5 font-extrabold text-white">
              ➕ سجّل أول إنجاز
            </Link>
          }
        />
      ) : (
        <p className="text-sm text-neutral-500">عدد العمليات المحفوظة الشهر ده: {data.entriesCount}</p>
      )}

      <h2 className="text-xl font-black">مؤشرات الأداء</h2>
      <div className="grid grid-cols-2 gap-3">
        {data.kpis.map((kpi) => {
          const visual = Math.min(100, Math.max(0, kpi.percent));
          const kpiExpected = kpi.target > 0 ? (kpi.expectedToDate / kpi.target) * 100 : 0;
          const m = kpiMood({ percent: kpi.percent, expectedPercent: kpiExpected, weight: kpi.weight });
          const moodColor =
            m.tone === "good" ? "text-emerald-700" : m.tone === "warn" ? "text-yellow-700" : m.tone === "bad" ? "text-red-600" : "text-neutral-400";
          return (
            <article key={kpi.kpiKey} className="rounded-[18px] bg-white p-3 shadow-[0_8px_24px_rgba(255,121,0,0.06)]">
              <div className="flex items-center justify-between">
                <span className="text-xl">{kpiEmoji(kpi.kpiKey)}</span>
                <p className="text-sm font-black text-[#ff7900]">{formatPercent(kpi.percent)}%</p>
              </div>
              <h3 className="mt-2 text-sm font-extrabold text-neutral-900" dir="ltr">
                {kpi.nameEn}
              </h3>
              <p className="mt-1 text-lg font-black text-neutral-900">
                {formatQty(kpi.achieved)}
                <span className="text-xs font-normal text-neutral-400"> / {formatQty(kpi.target)}</span>
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-[#ff7900]" style={{ width: `${visual}%` }} />
              </div>
              <p className={`mt-2 text-[11px] font-bold ${moodColor}`}>
                {m.emoji} {m.text}
              </p>
              <p className="text-[11px] text-neutral-400">فاضل {formatQty(kpi.remaining)} {kpi.unitAr}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
