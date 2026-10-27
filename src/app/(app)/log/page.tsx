"use client";

import { FormEvent, useEffect, useState } from "react";
import { KPI_CATALOG, kpiEmoji, type KpiKey } from "@/lib/constants";
import { cairoISODate } from "@/lib/dates";
import { Banner, PrimaryButton, inputClass, useToast } from "@/components/ui";
import { ApiError, api } from "@/lib/client";
import { useMonth } from "@/components/AppShell";
import { KpiIcon } from "@/components/KpiIcon";
import { formatQty } from "@/lib/calculations";
import { quantityHint, quantityMax, quantityMin, quantityStep, validateQuantity } from "@/lib/quantity";

const CHEERS = [
  "🔥 عاش يا بطل! العملية اتسجلت",
  "💪 حلو أوي! كمّل كده",
  "🚀 واحدة كمان والتارجت بيقرّب",
  "⭐ شغل نضيف! اتسجلت",
  "🎯 تمام التمام، اتحفظت",
];

type DashKpi = { kpiKey: KpiKey; target: number; weight: number; remaining: number; unitAr: string; contribution: number; gated: boolean };
type DashData = { kpis: DashKpi[]; fullCommission: number; overall: number; work: { remaining: number } };

export default function LogPage() {
  const toast = useToast();
  const month = useMonth();

  const [dash, setDash] = useState<DashData | null>(null);
  const [quantities, setQuantities] = useState<Partial<Record<KpiKey, string>>>({});
  const [entryDate, setEntryDate] = useState(cairoISODate());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<DashData>(`/api/dashboard?month=${month}`)
      .then((result) => {
        if (!cancelled) setDash(result);
      })
      .catch(() => {
        if (!cancelled) setDash(null);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const dashByKey = new Map((dash?.kpis ?? []).map((k) => [k.kpiKey, k]));
  const onTrack = (dash?.kpis ?? []).filter((k) => k.weight > 0 && k.remaining > 0);
  const workLeft = dash?.work.remaining ?? 0;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!entryDate) {
      setError("اختار تاريخ الإنجاز");
      return;
    }
    const filled = KPI_CATALOG.filter((item) => (quantities[item.key] ?? "").trim() !== "");
    if (filled.length === 0) {
      setError("اكتب كمية لواحد على الأقل قبل الحفظ");
      return;
    }
    for (const item of filled) {
      const check = validateQuantity(item.key, quantities[item.key]);
      if (!check.ok) {
        setError(`${item.nameEn}: ${check.message}`);
        return;
      }
    }

    setPending(true);
    let saved = 0;
    try {
      for (const item of filled) {
        const check = validateQuantity(item.key, quantities[item.key]);
        if (!check.ok) continue;
        await api<{ message: string }>("/api/entries", {
          method: "POST",
          body: JSON.stringify({ kpiKey: item.key, quantity: check.value, entryDate, note }),
        });
        saved += 1;
      }
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(30);
      toast.push("success", `${CHEERS[Math.floor(Math.random() * CHEERS.length)]} (${saved})`);
      setQuantities({});
      setNote("");
      setEntryDate(cairoISODate());
    } catch (err) {
      const message = err instanceof ApiError || err instanceof Error ? err.message : "مقدرناش نحفظ السجل، جرّب تاني";
      setError(saved > 0 ? `اتحفظ ${saved} من ${filled.length} بس. ${message}` : message);
      toast.push("error", message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <section>
        <h1 className="text-3xl font-black">إنجاز اليوم</h1>
        <p className="mt-1 text-sm text-neutral-500">سجّل اللي بعته النهارده — هيتحفظ تلقائيًا.</p>
      </section>

      {error ? <Banner tone="error">❌ {error}</Banner> : null}

      {dash ? (
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#f0802a] via-[#e06600] to-[#b84700] p-5 text-white shadow-[0_20px_50px_rgba(190,90,0,0.35)] ring-1 ring-white/30">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-white/15 px-2 py-3 ring-1 ring-white/25">
              <p className="text-xl font-black tabular-nums">{formatQty(Math.round(dash.overall))}%</p>
              <p className="text-[11px] text-white/85">التوتال</p>
            </div>
            <div className="rounded-2xl bg-white/15 px-2 py-3 ring-1 ring-white/25">
              <p className="text-xl font-black tabular-nums">{formatQty(workLeft)}</p>
              <p className="text-[11px] text-white/85">أيام فاضلة</p>
            </div>
            <div className="rounded-2xl bg-white/15 px-2 py-3 ring-1 ring-white/25">
              <p className="text-xl font-black tabular-nums">{formatQty(onTrack.length)}</p>
              <p className="text-[11px] text-white/85">مؤشرات ناقصة</p>
            </div>
          </div>
        </section>
      ) : null}

      {onTrack.length > 0 ? (
        <section className="rounded-[24px] bg-orange-100 p-4 text-[#8f4300]">
          <p className="text-sm font-extrabold">⚡ المطلوب منك النهارده عشان تفضل ON TRACK</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {onTrack.map((k) => (
              <span key={k.kpiKey} className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-[#8f4300] shadow-sm">
                {kpiEmoji(k.kpiKey)} {formatQty(workLeft > 0 ? Math.ceil(k.remaining / workLeft) : k.remaining)} · {KPI_CATALOG.find((i) => i.key === k.kpiKey)?.nameEn}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-[24px] border border-orange-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
        <label className="block text-xs font-bold text-neutral-500">📅 تاريخ الإنجاز</label>
        <input className={`${inputClass} mt-2`} type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
      </section>

      {KPI_CATALOG.filter((item) => item.key !== "quality" && !(item.key === "productivity" && (dashByKey.get("productivity")?.weight ?? 0) === 0)).map((item) => {
        const d = dashByKey.get(item.key);
        const commission = d ? Math.round((d.contribution / 100) * (dash?.fullCommission ?? 0)) : 0;
        const excluded = !!d && d.weight > 0 && d.gated;
        const needToday = d && workLeft > 0 ? Math.ceil(Math.max(0, d.remaining) / workLeft) : 0;
        return (
          <article key={item.key} className="rounded-[24px] border border-orange-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-[#e06600]"><KpiIcon kpiKey={item.key} className="h-5 w-5" /></span>
                <div>
                  <p className="font-extrabold" dir="ltr">{item.nameEn}</p>
                  <p className="text-[11px] font-bold text-[#8f4300]">
                    {excluded ? "متتحسبش" : commission > 0 ? `كوميشن ${commission} ج` : " "}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-orange-50/70 p-2.5 text-center">
              <div>
                <p className="text-[10px] text-neutral-500">المستهدف</p>
                <p className="text-sm font-black tabular-nums">{d ? formatQty(d.target) : "—"}</p>
              </div>
              <div>
                <p className="text-[10px] text-neutral-500">الوزن</p>
                <p className="text-sm font-black tabular-nums">{d ? d.weight : 0}%</p>
              </div>
              <div>
                <p className="text-[10px] text-neutral-500">الباقي</p>
                <p className="text-sm font-black tabular-nums text-[#b84700]">{d ? formatQty(Math.max(0, d.remaining)) : "—"}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                className={`${inputClass} text-lg font-black`}
                type="number"
                inputMode="numeric"
                step={quantityStep(item.key)}
                min={quantityMin(item.key)}
                max={quantityMax(item.key)}
                value={quantities[item.key] ?? ""}
                onChange={(e) => setQuantities((cur) => ({ ...cur, [item.key]: e.target.value }))}
                placeholder="0"
                aria-label={`كمية ${item.nameEn}`}
              />
              <span className="shrink-0 text-xs font-bold text-neutral-500">{d?.unitAr ?? ""}</span>
            </div>
            <p className="mt-2 text-[11px] text-neutral-400" title={quantityHint(item.key)}>
              {needToday > 0 ? `المطلوب النهارده: ${formatQty(needToday)} ${d?.unitAr ?? ""}` : "مفيش مطلوب إضافي النهارده"}
            </p>
          </article>
        );
      })}

      <section className="rounded-[24px] border border-orange-200/70 bg-white p-4">
        <label className="block text-xs font-bold text-neutral-500">📝 ملاحظة (لو حابب)</label>
        <textarea
          className={`${inputClass} mt-2 min-h-20 py-3`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="مثال: عميل جديد من الفرع"
        />
      </section>

      <PrimaryButton type="submit" disabled={pending}>
        {pending ? "⏳ بنحفظ..." : "💾 احفظ إنجاز اليوم"}
      </PrimaryButton>
      <p className="text-center text-xs text-neutral-400">التاريخ اللي فوق هو اللي بيحدد الشهر · الشهر المعروض: {month}</p>
    </form>
  );
}
