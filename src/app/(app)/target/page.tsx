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

type KpiForm = {
  kpiKey: KpiKey;
  target: number;
  weight: number;
  unitAr: string;
  sortOrder: number;
};

type Holiday = { date: string; note: string | null };
type QualityKey = "kyc" | "visits" | "training" | "pos" | "csat";
type Quality = { kyc: number; visits: number; training: number; pos: number; csat: number; checks?: Partial<Record<QualityKey, boolean>> };
const QUALITY_ITEMS: { key: QualityKey; label: string; weight: number }[] = [
  { key: "kyc", label: "KYC & Compliance", weight: 5 },
  { key: "visits", label: "Quality Visits", weight: 5 },
  { key: "training", label: "Training & Quiz", weight: 2 },
  { key: "pos", label: "POS machines", weight: 1 },
  { key: "csat", label: "CSAT / Complaints", weight: 2 },
];
const ZERO_QUALITY_FORM: Quality = { kyc: 0, visits: 0, training: 0, pos: 0, csat: 0, checks: {} };

type DailyRow = { kpiKey: string; nameEn: string; unitAr: string; weight: number; percent: number; remaining: number; achieved: number; target: number };
type DailyData = { kpis: DailyRow[]; work: { remaining: number } };

export default function TargetPage() {
  const toast = useToast();
  const month = useMonth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fullCommission, setFullCommission] = useState(6000);
  const [allowOver, setAllowOver] = useState(false);
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
  const [quality, setQuality] = useState<Quality>(ZERO_QUALITY_FORM);
  const [holidayDate, setHolidayDate] = useState(`${month}-01`);
  const [holidayNote, setHolidayNote] = useState("");
  const [yy, mm] = month.split("-").map(Number);
  const monthDays = Array.from({ length: new Date(Date.UTC(yy, mm, 0)).getUTCDate() }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  const firstWeekdayOffset = (new Date(Date.UTC(yy, mm - 1, 1)).getUTCDay() + 1) % 7;
  const [saved, setSaved] = useState(false);
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
    setLoading(true);
    setError("");
    api<{ settings: { saved: boolean; fullCommission: number; allowCommissionOver100: boolean; workingDays: WorkingDays; kpis: KpiForm[]; holidays: Holiday[]; quality: Quality } }>(
      `/api/months/${month}`,
    )
      .then((result) => {
        if (cancelled) return;
        setSaved(result.settings.saved);
        setFullCommission(result.settings.fullCommission);
        setAllowOver(result.settings.allowCommissionOver100);
        setWorkingDays(result.settings.workingDays);
        setKpis(result.settings.kpis);
        setHolidays(result.settings.holidays);
        setQuality(result.settings.quality ?? ZERO_QUALITY_FORM);
        setHolidayDate(`${month}-01`);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError || err instanceof Error ? err.message : "مقدرناش نحمّل الإعدادات");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const weightSum = sumWeights(kpis);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (Math.abs(sumWeights(kpis) - 100) > 0.01) {
      const message = `مجموع الأوزان لازم يبقى 100%. دلوقتي ${sumWeights(kpis)}%`;
      setError(message);
      toast.push("error", message);
      return;
    }
    setSaving(true);
    try {
      await api<{ message: string; settings: { saved: boolean } }>(`/api/months/${month}`, {
        method: "PUT",
        body: JSON.stringify({
          fullCommission,
          allowCommissionOver100: allowOver,
          workingDays,
          kpis,
          holidays,
          quality,
        }),
      });
      setSaved(true);
      window.dispatchEvent(new Event("tys-settings-saved"));
      toast.push("success", "✅ تمام! إعدادات الشهر اتحفظت");
    } catch (err) {
      const message = err instanceof ApiError || err instanceof Error ? err.message : "مقدرناش نحفظ الإعدادات";
      setError(message);
      toast.push("error", message);
    } finally {
      setSaving(false);
    }
  }

  function addHoliday() {
    if (!holidayDate.startsWith(month)) {
      setError("تاريخ الإجازة لازم يكون جوه الشهر المختار");
      return;
    }
    if (holidays.some((item) => item.date === holidayDate)) {
      setError("التاريخ ده متسجل إجازة قبل كده");
      return;
    }
    setHolidays((current) => [...current, { date: holidayDate, note: holidayNote.trim() || null }].sort((a, b) => a.date.localeCompare(b.date)));
    setHolidayNote("");
    setError("");
  }

  if (loading) return <Spinner label="ثواني… بنحمّل إعدادات التارجت" />;

  return (
    <form className="space-y-5" onSubmit={onSave}>
      <section>
        <h1 className="text-3xl font-black">التارجت 🎯</h1>
        <p className="mt-1 text-xs text-neutral-400">{saved ? "✅ محفوظة لهذا الشهر" : "⚠️ لسه مش محفوظة، اضغط حفظ"}</p>
      </section>

      <section className="overflow-hidden rounded-[32px] bg-gradient-to-br from-[#ff9a3c] via-[#ff7900] to-[#e85d00] p-5 text-white shadow-[0_20px_50px_rgba(255,121,0,0.35)]">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><p className="text-2xl font-black">{monthDays.length}</p><p className="text-[11px] text-white/85">أيام الشهر</p></div>
          <div><p className="text-2xl font-black">{holidays.length}</p><p className="text-[11px] text-white/85">إجازات</p></div>
          <div><p className="text-2xl font-black">{monthDays.length - holidays.length}</p><p className="text-[11px] text-white/85">أيام شغل</p></div>
        </div>
      </section>

      <section className="rounded-[32px] border border-orange-100/70 bg-white p-4 shadow-[0_10px_30px_rgba(255,121,0,0.08)]">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-neutral-400">
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
                onClick={() =>
                  setHolidays((current) =>
                    current.some((item) => item.date === date)
                      ? current.filter((row) => row.date !== date)
                      : [...current, { date, note: null }].sort((a, b) => a.date.localeCompare(b.date)),
                  )
                }
                className={`flex aspect-square items-center justify-center rounded-2xl text-sm font-extrabold transition ${
                  isHoliday ? "bg-gradient-to-br from-[#ff9a3c] to-[#e85d00] text-white shadow-[0_6px_16px_rgba(255,121,0,0.3)]" : "bg-neutral-50 text-neutral-700"
                }`}
              >
                {Number(date.slice(8, 10))}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-center text-xs text-neutral-400">اضغط أي يوم لإضافته أو إلغائه كإجازة</p>
      </section>

      {error ? <Banner tone="error">❌ {error}</Banner> : null}

      <p className={`px-1 text-xs font-bold ${Math.abs(weightSum - 100) > 0.01 ? "text-amber-700" : "text-emerald-700"}`}>
        {Math.abs(weightSum - 100) > 0.01 ? `⚠️ الأوزان ${weightSum}% (لازم 100% عشان تتحفظ)` : "✓ الأوزان 100%"}
      </p>

      {daily ? (
        <section className="rounded-[24px] bg-orange-50 p-4 text-sm leading-7 text-[#c45e00]">
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

      <section className="rounded-[32px] border border-orange-100/70 bg-white p-5 shadow-[0_10px_30px_rgba(255,121,0,0.08)]">
        <Field label="💰 الكوميشن الكامل (جنيه)">
          <input
            className={`${inputClass} text-xl font-black`}
            type="number"
            min={0}
            step="1"
            value={fullCommission}
            onChange={(e) => setFullCommission(Number(e.target.value))}
          />
        </Field>
        <label className="mt-4 flex min-h-12 items-center gap-3 text-sm font-bold">
          <input type="checkbox" checked={allowOver} onChange={(e) => setAllowOver(e.target.checked)} className="h-5 w-5 accent-[#ff7900]" />
          اسمح إن الكوميشن التقديري يعدّي 100%
        </label>
      </section>

      <section className="rounded-[28px] border border-orange-100/70 bg-white p-4 shadow-[0_10px_30px_rgba(255,121,0,0.08)]">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-black">الإيتمز والأوزان</h2>
          <p className="text-[11px] font-bold text-neutral-400">بتتدخل مرة واحدة في الشهر</p>
        </div>
        <div className="grid grid-cols-[1fr_74px_74px] gap-2 border-b border-dashed border-orange-200 pb-2 text-[11px] font-bold text-neutral-400">
          <span>الإيتم</span>
          <span className="text-center">التارجت</span>
          <span className="text-center">الوزن %</span>
        </div>
        {kpis.map((kpi, index) => {
          const catalog = KPI_CATALOG.find((item) => item.key === kpi.kpiKey);
          return (
            <div key={kpi.kpiKey} className="grid grid-cols-[1fr_74px_74px] items-center gap-2 border-b border-dashed border-orange-200 py-2.5 last:border-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-[#ff7900]"><KpiIcon kpiKey={kpi.kpiKey} className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold" dir="ltr">{catalog?.nameEn}</p>
                  {kpi.kpiKey === "new_orange_cash" ? (
                    <p className="text-[10px] font-bold text-[#c45e00]">= 90% من New Lines (لأعلى)</p>
                  ) : (
                    <p className="text-[10px] text-neutral-400">{kpi.unitAr}</p>
                  )}
                </div>
              </div>
              <input
                aria-label={`تارجت ${catalog?.nameEn}`}
                className={`${inputClass} px-2 py-2 text-center text-sm font-black`}
                type="number"
                min={0}
                step="0.01"
                value={kpi.target}
                onChange={(e) => {
                  const target = Number(e.target.value);
                  setKpis((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, target } : row)));
                }}
              />
              <input
                aria-label={`وزن ${catalog?.nameEn}`}
                className={`${inputClass} px-2 py-2 text-center text-sm font-black`}
                type="number"
                min={0}
                step="0.01"
                value={kpi.weight}
                onChange={(e) => {
                  const weight = Number(e.target.value);
                  setKpis((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, weight } : row)));
                }}
              />
            </div>
          );
        })}
      </section>

            <section className="rounded-[28px] border border-orange-100/70 bg-white p-4 shadow-[0_10px_30px_rgba(255,121,0,0.08)]">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-black">الكواليتي (15%)</h2>
          <p className="text-[11px] font-bold text-neutral-400">علّم البند لو اتحقق بالكامل</p>
        </div>
        <div className="grid grid-cols-[1fr_74px] gap-2 border-b border-dashed border-orange-200 pb-2 text-[11px] font-bold text-neutral-400">
          <span>البند</span>
          <span className="text-center">الوزن</span>
        </div>
        {QUALITY_ITEMS.map((item) => (
          <div key={item.key} className="grid grid-cols-[1fr_74px] items-center gap-2 border-b border-dashed border-orange-200 py-2.5 last:border-0">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                role="checkbox"
                aria-checked={!!quality.checks?.[item.key]}
                aria-label={`تحقق ${item.label}`}
                onClick={() => setQuality((current) => ({ ...current, checks: { ...current.checks, [item.key]: !current.checks?.[item.key] } }))}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-sm font-black ${
                  quality.checks?.[item.key] ? "border-emerald-500 bg-emerald-500 text-white" : "border-orange-200 bg-white text-transparent"
                }`}
              >
                ✓
              </button>
              <p className="truncate text-sm font-extrabold" dir="ltr">{item.label}</p>
            </div>
            <p className="text-center text-sm font-black text-neutral-500">{item.weight}%</p>
          </div>
        ))}
      </section>

      <PrimaryButton type="submit" disabled={saving}>
        {saving ? "⏳ بنحفظ على السيرفر..." : "💾 احفظ إعدادات الشهر"}
      </PrimaryButton>
    </form>
  );
}
