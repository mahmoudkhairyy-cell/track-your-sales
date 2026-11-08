"use client";

import { FormEvent, useEffect, useState } from "react";
import { KPI_CATALOG, kpiEmoji, type KpiKey } from "@/lib/constants";
import { cairoISODate, cairoYearMonth, monthDateRange } from "@/lib/dates";
import { haptic } from "@/lib/prefs";
import { Banner, PrimaryButton, inputClass, useToast } from "@/components/ui";
import { ApiError, api } from "@/lib/client";
import { useMonth } from "@/components/AppShell";
import { KpiIcon } from "@/components/KpiIcon";
import { formatQty } from "@/lib/calculations";
import { quantityHint, quantityMax, quantityMin, quantityStep, validateQuantity } from "@/lib/quantity";


type QualityKey = "kyc" | "visits" | "training" | "pos" | "csat";
/** الكواليتي = الـChecklist بس. */
type Quality = { checks?: Partial<Record<QualityKey, boolean>> };
const QUALITY_ITEMS: { key: QualityKey; label: string; weight: number }[] = [
  { key: "kyc", label: "KYC & Compliance", weight: 5 },
  { key: "visits", label: "Quality Visits", weight: 5 },
  { key: "training", label: "Training & Quiz", weight: 2 },
  { key: "pos", label: "POS machines", weight: 1 },
  { key: "csat", label: "CSAT / Complaints", weight: 2 },
];

type DashKpi = { kpiKey: KpiKey; target: number; weight: number; remaining: number; unitAr: string; contribution: number; gated: boolean };
/** rawOverall = الإجمالي قبل سقف 200%. بنستخدمه عشان نوزّع الكوميشن على المؤشرات بنفس النسبة المعروضة. */
type DashData = { kpis: DashKpi[]; fullCommission: number; overall: number; rawOverall?: number; work: { remaining: number } };

