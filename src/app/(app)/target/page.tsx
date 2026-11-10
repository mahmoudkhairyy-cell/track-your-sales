"use client";

import { FormEvent, useEffect, useState } from "react";
import { KPI_CATALOG, WEEK_DAYS, kpiEmoji } from "@/lib/constants";
import { formatQty, sumWeights } from "@/lib/calculations";
import { Banner, Field, PrimaryButton, SecondaryButton, Spinner, inputClass, useToast } from "@/components/ui";
import { ApiError, api } from "@/lib/client";
import type { WorkingDays } from "@/lib/types";
import type { KpiKey } from "@/lib/constants";
import { useMonth } from "@/components/AppShell";
import { KpiIcon } from "@/components/KpiIcon";
import { workingDatesInMonth } from "@/lib/dates";

type KpiForm = {
  kpiKey: KpiKey;
  target: number;
  weight: number;
  unitAr: string;
  sortOrder: number;
};

type Holiday = { date: string; note: string | null };
type QualityKey = "kyc" | "visits" | "training" | "pos" | "csat";
/** الكواليتي = الـChecklist بس، بأوزانه المعتمدة. */
type Quality = { checks?: Partial<Record<QualityKey, boolean>> };
const QUALITY_ITEMS: { key: QualityKey; label: string; weight: number }[] = [
  { key: "kyc", label: "KYC & Compliance", weight: 5 },
  { key: "visits", label: "Quality Visits", weight: 5 },
  { key: "training", label: "Training & Quiz", weight: 2 },
  { key: "pos", label: "POS machines", weight: 1 },
  { key: "csat", label: "CSAT / Complaints", weight: 2 },
];
const ZERO_QUALITY_FORM: Quality = { checks: {} };

type DailyRow = { kpiKey: string; nameEn: string; unitAr: string; weight: number; percent: number; remaining: number; achieved: number; target: number };
type DailyData = { kpis: DailyRow[]; work: { remaining: number } };

function settingsSnapshot(v: { fullCommission: number; workingDays: unknown; kpis: unknown; holidays: unknown; quality: unknown }) {
  return JSON.stringify({ fullCommission: v.fullCommission, workingDays: v.workingDays, kpis: v.kpis, holidays: v.holidays, quality: v.quality });
}

