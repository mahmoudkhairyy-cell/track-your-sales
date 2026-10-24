"use client";

import { FormEvent, useState } from "react";
import { KPI_CATALOG, type KpiKey } from "@/lib/constants";
import { cairoISODate } from "@/lib/dates";
import { Banner, Field, PrimaryButton, inputClass, useToast } from "@/components/ui";
import { ApiError, api } from "@/lib/client";
import { useMonth } from "@/components/AppShell";
import { quantityHint, quantityMax, quantityMin, quantityStep, validateQuantity } from "@/lib/quantity";

const CHEERS = [
  "🔥 عاش يا بطل! العملية اتسجلت",
  "💪 حلو أوي! كمّل كده",
  "🚀 واحدة كمان والتارجت بيقرّب",
  "⭐ شغل نضيف! اتسجلت",
  "🎯 تمام التمام، اتحفظت",
];

export default function LogPage() {
  const toast = useToast();
  const month = useMonth();

  const [kpiKey, setKpiKey] = useState<KpiKey>(KPI_CATALOG[0].key);
  const [quantity, setQuantity] = useState("");
  const [entryDate, setEntryDate] = useState(cairoISODate());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const selected = KPI_CATALOG.find((item) => item.key === kpiKey)!;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    // نفس قاعدة السيرفر بالظبط (src/lib/quantity.ts).
    const check = validateQuantity(kpiKey, quantity);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    const parsed = check.value;
    if (!entryDate) {
      setError("اختار تاريخ الإنجاز");
      return;
    }

    setPending(true);
    try {
      await api<{ message: string }>("/api/entries", {
        method: "POST",
        body: JSON.stringify({
          kpiKey,
          quantity: parsed,
          entryDate,
          note,
        }),
      });
      toast.push("success", CHEERS[Math.floor(Math.random() * CHEERS.length)]);
      setQuantity("");
      setNote("");
      setEntryDate(cairoISODate());
    } catch (err) {
      const message = err instanceof ApiError || err instanceof Error ? err.message : "مقدرناش نحفظ السجل، جرّب تاني";
      setError(message);
      toast.push("error", message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <section>
        <h1 className="text-2xl font-black">إنجاز اليوم ✍️</h1>
        <p className="mt-1 text-sm leading-7 text-neutral-500">سجّل اللي بعته النهارده — كل حفظة بتتسجل لوحدها وبتتجمع في الرئيسية.</p>
      </section>

      {error ? <Banner tone="error">❌ {error}</Banner> : null}

      <section className="space-y-4 rounded-[28px] bg-white p-5 shadow-[0_8px_24px_rgba(255,121,0,0.06)]">
        <div>
          <p className="mb-2 block text-sm font-bold text-neutral-800">اختار الإيتم</p>
          <div className="grid grid-cols-2 gap-2">
            {KPI_CATALOG.map((kpi) => {
              const active = kpi.key === kpiKey;
              return (
                <button
                  key={kpi.key}
                  type="button"
                  onClick={() => setKpiKey(kpi.key)}
                  className={`flex min-h-14 items-center gap-2 rounded-2xl border px-3 text-right text-sm font-extrabold transition ${
                    active ? "border-[#ff7900] bg-orange-50 text-[#c45e00]" : "border-neutral-200 bg-white text-neutral-700"
                  }`}
                >
                  <span className="text-xl">{kpi.emoji}</span>
                  <span dir="ltr" className="leading-5">
                    {kpi.nameEn}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <Field
          label={`${selected.emoji} الكمية (${selected.unitAr})`}
          hint={quantityHint(kpiKey)}
        >
          <input
            className={`${inputClass} text-2xl font-black`}
            type="number"
            inputMode={kpiKey === "quality" ? "decimal" : "numeric"}
            step={quantityStep(kpiKey)}
            min={quantityMin(kpiKey)}
            max={quantityMax(kpiKey)}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
            required
          />
        </Field>
        <Field label="📅 تاريخ الإنجاز">
          <input className={inputClass} type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
        </Field>
        <Field label="📝 ملاحظة (لو حابب)">
          <textarea className={`${inputClass} min-h-24 py-3`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="مثال: عميل جديد من الفرع" />
        </Field>
      </section>

      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "⏳ بنستنى رد السيرفر..." : "💾 احفظ إنجاز اليوم"}
      </PrimaryButton>
      <p className="text-center text-xs text-neutral-400">تاريخ الإنجاز هو اللي بيحدد شهر السجل · الشهر المعروض فوق: {month}</p>
    </form>
  );
}