export default function LogPage() {
  const toast = useToast();
  const month = useMonth();

  const [dash, setDash] = useState<DashData | null>(null);
  const [quantities, setQuantities] = useState<Partial<Record<KpiKey, string>>>({});
  const [entryDate, setEntryDate] = useState(cairoISODate());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  // لو الشهر اتغيّر، التاريخ يتظبط عشان يقع جوه الشهر المعروض (وإلا الإنجاز بيروح لشهر تاني بصمت).
  useEffect(() => {
    setEntryDate((cur) => (cur.startsWith(month) ? cur : month === cairoYearMonth() ? cairoISODate() : `${month}-01`));
  }, [month]);

  // بنحدّث الأرقام لما نسجّل إنجاز جديد (tys-data-changed) عشان "الباقي" و"التوتال" ما يفضلوش قديمين.
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    const bump = () => setRefreshTick((n) => n + 1);
    window.addEventListener("tys-data-changed", bump);
    return () => window.removeEventListener("tys-data-changed", bump);
  }, []);

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
  }, [month, refreshTick]);

  // الكواليتي: بنند متعلم كل شهر. بيتحفظ فوراً مع إعدادات الشهر.
  const [settingsFull, setSettingsFull] = useState<Record<string, unknown> | null>(null);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [qualityBusy, setQualityBusy] = useState(false);
  // الكواليتي ماتتحفظش غير بعد ما التارجت الشهري يتحفظ أول مرة.
  const [monthSaved, setMonthSaved] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api<Record<string, unknown> & { quality: Quality }>(`/api/months/${month}`)
      .then((result) => {
        if (cancelled) return;
        const { quality: q, ...rest } = result.settings as unknown as Record<string, unknown> & { quality: Quality };
        setSettingsFull(rest);
        setMonthSaved(Boolean((result.settings as unknown as { saved?: boolean }).saved));
        setQuality(q ?? { checks: {} });
      })
      .catch(() => {
        if (!cancelled) setQuality(null);
      });
    return () => {
      cancelled = true;
    };
  }, [month, refreshTick]);

  async function toggleQuality(key: QualityKey) {
    if (!quality || !settingsFull || qualityBusy) return;
    if (!monthSaved) {
      setError("احفظ تارجت الشهر الأول قبل ما تعلّم الكواليتي");
      return;
    }
    const nextQuality: Quality = { ...quality, checks: { ...quality.checks, [key]: !quality.checks?.[key] } };
    setQuality(nextQuality);
    setQualityBusy(true);
    try {
      await api(`/api/months/${month}`, {
        method: "PUT",
        body: JSON.stringify({ ...settingsFull, quality: nextQuality }),
      });
      setMonthSaved(true);
      window.dispatchEvent(new Event("tys-data-changed"));
    } catch (err) {
      setQuality(quality);
      setError(err instanceof ApiError || err instanceof Error ? err.message : "مقدرناش نحفظ الكواليتي");
    } finally {
      setQualityBusy(false);
    }
  }

  const qualityScore = quality
    ? QUALITY_ITEMS.reduce((sum, item) => sum + (quality.checks?.[item.key] ? item.weight : 0), 0)
    : 0;

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
        // نشيل البند اللي اتحفظ من الحقول، عشان لو حصل خطأ بعده الإعادة ماتكررهوش.
        setQuantities((cur) => {
          const next = { ...cur };
          delete next[item.key];
          return next;
        });
      }
      haptic(18);
      toast.push("success", `تم تسجيل الإنجاز (${saved})`);
      window.dispatchEvent(new Event("tys-data-changed"));
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
    <form className="tys-page tys-page-log mx-auto max-w-4xl space-y-5 pb-8" onSubmit={onSubmit}>
      <section className="flex items-end justify-between gap-3 rounded-[26px] border border-[#f0dfd1] bg-white/85 px-4 py-4 shadow-[0_10px_28px_rgba(100,55,25,0.045)] sm:px-5">
        <div>
          <p className="text-[10px] font-black tracking-[0.16em] text-[#c66b34]">DAILY SALES ENTRY</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[#38291f]">إنجاز اليوم</h1>
          <p className="mt-1 text-xs font-semibold text-[#927b69]">سجّل مبيعاتك وإنجازاتك بسهولة — هتتحفظ تلقائيًا.</p>
        </div>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff0e2] text-2xl">✍️</span>
      </section>

      {error ? <Banner tone="error">❌ {error}</Banner> : null}

      {dash ? (
        <section className="rounded-[26px] border border-[#f0dfd1] bg-gradient-to-br from-white via-[#fffaf5] to-[#fff0e2] p-4 shadow-[0_12px_30px_rgba(100,55,25,0.055)] sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-black tracking-[0.14em] text-[#bd6a35]">MONTHLY SNAPSHOT</p>
              <h2 className="mt-0.5 text-sm font-black text-[#38291f]">ملخص الشهر</h2>
            </div>
            <span className="rounded-full border border-[#f0ddcd] bg-white px-3 py-1 text-[10px] font-extrabold text-[#a56b43]">مباشر</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-[#f1dfd0] bg-white/90 px-2 py-3 text-center">
              <p className="font-mono text-xl font-black tabular-nums text-[#bd4b0a]">{formatQty(Math.round(dash.overall))}%</p>
              <p className="mt-1 text-[10px] font-bold text-[#927b69]">تحقيق التارجت</p>
            </div>
            <div className="rounded-2xl border border-[#f1dfd0] bg-white/90 px-2 py-3 text-center">
              <p className="font-mono text-xl font-black tabular-nums text-[#38291f]">{formatQty(workLeft)}</p>
              <p className="mt-1 text-[10px] font-bold text-[#927b69]">أيام شغل فاضلة</p>
            </div>
            <div className="rounded-2xl border border-[#f1dfd0] bg-white/90 px-2 py-3 text-center">
              <p className="font-mono text-xl font-black tabular-nums text-[#38291f]">{formatQty(onTrack.length)}</p>
              <p className="mt-1 text-[10px] font-bold text-[#927b69]">مؤشرات لسه ناقصة</p>
            </div>
          </div>
        </section>
      ) : null}

      {onTrack.length > 0 ? (
        <section className="rounded-[24px] bg-[#fff0e2] p-4 text-[#bd4b0a]">
          <p className="text-sm font-extrabold">⚡ المطلوب منك النهارده عشان تفضل ON TRACK</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {onTrack.map((k) => (
              <span key={k.kpiKey} className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-[#bd4b0a] shadow-sm">
                {kpiEmoji(k.kpiKey)} {formatQty(workLeft > 0 ? Math.ceil(k.remaining / workLeft) : k.remaining)} · {KPI_CATALOG.find((i) => i.key === k.kpiKey)?.nameEn}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-[24px] border border-[#f2e4d8] bg-white p-4 shadow-sm">
        <label htmlFor="entry-date" className="block text-xs font-bold text-[#88796e]">📅 تاريخ الإنجاز</label>
        <input id="entry-date" className={`${inputClass} mt-2`} type="date" value={entryDate} min={monthDateRange(month).start} max={monthDateRange(month).end} onChange={(e) => setEntryDate(e.target.value)} required />
      </section>

      {KPI_CATALOG.filter((item) => item.key !== "quality" && !(item.key === "productivity" && (dashByKey.get("productivity")?.weight ?? 0) === 0)).map((item) => {
        const d = dashByKey.get(item.key);
        // لو الإجمالي اتقص عند 200%، توزيع الكوميشن على المؤشرات بيتقص بنفس النسبة عشان الأرقام تتجمع صح.
        const commissionScale = dash && dash.rawOverall && dash.rawOverall > dash.overall ? dash.overall / dash.rawOverall : 1;
        const commission = d ? Math.round((d.contribution / 100) * (dash?.fullCommission ?? 0) * commissionScale) : 0;
        const excluded = !!d && d.weight > 0 && d.gated;
        const needToday = d && workLeft > 0 ? Math.ceil(Math.max(0, d.remaining) / workLeft) : 0;
        return (
          <article key={item.key} className="rounded-[24px] border border-[#f2e4d8] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff0e2] text-[#e96812]"><KpiIcon kpiKey={item.key} className="h-5 w-5" /></span>
                <div>
                  <p className="font-extrabold" dir="ltr">{item.nameEn}</p>
                  <p className="text-[11px] font-bold text-[#bd4b0a]">
                    {excluded ? "متتحسبش" : commission > 0 ? `كوميشن ${commission} ج` : " "}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-[#fffaf5] p-2.5 text-center">
              <div>
                <p className="text-[10px] text-[#88796e]">المستهدف</p>
                <p className="text-sm font-black tabular-nums">{d ? formatQty(d.target) : "—"}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#88796e]">الوزن</p>
                <p className="text-sm font-black tabular-nums">{d ? d.weight : 0}%</p>
              </div>
              <div>
                <p className="text-[10px] text-[#88796e]">الباقي</p>
                <p className="text-sm font-black tabular-nums text-[#bd4b0a]">{d ? formatQty(Math.max(0, d.remaining)) : "—"}</p>
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
              <span className="shrink-0 text-xs font-bold text-[#88796e]">{d?.unitAr ?? ""}</span>
            </div>
            <p className="mt-2 text-[11px] text-[#88796e]" title={quantityHint(item.key)}>
              {needToday > 0 ? `المطلوب النهارده: ${formatQty(needToday)} ${d?.unitAr ?? ""}` : "مفيش مطلوب إضافي النهارده"}
            </p>
          </article>
        );
      })}

      {quality ? (
        <section className="rounded-[24px] border border-[#f2e4d8] bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-black">✅ الكواليتي (15%)</p>
            <p className="text-xs font-extrabold text-[#bd4b0a]">{qualityScore}% من 15%</p>
          </div>
          <p className="mb-3 text-[11px] text-[#88796e]">{monthSaved ? "علّم البند لو اتحقق بالكامل، والتغيير بيتحفظ فوراً." : "⚠️ احفظ تارجت الشهر الأول من صفحة التارجت، وبعدين تقدر تعلّم الكواليتي."}</p>
          <div className="space-y-2">
            {QUALITY_ITEMS.map((item) => {
              const on = !!quality.checks?.[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={qualityBusy || !monthSaved}
                  aria-pressed={on}
                  onClick={() => toggleQuality(item.key)}
                  className="flex w-full items-center justify-between rounded-2xl border border-[#f2e4d8] bg-white px-3 py-2.5 text-right disabled:opacity-60"
                >
                  <span className="flex items-center gap-3">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-black ${on ? "border-emerald-500 bg-emerald-500 text-white" : "border-[#f2e4d8] text-transparent"}`}>✓</span>
                    <span className="flex flex-col items-start gap-0.5">
                      <span className="text-sm font-extrabold" dir="ltr">{item.label}</span>
                    </span>
                  </span>
                  <span className="text-xs font-black text-[#88796e]">{item.weight}%</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="rounded-[24px] border border-[#f2e4d8] bg-white p-4">
        <label htmlFor="entry-note" className="block text-xs font-bold text-[#88796e]">📝 ملاحظة (لو حابب)</label>
        <textarea
          id="entry-note"
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
      <p className="text-center text-xs text-[#88796e]">التاريخ اللي فوق هو اللي بيحدد الشهر · الشهر المعروض: {month}</p>
    </form>
  );
}
