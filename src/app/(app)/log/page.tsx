"use client";

import { FormEvent, useEffect, useState } from "react";
import { KPI_CATALOG, kpiEmoji, type KpiKey } from "@/lib/constants";
import { cairoISODate, cairoYearMonth, monthLabelAr } from "@/lib/dates";
import { haptic } from "@/lib/prefs";
import { Banner, PrimaryButton, inputClass, useToast } from "@/components/ui";
import { ApiError, api } from "@/lib/client";
import { useMonth } from "@/components/AppShell";
import { KpiIcon } from "@/components/KpiIcon";
import { formatMoney, formatQty } from "@/lib/calculations";
import { overallLine } from "@/lib/phrases";
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
type DashData = { kpis: DashKpi[]; fullCommission: number; estimatedCommission: number; overall: number; rawOverall?: number; work: { total: number; elapsed: number; elapsedBeforeToday?: number; remaining: number } };

function lastDateOfMonth(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  return `${yearMonth}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
}

function isValidEntryDate(value: string, yearMonth: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0, 7) !== yearMonth) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export default function LogPage() {
  const toast = useToast();
  const month = useMonth();

  const [dash, setDash] = useState<DashData | null>(null);
  const [quantities, setQuantities] = useState<Partial<Record<KpiKey, string>>>({});
  const [entryDateState, setEntryDateState] = useState(() => ({
    month,
    value: month === cairoYearMonth() ? cairoISODate() : `${month}-01`,
  }));
  // لكل شهر تاريخ مستقل؛ عند تغيير الشهر نعرض اليوم أو أول الشهر دون تحديث state داخل effect.
  const entryDate = entryDateState.month === month
    ? entryDateState.value
    : month === cairoYearMonth() ? cairoISODate() : `${month}-01`;
  const setEntryDate = (value: string) => setEntryDateState({ month, value });
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

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
      setError(err instanceof ApiError || err instanceof Error ? err.message : "ماقدرناش نحفظ الكواليتي. اتأكد من النت وحاول تاني.");
    } finally {
      setQualityBusy(false);
    }
  }

  const qualityScore = quality
    ? QUALITY_ITEMS.reduce((sum, item) => sum + (quality.checks?.[item.key] ? item.weight : 0), 0)
    : 0;
  const dashByKey = new Map((dash?.kpis ?? []).map((k) => [k.kpiKey, k]));
  const dailyItems = (dash?.kpis ?? []).filter((k) => k.remaining > 0);
  const workLeft = dash?.work.remaining ?? 0;
  const doneDays = dash ? (dash.work.elapsedBeforeToday ?? dash.work.elapsed) : 0;
  const performanceOnTrack: boolean | null = dash && dash.work.total > 0
    ? dash.overall >= (doneDays / dash.work.total) * 100
    : null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!isValidEntryDate(entryDate, month)) {
      setError("اختار تاريخًا صحيحًا داخل شهر " + monthLabelAr(month) + " قبل الحفظ.");
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
      setEntryDate(month === cairoYearMonth() ? cairoISODate() : `${month}-01`);
    } catch (err) {
      const message = err instanceof ApiError || err instanceof Error ? err.message : "ماقدرناش نحفظ السجل. اتأكد من النت وحاول تاني.";
      setError(saved > 0 ? `اتحفظ ${saved} من ${filled.length} بس. ${message}` : message);
      toast.push("error", message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="tys-page tys-page-log mx-auto max-w-5xl space-y-5 pb-8" onSubmit={onSubmit}>
      <section className="flex items-end justify-between gap-3 rounded-[26px] border border-[var(--color-border)] bg-white/85 px-4 py-4 shadow-[0_10px_28px_rgba(100,55,25,0.045)] sm:px-5">
        <div>
          <p className="text-[10px] font-black tracking-[0.16em] text-[#c66b34]">DAILY SALES ENTRY</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--color-text-primary)]">تسجيل إنجاز</h1>
          <p className="mt-1 text-xs font-semibold text-[var(--color-text-secondary)]">سجّل مبيعاتك وإنجازاتك بسهولة — هتتحفظ تلقائيًا.</p>
        </div>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary-50)] text-2xl">✍️</span>
      </section>

      {error ? <Banner tone="error">❌ {error}</Banner> : null}



      {dash ? (
        <section className="rounded-2xl border border-[var(--color-border)] bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-black tracking-wide text-[var(--color-primary-700)]">DAILY</p>
              <h2 className="mt-0.5 text-sm font-extrabold text-[var(--color-text-primary)]">الديلي المطلوب</h2>
            </div>
            <span className="shrink-0 rounded-full bg-[var(--color-primary-50)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--color-primary-700)]">
              فاضل {formatQty(workLeft)} يوم عمل
            </span>
          </div>
          {dailyItems.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {dailyItems.map((k) => (
                <div key={k.kpiKey} className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-[var(--color-surface-cream)] px-2.5 py-2">
                  <span className="min-w-0 truncate text-[11px] font-bold text-[var(--color-text-secondary)]" dir="ltr">
                    {KPI_CATALOG.find((i) => i.key === k.kpiKey)?.nameEn ?? k.kpiKey}
                  </span>
                  <strong className="shrink-0 text-sm font-black tabular-nums text-[var(--color-primary-700)]">
                    {formatQty(workLeft > 0 ? Math.ceil(k.remaining / workLeft) : k.remaining)}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-[var(--color-primary-50)] px-3 py-2 text-xs font-bold text-[var(--color-primary-700)]">كل المؤشرات وصلت للتارجت 🎉</p>
          )}
        </section>
      ) : null}

      <section className="rounded-[22px] border border-[var(--color-border)] bg-white p-3 shadow-sm sm:rounded-[24px] sm:p-4">
        <label htmlFor="entry-date" className="block text-xs font-bold text-[var(--color-text-secondary)]">📅 تاريخ الإنجاز</label>
        <input id="entry-date" className={`${inputClass} mt-2`} type="date" min={`${month}-01`} max={lastDateOfMonth(month)} value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
        <p className="mt-2 text-xs leading-6 text-[var(--color-text-secondary)]">تاريخ الإنجاز لازم يكون داخل شهر {monthLabelAr(month)} المحدد أعلى التطبيق.</p>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {KPI_CATALOG.filter((item) => item.key !== "quality" && !(item.key === "productivity" && (dashByKey.get("productivity")?.weight ?? 0) === 0)).map((item) => {
        const d = dashByKey.get(item.key);
        // لو الإجمالي اتقص عند 200%، توزيع الكوميشن على المؤشرات بيتقص بنفس النسبة عشان الأرقام تتجمع صح.
        const commissionScale = dash && dash.rawOverall && dash.rawOverall > dash.overall ? dash.overall / dash.rawOverall : 1;
        const commission = d ? Math.round((d.contribution / 100) * (dash?.fullCommission ?? 0) * commissionScale) : 0;
        const excluded = !!d && d.weight > 0 && d.gated;
        const needToday = d && workLeft > 0 ? Math.ceil(Math.max(0, d.remaining) / workLeft) : 0;
        return (
          <article key={item.key} className="rounded-[18px] border border-[var(--color-border)] bg-[#fffaf5] p-2.5 shadow-sm sm:rounded-[20px] sm:p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ffeddc] text-[var(--color-primary-600)]"><KpiIcon kpiKey={item.key} className="h-[18px] w-[18px]" /></span>
                <div>
                  <p className="font-extrabold" dir="ltr">{item.nameEn}</p>
                  <p className="text-[11px] font-bold text-[var(--color-primary-700)]">
                    {excluded ? "متتحسبش غير لما تكمل 90%" : commission > 0 ? `كوميشن ${commission} ج` : " "}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-1.5 rounded-xl bg-[#ffefdf] p-2 text-center">
              <div>
                <p className="text-[10px] text-[var(--color-text-secondary)]">المستهدف</p>
                <p className="text-sm font-black tabular-nums">{d ? formatQty(d.target) : "—"}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--color-text-secondary)]">الوزن</p>
                <p className="text-sm font-black tabular-nums">{d ? d.weight : 0}%</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--color-text-secondary)]">الباقي</p>
                <p className="text-sm font-black tabular-nums text-[var(--color-primary-700)]">{d ? formatQty(Math.max(0, d.remaining)) : "—"}</p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <label className="sr-only" htmlFor={`quantity-${item.key}`}>Quantity — {item.nameEn}</label>
              <input
                id={`quantity-${item.key}`}
                className={`${inputClass} text-lg font-black`}
                type="number"
                inputMode="numeric"
                step={quantityStep(item.key)}
                min={quantityMin(item.key)}
                max={quantityMax(item.key)}
                value={quantities[item.key] ?? ""}
                onChange={(e) => setQuantities((cur) => ({ ...cur, [item.key]: e.target.value }))}
                placeholder="0"
                aria-label={`Quantity ${item.nameEn}`}
              />
              <span className="shrink-0 text-xs font-bold text-[var(--color-text-secondary)]">{d?.unitAr ?? ""}</span>
            </div>
            <p className="mt-1.5 text-[10px] text-[var(--color-text-secondary)]" title={quantityHint(item.key)}>
              {needToday > 0 ? `المطلوب النهارده: ${formatQty(needToday)} ${d?.unitAr ?? ""}` : "مفيش مطلوب إضافي النهارده"}
            </p>
          </article>
        );
      })}
      </section>

      {quality ? (
        <section className="rounded-[22px] border border-[var(--color-border)] bg-white p-3 shadow-sm sm:rounded-[24px] sm:p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-black">✅ الكواليتي (15%)</p>
            <p className="text-xs font-extrabold text-[var(--color-primary-700)]">{qualityScore}% من 15%</p>
          </div>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-[var(--color-primary-50)]" role="progressbar" aria-label="نسبة الكواليتي" aria-valuemin={0} aria-valuemax={15} aria-valuenow={qualityScore}>
            <div className="h-full rounded-full bg-gradient-to-l from-[var(--color-primary-500)] to-[var(--color-primary-700)] transition-all duration-500" style={{ width: `${Math.min(100, (qualityScore / 15) * 100)}%` }} />
          </div>
          <p className="mb-3 text-[11px] text-[var(--color-text-secondary)]">{monthSaved ? "علّم البند لو اتحقق بالكامل، والتغيير بيتحفظ فوراً." : "⚠️ احفظ تارجت الشهر الأول من صفحة التارجت، وبعدين تقدر تعلّم الكواليتي."}</p>
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
                  className="flex w-full items-center justify-between rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2.5 text-right disabled:opacity-60"
                >
                  <span className="flex items-center gap-3">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-black ${on ? "border-emerald-500 bg-emerald-500 text-white" : "border-[var(--color-border)] text-transparent"}`}>✓</span>
                    <span className="flex flex-col items-start gap-0.5">
                      <span className="text-sm font-extrabold" dir="ltr">{item.label}</span>
                    </span>
                  </span>
                  <span className="text-xs font-black text-[var(--color-text-secondary)]">{item.weight}%</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="rounded-[22px] border border-[var(--color-border)] bg-white p-3 sm:rounded-[24px] sm:p-4">
        <label htmlFor="entry-note" className="block text-xs font-bold text-[var(--color-text-secondary)]">📝 ملاحظة (لو حابب)</label>
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
        {pending ? "⏳ بنحفظ..." : "💾 احفظ الإنجاز"}
      </PrimaryButton>
      <p className="text-center text-xs text-[var(--color-text-secondary)]">التاريخ اللي فوق هو اللي بيحدد الشهر · الشهر المعروض: {month}</p>
    </form>
  );
}
