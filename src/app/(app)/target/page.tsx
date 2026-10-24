"use client";

import { FormEvent, useEffect, useState } from "react";
import { KPI_CATALOG, WEEK_DAYS } from "@/lib/constants";
import { sumWeights } from "@/lib/calculations";
import { Banner, Field, PrimaryButton, SecondaryButton, Spinner, inputClass, useToast } from "@/components/ui";
import { ApiError, api } from "@/lib/client";
import type { WorkingDays } from "@/lib/types";
import type { KpiKey } from "@/lib/constants";
import { useMonth } from "@/components/AppShell";

type KpiForm = {
  kpiKey: KpiKey;
  target: number;
  weight: number;
  unitAr: string;
  sortOrder: number;
};

type Holiday = { date: string; note: string | null };

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
  const [holidayDate, setHolidayDate] = useState(`${month}-01`);
  const [holidayNote, setHolidayNote] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api<{ settings: { saved: boolean; fullCommission: number; allowCommissionOver100: boolean; workingDays: WorkingDays; kpis: KpiForm[]; holidays: Holiday[] } }>(
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
        }),
      });
      setSaved(true);
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
        <h1 className="text-2xl font-black">التارجت 🎯</h1>
        <p className="mt-1 text-sm text-neutral-500">كل شهر محفوظ لوحده. لما تغيّر الشهر مش هيتكتب فوق شهر تاني.</p>
        <p className="mt-1 text-xs text-neutral-400">{saved ? "✅ الإعدادات دي محفوظة في قاعدة البيانات." : "⚠️ لسه مش محفوظة. الأرقام اللي شايفها افتراضية لحد ما تدوس حفظ."}</p>
      </section>

      {error ? <Banner tone="error">❌ {error}</Banner> : null}
      {Math.abs(weightSum - 100) > 0.01 ? (
        <Banner tone="warn">⚠️ مجموع الأوزان {weightSum}% مش 100%. تقدر تحفظ عادي، بس النتيجة هتتحسب على الأوزان دي.</Banner>
      ) : (
        <Banner tone="success">👌 مجموع الأوزان 100% تمام.</Banner>
      )}

      <section className="rounded-[28px] bg-white p-5 shadow-[0_8px_24px_rgba(255,121,0,0.06)]">
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

      <section className="space-y-3">
        <h2 className="text-lg font-black">الإيتمز والأوزان</h2>
        {kpis.map((kpi, index) => {
          const catalog = KPI_CATALOG.find((item) => item.key === kpi.kpiKey);
          return (
            <div key={kpi.kpiKey} className="rounded-[24px] bg-white p-4 shadow-[0_8px_24px_rgba(255,121,0,0.06)]">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-2xl">{catalog?.emoji ?? "🎯"}</span>
                <div>
                  <p className="font-extrabold" dir="ltr">
                    {catalog?.nameEn}
                  </p>
                  <p className="text-xs text-neutral-400">الوحدة: {kpi.unitAr}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="التارجت">
                  <input
                    className={`${inputClass} text-lg font-black`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={kpi.target}
                    onChange={(e) => {
                      const target = Number(e.target.value);
                      setKpis((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, target } : row)));
                    }}
                  />
                </Field>
                <Field label="الوزن %">
                  <input
                    className={`${inputClass} text-lg font-black`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={kpi.weight}
                    onChange={(e) => {
                      const weight = Number(e.target.value);
                      setKpis((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, weight } : row)));
                    }}
                  />
                </Field>
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-[28px] bg-white p-5 shadow-[0_8px_24px_rgba(255,121,0,0.06)]">
        <h2 className="text-lg font-black">📅 أيام الشغل</h2>
        <p className="mt-1 text-xs text-neutral-400">الحسابات بتعتمد على أيام الشغل الفعلية، مش الأيام التقويمية.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WEEK_DAYS.map((day) => (
            <button
              key={day.key}
              type="button"
              onClick={() => setWorkingDays((current) => ({ ...current, [day.key]: !current[day.key] }))}
              className={`min-h-12 rounded-2xl border text-sm font-extrabold ${
                workingDays[day.key] ? "border-[#ff7900] bg-orange-50 text-[#c45e00]" : "border-neutral-200 bg-neutral-50 text-neutral-400"
              }`}
            >
              {workingDays[day.key] ? "✅ " : ""}
              {day.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-5 shadow-[0_8px_24px_rgba(255,121,0,0.06)]">
        <h2 className="text-lg font-black">🏖️ إجازات الشهر</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input className={inputClass} type="date" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} />
          <input className={inputClass} placeholder="ملاحظة (اختياري)" value={holidayNote} onChange={(e) => setHolidayNote(e.target.value)} />
          <SecondaryButton type="button" onClick={addHoliday} className="w-full">
            ➕ ضيف
          </SecondaryButton>
        </div>
        {holidays.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-400">مفيش إجازات متسجلة للشهر ده.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {holidays.map((item) => (
              <li key={item.date} className="flex items-center justify-between rounded-2xl bg-orange-50 px-3 py-2 text-sm">
                <span className="font-bold">
                  {item.date}
                  {item.note ? ` · ${item.note}` : ""}
                </span>
                <button type="button" className="font-extrabold text-red-600" onClick={() => setHolidays((current) => current.filter((row) => row.date !== item.date))}>
                  شيل
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PrimaryButton type="submit" disabled={saving}>
        {saving ? "⏳ بنحفظ على السيرفر..." : "💾 احفظ إعدادات الشهر"}
      </PrimaryButton>
    </form>
  );
}
