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
    <svg viewBox="0 0 130 130" role="img" aria-label={`نسبة الإنجاز ${formatPercent(value)} بالمئة`} className="h-32 w-32 shrink-0">
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
        {Math.round(Math.max(0, value))}%
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

      <section className="relative isolate overflow-hidden rounded-[30px] border border-[#edc7a7] bg-gradient-to-br from-[#fffaf5] via-[#fff2e4] to-[#ffe4ca] p-4 shadow-[0_18px_42px_rgba(112,57,18,0.11)] sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-16 h-52 w-52 rounded-full bg-[#ff963f]/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 right-1/4 h-48 w-48 rounded-full bg-white/80 blur-3xl" />
        <div className="relative flex items-center gap-4 sm:gap-6">
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ff9a45] via-[#f07818] to-[#c6530b] p-1 shadow-[0_12px_28px_rgba(198,83,11,0.22)] sm:h-36 sm:w-36">
            <div className="flex h-full w-full items-center justify-center rounded-full border border-white/40 bg-white/10">
              <ScoreRing value={data.overall} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-[#80502f]">إجمالي التارجت الشهري</p>
            <p className="mt-1 text-3xl font-black tracking-tight text-[#9d430d] sm:text-4xl">{formatPercent(data.overall)}%</p>
            <p className="mt-1 text-sm font-bold text-[#80502f]">{gap > 0 ? `فاضل ${formatPercent(gap)}%` : "مفيش فاضل، قفلت الشهر"}</p>
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/80 bg-white/75 p-3 shadow-sm backdrop-blur-sm">
            <p className="text-[11px] font-bold text-[#897466]">الكوميشن المتوقع</p>
            <p className="mt-1 text-lg font-black text-[#9d430d]">{formatMoney(data.estimatedCommission)} <span className="text-[10px] font-bold text-[#897466]">جنيه</span></p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/75 p-3 shadow-sm backdrop-blur-sm">
            <p className="text-[11px] font-bold text-[#897466]">الكوميشن الكامل</p>
            <p className="mt-1 text-lg font-black text-[#2b1b12]">{formatMoney(data.fullCommission)} <span className="text-[10px] font-bold text-[#897466]">جنيه</span></p>
          </div>
        </div>
      </section>
      <section className={`rounded-[26px] border p-4 shadow-[0_10px_28px_rgba(116,63,26,0.045)] ${moodStyle.box}`}>
        <p className={`text-base font-black ${moodStyle.title}`}>
          {mood.emoji} {mood.headline}
        </p>
        <p className={`mt-1 text-sm leading-7 ${moodStyle.text}`}>{mood.detail}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl border border-white/70 bg-white/75 p-2 shadow-sm">
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
        <article className="group relative overflow-hidden rounded-[22px] border border-[#edc7a7] bg-gradient-to-br from-white via-white to-[#fff6ed] p-3 shadow-[0_10px_26px_rgba(112,57,18,0.075)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(198,83,11,0.12)] before:absolute before:inset-y-3 before:right-0 before:w-1 before:rounded-l-full before:bg-gradient-to-b before:from-[#ff963f] before:to-[#c6530b]">
          <p className="text-sm font-bold text-neutral-500">📱 الخطوط اللي عملتها</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-[#c6530b]">{formatQty(newLines?.achieved ?? 0)}</p>
          <p className="text-xs text-neutral-400">من {formatQty(newLines?.target ?? 0)}</p>
        </article>
        <article className="group relative overflow-hidden rounded-[22px] border border-[#edc7a7] bg-gradient-to-br from-white via-white to-[#fff6ed] p-3 shadow-[0_10px_26px_rgba(112,57,18,0.075)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(198,83,11,0.12)] before:absolute before:inset-y-3 before:right-0 before:w-1 before:rounded-l-full before:bg-gradient-to-b before:from-[#ff963f] before:to-[#c6530b]">
          <p className="text-sm font-bold text-neutral-500">🎯 الفاضل في الخطوط</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-[#c6530b]">{formatQty(newLines?.remaining ?? 0)}</p>
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

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-[#2b1b12]">مؤشرات الأداء</h2>
            <p className="mt-1 text-xs text-[#897466]">نظرة سريعة على كل مؤشر من مؤشراتك</p>
          </div>
          <span className="rounded-full border border-[#f0dfd0] bg-white/80 px-3 py-1 text-[11px] font-extrabold text-[#c6530b]">{data.kpis.length} مؤشرات</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {data.kpis.map((kpi) => {
            const visual = Math.min(100, Math.max(0, kpi.percent));
            const featured = kpi.kpiKey === "new_lines";
            const kpiExpected = kpi.target > 0 ? (kpi.expectedToDate / kpi.target) * 100 : 0;
            const m = kpiMood({ percent: kpi.percent, expectedPercent: kpiExpected, weight: kpi.weight });
            const moodColor =
              m.tone === "good" ? "text-emerald-700" : m.tone === "warn" ? "text-yellow-700" : m.tone === "bad" ? "text-red-600" : "text-neutral-400";
            const progressGradient =
              m.tone === "good"
                ? "linear-gradient(90deg, #34d399 0%, #059669 100%)"
                : m.tone === "warn"
                  ? "linear-gradient(90deg, #fbbf24 0%, #d97706 100%)"
                  : m.tone === "bad"
                    ? "linear-gradient(90deg, #fb7185 0%, #dc2626 100%)"
                    : "linear-gradient(90deg, #ffad68 0%, #f07818 52%, #c6530b 100%)";
            const progressTrack =
              m.tone === "good" ? "bg-emerald-50" : m.tone === "warn" ? "bg-amber-50" : m.tone === "bad" ? "bg-rose-50" : "bg-[#f2e6dc]";
            return (
              <article
                key={kpi.kpiKey}
                className={`relative overflow-hidden rounded-[22px] border p-3.5 shadow-[0_10px_26px_rgba(112,57,18,0.055)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(112,57,18,0.10)] sm:p-4 ${featured ? "col-span-2 border-[#edc7a7] bg-gradient-to-br from-white via-[#fffaf5] to-[#fff0df] sm:col-span-2" : "border-[#f0dfd0] bg-white/95"}`}
              >
                {featured ? <span aria-hidden="true" className="pointer-events-none absolute -left-8 -top-10 h-28 w-28 rounded-full bg-[#ff963f]/10 blur-2xl" /> : null}
                <div className="relative flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${featured ? "bg-gradient-to-br from-[#ff9a45] to-[#c6530b] text-xl text-white shadow-md shadow-orange-900/10" : "bg-[#fff0df] text-xl"}`}>{kpiEmoji(kpi.kpiKey)}</span>
                    <h3 className="text-sm font-extrabold text-[#2b1b12]" dir="ltr">{kpi.nameEn}</h3>
                  </div>
                  <p className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${featured ? "bg-white/85 text-[#c6530b]" : "bg-[#fff5eb] text-[#c6530b]"}`}>{formatPercent(kpi.percent)}%</p>
                </div>
                <div className="relative mt-3 flex items-baseline gap-1.5">
                  <p className={`font-black tracking-tight text-[#2b1b12] ${featured ? "text-3xl sm:text-4xl" : "text-2xl"}`}>{formatQty(kpi.achieved)}</p>
                  <span className="text-xs text-[#897466]">من {formatQty(kpi.target)} {kpi.unitAr}</span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`نسبة إنجاز ${kpi.nameEn}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={visual}
                  className={`relative mt-3 overflow-hidden rounded-full ${progressTrack} ${featured ? "h-2.5" : "h-2"} ring-1 ring-inset ring-black/[0.025]`}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-700 ease-out"
                    style={{ width: `${visual}%`, background: progressGradient, boxShadow: "0 1px 5px rgba(90, 45, 15, .16)" }}
                  />
                </div>
                <div className="relative mt-2 flex flex-wrap items-center justify-between gap-1">
                  <p className={`text-[11px] font-bold ${moodColor}`}>{m.emoji} {m.text}</p>
                  <p className="text-[11px] text-[#897466]">فاضل {formatQty(kpi.remaining)}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