export default function TargetPage() {
  const toast = useToast();
  const month = useMonth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fullCommission, setFullCommission] = useState(6000);
  const [workingDays, setWorkingDays] = useState<WorkingDays>({
    sat: true,
    sun: true,
    mon: true,
    tue: true,
    wed: true,
    thu: true,
    fri: false,
  });
  const [kpis, setKpis] = useState<KpiForm[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  // أول مرة للشهر: لازم الموظف يأكد إجازاته (أو يأكد إنه مفيش) قبل الحفظ.
  const [holidaysConfirmed, setHolidaysConfirmed] = useState(false);
  const [quality, setQuality] = useState<Quality>(ZERO_QUALITY_FORM);
  const [yy, mm] = month.split("-").map(Number);
  const monthDays = Array.from({ length: new Date(Date.UTC(yy, mm, 0)).getUTCDate() }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  const firstWeekdayOffset = (new Date(Date.UTC(yy, mm - 1, 1)).getUTCDay() + 1) % 7;
  const [saved, setSaved] = useState(false);
  const [baseline, setBaseline] = useState<string | null>(null);
  const [daily, setDaily] = useState<DailyData | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<DailyData>(`/api/dashboard?month=${month}`)
      .then((result) => {
        if (!cancelled) setDaily(result);
      })
      .catch(() => {
        if (!cancelled) setDaily(null);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const behindKpis = daily ? daily.kpis.filter((kpi) => kpi.weight > 0 && kpi.percent < 100 && kpi.remaining > 0) : [];

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setError("");
      }
    });
    api<{ settings: { saved: boolean; fullCommission: number; workingDays: WorkingDays; kpis: KpiForm[]; holidays: Holiday[]; quality: Quality } }>(
      `/api/months/${month}`,
    )
      .then((result) => {
        if (cancelled) return;
        setSaved(result.settings.saved);
        setFullCommission(result.settings.fullCommission);
        setWorkingDays(result.settings.workingDays);
        setKpis(result.settings.kpis);
        setHolidays(result.settings.holidays);
        setQuality(result.settings.quality ?? ZERO_QUALITY_FORM);
        setBaseline(
          settingsSnapshot({
            fullCommission: result.settings.fullCommission,
            workingDays: result.settings.workingDays,
            kpis: result.settings.kpis,
            holidays: result.settings.holidays,
            quality: result.settings.quality ?? ZERO_QUALITY_FORM,
          }),
        );
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError || err instanceof Error ? err.message : "ماقدرناش نحمّل الإعدادات. اتأكد من النت وحاول تاني.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const weightSum = sumWeights(kpis);

  const snapshot = settingsSnapshot({ fullCommission, workingDays, kpis, holidays, quality });
  const dirty = baseline !== null && snapshot !== baseline;
  const saveState = saving
    ? { label: "⏳ جارٍ الحفظ", tone: "bg-amber-50 text-amber-800 ring-1 ring-amber-200" }
    : error && !dirty
      ? { label: "⚠️ تعذر الحفظ", tone: "bg-red-50 text-red-700 ring-1 ring-red-200" }
      : dirty
        ? { label: "● تغييرات غير محفوظة", tone: "bg-[var(--color-primary-50)] text-[var(--color-primary-700)] ring-1 ring-[#f3d6c0]" }
        : saved
          ? { label: "✓ محفوظة", tone: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" }
          : { label: "● محتاجة حفظ", tone: "bg-[var(--color-primary-50)] text-[var(--color-primary-700)] ring-1 ring-[#f3d6c0]" };

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!saved && !holidaysConfirmed) {
      const message = "لازم تأكد إجازاتك الأول (أو إنه مفيش إجازات) قبل ما تحفظ";
      setError(message);
      toast.push("error", message);
      return;
    }
    if (Math.abs(sumWeights(kpis) - 100) > 0.01) {
      const message = `مجموع الأوزان لازم يبقى 100%. دلوقتي ${sumWeights(kpis)}%`;
      setError(message);
      toast.push("error", message);
      return;
    }
    const submitted = settingsSnapshot({ fullCommission, workingDays, kpis, holidays, quality });
    setSaving(true);
    try {
      await api<{ message: string; settings: { saved: boolean } }>(`/api/months/${month}`, {
        method: "PUT",
        body: JSON.stringify({
          fullCommission,
          workingDays,
          kpis,
          holidays,
          quality,
        }),
      });
      setSaved(true);
      setBaseline(submitted);
      window.dispatchEvent(new Event("tys-settings-saved"));
      toast.push("success", "✅ تمام! إعدادات الشهر اتحفظت");
    } catch (err) {
      const message = err instanceof ApiError || err instanceof Error ? err.message : "ماقدرناش نحفظ الإعدادات. اتأكد من النت وحاول تاني.";
      setError(message);
      toast.push("error", message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner label="ثواني… بنحمّل إعدادات التارجت" />;

  return (
    <form className="tys-page tys-page-target mx-auto max-w-6xl space-y-5 pb-4" onSubmit={onSave}>
<<<<<<< ours
      <section className="relative isolate overflow-hidden rounded-[30px] border border-[#f0d7c4] bg-[linear-gradient(120deg,#fff7ef_0%,#fff_52%,#ffead8_100%)] p-5 shadow-[0_16px_38px_rgba(126,65,24,0.07)] sm:p-6">
        <div className="pointer-events-none absolute -left-10 -top-12 h-36 w-36 rounded-full border-[22px] border-[var(--color-primary-600)]/[0.06]" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black tracking-[0.18em] text-[#c45a17]">MONTHLY CONFIGURATION</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--color-text-primary)] sm:text-3xl">التارجت 🎯</h1>
            <p className="mt-1.5 max-w-md text-xs leading-6 text-[var(--color-text-secondary)]">ظبّط أهداف الشهر وأيام الشغل والأوزان من مكان واحد.</p>
=======
      <section className="relative isolate overflow-hidden rounded-[30px] border border-[#efc9a9] bg-[linear-gradient(118deg,#fff8f1_0%,#fff_48%,#ffead8_100%)] p-5 shadow-[0_18px_42px_rgba(126,65,24,0.075)] sm:p-6">
        <div className="pointer-events-none absolute -left-12 -top-16 h-44 w-44 rounded-full border-[26px] border-[var(--color-primary-600)]/[0.055]" />
        <div className="pointer-events-none absolute -bottom-20 right-1/3 h-36 w-36 rounded-full bg-[var(--color-primary-500)]/10 blur-2xl" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black tracking-[0.18em] text-[#c45a17]">MONTHLY CONFIGURATION</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--color-text-primary)] sm:text-3xl">التارجت 🎯</h1>
              <p className="mt-1.5 max-w-md text-xs leading-6 text-[var(--color-text-secondary)]">كل إعدادات الشهر في مكان واحد — راجع أهدافك قبل الحفظ.</p>
            </div>
            <span role="status" aria-live="polite" className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-extrabold ${saveState.tone}`}>
              {saveState.label}
            </span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[var(--color-border)] pt-4">
            <div className="min-w-0 rounded-2xl border border-white/80 bg-white/75 px-2.5 py-3 text-center shadow-sm">
              <p className="text-xl font-black tabular-nums text-[var(--color-primary-700)]">{kpis.filter((k) => k.kpiKey !== "quality" && (k.weight > 0 || k.kpiKey !== "productivity")).length}</p>
              <p className="mt-0.5 text-[10px] font-bold text-[var(--color-text-secondary)]">مؤشرات التارجت</p>
            </div>
            <div className="min-w-0 rounded-2xl border border-white/80 bg-white/75 px-2.5 py-3 text-center shadow-sm">
              <p className={`text-xl font-black tabular-nums ${Math.abs(weightSum - 100) < 0.01 ? "text-emerald-700" : "text-[var(--color-primary-700)]"}`}>{weightSum}%</p>
              <p className="mt-0.5 text-[10px] font-bold text-[var(--color-text-secondary)]">إجمالي الأوزان</p>
            </div>
            <div className="min-w-0 rounded-2xl border border-white/80 bg-white/75 px-2.5 py-3 text-center shadow-sm">
              <p className="text-xl font-black tabular-nums text-[var(--color-primary-700)]">{workingDatesInMonth(month, workingDays, holidays.map((item) => item.date)).length}</p>
              <p className="mt-0.5 text-[10px] font-bold text-[var(--color-text-secondary)]">أيام العمل</p>
            </div>
>>>>>>> theirs
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-extrabold ${saved ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" : "bg-[var(--color-primary-50)] text-[var(--color-primary-700)] ring-1 ring-[#f3d6c0]"}`}>
            {saved ? "✓ محفوظة" : "● محتاجة حفظ"}
          </span>
        </div>
      </section>

      {!saved ? (
        <section className="rounded-[24px] border-2 border-[var(--color-primary-700)] bg-[var(--color-primary-50)] p-4 text-[var(--color-primary-700)]">
          <p className="text-sm font-black">📅 الخطوة الأولى: اختار إجازاتك لهذا الشهر</p>
          <p className="mt-1 text-xs leading-6">اضغط على الأيام اللي هتاخد فيها إجازة في التقويم تحت. لو مش هتاخد إجازة، فعّل التأكيد بس.</p>
          <label className="mt-3 flex items-center gap-2 text-sm font-extrabold">
            <input type="checkbox" checked={holidaysConfirmed} onChange={(e) => setHolidaysConfirmed(e.target.checked)} className="h-5 w-5 accent-[var(--color-primary-700)]" />
            {holidays.length > 0 ? `أكدت إن عندي ${holidays.length} إجازة` : "مفيش عندي إجازات الشهر ده"}
          </label>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-white p-4 shadow-[0_12px_30px_rgba(100,55,25,0.045)]">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-[var(--color-primary-50)] px-2 py-3"><p className="text-2xl font-black tabular-nums text-[var(--color-text-primary)]">{monthDays.length}</p><p className="text-[11px] text-[var(--color-text-secondary)]">أيام الشهر</p></div>
          <div className="rounded-2xl bg-[var(--color-primary-50)] px-2 py-3"><p className="text-2xl font-black tabular-nums text-[var(--color-text-primary)]">{holidays.length}</p><p className="text-[11px] text-[var(--color-text-secondary)]">إجازات</p></div>
          <div className="rounded-2xl bg-[var(--color-primary-50)] px-2 py-3"><p className="text-2xl font-black tabular-nums text-[var(--color-text-primary)]">{workingDatesInMonth(month, workingDays, holidays.map((item) => item.date)).length}</p><p className="text-[11px] text-[var(--color-text-secondary)]">أيام شغل</p></div>
        </div>
      </section>

      {kpis.some((k) => k.weight > 0) ? (
        <section className="rounded-[28px] border border-[var(--color-border)] bg-white p-4 shadow-[0_12px_30px_rgba(100,55,25,0.045)]">
          <p className="text-sm font-black text-[var(--color-text-primary)]">توزيع الأوزان</p>
          <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-[var(--color-surface-cream)]">
            {kpis.filter((k) => k.weight > 0).map((k, i) => (
              <span key={k.kpiKey} style={{ width: `${k.weight}%`, background: ["var(--color-primary-600)", "var(--color-primary-500)", "var(--color-primary-700)", "#e7a06a", "#f2c49f"][i % 5] }} />
            ))}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-[var(--color-text-secondary)]">
            {kpis.filter((k) => k.weight > 0).map((k, i) => (
              <li key={k.kpiKey} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: ["var(--color-primary-600)", "var(--color-primary-500)", "var(--color-primary-700)", "#e7a06a", "#f2c49f"][i % 5] }} />
                <span className="truncate">{kpiEmoji(k.kpiKey)} {KPI_CATALOG.find((c) => c.key === k.kpiKey)?.nameEn ?? k.kpiKey}</span>
                <span className="mr-auto tabular-nums text-[var(--color-text-primary)]">{k.weight}%</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-[28px] border border-[var(--color-border)] bg-white p-4 shadow-[0_12px_30px_rgba(100,55,25,0.045)] sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-[var(--color-text-primary)]">تقويم الإجازات</h2>
            <p className="mt-1 text-[11px] text-[#9a8170]">اختار الأيام اللي مش هتشتغل فيها</p>
          </div>
          <span className="rounded-xl bg-[var(--color-primary-50)] px-3 py-2 text-xs font-black text-[var(--color-primary-700)]">{month}</span>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-[#9a8170]">
          {["سبت", "أحد", "اتنين", "تلات", "أربع", "خميس", "جمعة"].map((d) => (
            <span key={d} className="py-1">{d}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: firstWeekdayOffset }).map((_, i) => (
            <span key={`pad-${i}`} />
          ))}
          {monthDays.map((date) => {
            const isHoliday = holidays.some((item) => item.date === date);
            return (
              <button
                key={date}
                type="button"
                aria-pressed={isHoliday}
                aria-label={`${date}${isHoliday ? " — إجازة" : ""}`}
                onClick={() =>
                  setHolidays((current) =>
                    current.some((item) => item.date === date)
                      ? current.filter((row) => row.date !== date)
                      : [...current, { date, note: null }].sort((a, b) => a.date.localeCompare(b.date)),
                  )
                }
                className={`flex aspect-square items-center justify-center rounded-2xl text-sm font-extrabold transition duration-200 hover:scale-[1.04] active:scale-95 ${
                  isHoliday ? "bg-gradient-to-br from-[var(--color-primary-600)] to-[var(--color-primary-500)] text-white shadow-sm" : "bg-[var(--color-surface-cream)] text-[var(--color-text-primary)]"
                }`}
              >
                {Number(date.slice(8, 10))}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-center text-xs text-[var(--color-text-secondary)]">اضغط أي يوم لإضافته أو إلغائه كإجازة</p>
      </section>

      {error ? <Banner tone="error">❌ {error}</Banner> : null}

      <p className={`px-1 text-xs font-bold ${Math.abs(weightSum - 100) > 0.01 ? "text-amber-700" : "text-emerald-700"}`}>
        {Math.abs(weightSum - 100) > 0.01 ? `⚠️ الأوزان ${weightSum}%: ${weightSum < 100 ? `ناقص ${Math.round((100 - weightSum) * 100) / 100}%` : `زيادة ${Math.round((weightSum - 100) * 100) / 100}%`} (لازم 100% عشان تتحفظ)` : "✓ الأوزان 100%"}
      </p>

      {daily ? (
        <section className="rounded-[24px] bg-[var(--color-primary-50)] p-4 text-sm leading-7 text-[var(--color-primary-700)]">
          <p className="font-extrabold">⚡ المطلوب منك النهارده عشان تفضل ON TRACK:</p>
          {behindKpis.length === 0 ? (
            <p className="mt-1 font-bold">كل المؤشرات تمام. مفيش حاجة ضاغطة النهارده 👌</p>
          ) : daily.work.remaining <= 0 ? (
            <p className="mt-1 font-bold">أيام الشغل خلصت. اللي فاضل: {behindKpis.map((k) => `${kpiEmoji(k.kpiKey)} ${k.nameEn} ${formatQty(k.remaining)}`).join(" · ")}</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {behindKpis.map((kpi) => (
                <li key={kpi.kpiKey} className="flex items-center justify-between gap-2">
                  <span className="font-bold">
                    {kpiEmoji(kpi.kpiKey)} {kpi.nameEn}
                  </span>
                  <span className="font-black">
                    {formatQty(Math.ceil(kpi.remaining / daily.work.remaining))} {kpi.unitAr} — فاضل {formatQty(kpi.remaining)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="rounded-[28px] border border-[var(--color-border)] bg-white p-5 shadow-[0_12px_30px_rgba(100,55,25,0.045)]">
        <Field label="💰 الكوميشن الكامل (جنيه)">
          <input
            className={`${inputClass} text-xl font-black`}
            type="number"
            min={0}
            step="1"
            value={fullCommission || ""}
            placeholder="0"
            onChange={(e) => setFullCommission(Math.max(0, Number(e.target.value) || 0))}
          />
        </Field>
      </section>

      <section className="rounded-[28px] border border-[var(--color-border)] bg-white p-4 shadow-[0_12px_30px_rgba(100,55,25,0.045)]">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-black">الإيتمز والأوزان</h2>
        </div>
        <p className="mb-2 rounded-xl bg-[var(--color-primary-50)] px-3 py-2 text-[11px] font-bold leading-5 text-[var(--color-primary-700)]">
          📌 الأوزان مختلفة للموظف والمدير. ده وزن {kpis.some((k) => k.kpiKey === "productivity" && k.weight > 0) ? "المدير" : "الموظف"}، وبيتحدد أوتوماتيك حسب اختيارك في أول مرة، ومش بيتعدل من التطبيق.
        </p>
        <div className="grid grid-cols-[minmax(0,1fr)_68px_60px] gap-1.5 border-b sm:grid-cols-[minmax(0,1fr)_74px_74px] sm:gap-2 border-dashed border-[var(--color-border)]/70 pb-2 text-[11px] font-bold text-[var(--color-text-secondary)]">
          <span>الإيتم</span>
          <span className="text-center">التارجت</span>
          <span className="text-center">الوزن %</span>
        </div>
        {kpis.map((kpi, index) => {
          // الكواليتي بتتدخل في قسم الكواليتي تحت بس، ووزنها بيفضل محسوب في المجموع.
          if (kpi.kpiKey === "quality") return null;
          // الإنتاجية للمدير بس (وزنها صفر للموظف).
          if (kpi.kpiKey === "productivity" && kpi.weight === 0) return null;
          const catalog = KPI_CATALOG.find((item) => item.key === kpi.kpiKey);
          return (
            <div key={kpi.kpiKey} className="grid grid-cols-[minmax(0,1fr)_68px_60px] items-center gap-1.5 border-b sm:grid-cols-[minmax(0,1fr)_74px_74px] sm:gap-2 border-dashed border-[var(--color-border)]/70 py-2.5 last:border-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"><KpiIcon kpiKey={kpi.kpiKey} className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold" dir="ltr">{catalog?.nameEn}</p>
                  {kpi.kpiKey === "new_orange_cash" ? (
                    <p className="text-[10px] font-bold text-[var(--color-primary-700)]">تارجت بتدخله بإيدك</p>
                  ) : (
                    <p className="text-[10px] text-[var(--color-text-secondary)]">{kpi.unitAr}</p>
                  )}
                </div>
              </div>
              <input
                aria-label={`تارجت ${catalog?.nameEn}`}
                className={`${inputClass} px-2 py-2 text-center text-sm font-black`}
                type="number"
                min={0}
                step="0.01"
                value={kpi.target || ""}
                placeholder="0"
                onChange={(e) => {
                  const target = Math.max(0, Number(e.target.value) || 0);
                  setKpis((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, target } : row)));
                }}
              />
              <p aria-label={`وزن ${catalog?.nameEn}`} className="py-2 text-center text-sm font-black text-[var(--color-text-secondary)]">{kpi.weight}%</p>
            </div>
          );
        })}
      </section>

      <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-cream)]/95 p-2 shadow-[0_12px_30px_rgba(100,55,25,0.12)] backdrop-blur-xl lg:bottom-4">
      <PrimaryButton type="submit" disabled={saving}>
        {saving ? "⏳ بنحفظ على السيرفر..." : "💾 احفظ إعدادات الشهر"}
      </PrimaryButton>
      </div>
    </form>
  );
}
