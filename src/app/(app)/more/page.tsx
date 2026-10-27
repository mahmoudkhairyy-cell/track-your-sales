"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Banner, EmptyState, Field, Modal, PrimaryButton, SecondaryButton, Spinner, inputClass, useToast } from "@/components/ui";
import { ApiError, api, downloadJson } from "@/lib/client";
import { cairoISODate, formatDateAr, formatTimeCairo, monthLabelAr } from "@/lib/dates";
import { formatQty } from "@/lib/calculations";
import { parseBackup, type BackupFile } from "@/lib/backup";
import { KPI_CATALOG, kpiEmoji, type KpiKey } from "@/lib/constants";
import { useMonth } from "@/components/AppShell";
import { KpiIcon } from "@/components/KpiIcon";
import { useHistoryView } from "@/lib/use-history-view";
import { quantityHint, quantityMax, quantityMin, quantityStep, validateQuantity } from "@/lib/quantity";

type EntryRow = {
  id: string;
  kpiKey: KpiKey;
  quantity: number;
  entryDate: string;
  note: string | null;
  createdAt: string;
  nameEn: string;
  nameAr: string;
  unitAr: string;
};

type TodayItem = {
  kpiKey: string;
  nameEn: string;
  nameAr: string;
  unitAr: string;
  quantity: number;
  count: number;
};

export default function MorePage() {
  const [view, setView] = useHistoryView<"menu" | "today" | "history" | "profile" | "backup" | "about" | "report">("menu");
  const [reportData, setReportData] = useState<{ overall: number; estimatedCommission: number; fullCommission: number; kpis: { kpiKey: string; nameEn: string; achieved: number; target: number; percent: number; contribution: number }[] } | null>(null);

  const toast = useToast();
  const router = useRouter();
  const month = useMonth();
  useEffect(() => {
    if (view !== "report") return;
    api<{ overall: number; estimatedCommission: number; fullCommission: number; kpis: { kpiKey: string; nameEn: string; achieved: number; target: number; percent: number; contribution: number }[] }>(`/api/dashboard?month=${month}`)
      .then((result) => setReportData(result))
      .catch(() => setReportData(null));
  }, [view, month]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [todaySummary, setTodaySummary] = useState<TodayItem[]>([]);
  const [profile, setProfile] = useState({ name: "", branch: "", role: "user" });
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("");
  const [pending, setPending] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EntryRow | null>(null);
  const [editKpi, setEditKpi] = useState<KpiKey>("new_lines");
  const [editQuantity, setEditQuantity] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editError, setEditError] = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  const [clearConfirm, setClearConfirm] = useState("");
  const [restoreSummary, setRestoreSummary] = useState<string>("");
  const [restoreBackup, setRestoreBackup] = useState<BackupFile | null>(null);
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace" | "">("");
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [replaceReady, setReplaceReady] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [entryData, dash] = await Promise.all([
        api<{ entries: EntryRow[] }>(`/api/entries?month=${month}`),
        api<{
          profile: { name: string; branch: string; role: string };
          todaySummary: TodayItem[];
        }>(`/api/dashboard?month=${month}`),
      ]);
      setEntries(entryData.entries);
      setTodaySummary(dash.todaySummary);
      setProfile({ name: dash.profile.name, branch: dash.profile.branch, role: dash.profile.role });
      setName(dash.profile.name);
      setBranch(dash.profile.branch);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "تعذر تحميل صفحة المزيد");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await api<{ message: string; user: { name: string; branch: string } }>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ name, branch }),
      });
      toast.push("success", result.message);
      setProfile((current) => ({ ...current, name: result.user.name, branch: result.user.branch }));
      router.refresh();
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "فشل تحديث الملف");
    } finally {
      setPending(false);
    }
  }

  function openEdit(entry: EntryRow) {
    setEditing(entry);
    setEditKpi(entry.kpiKey);
    setEditQuantity(String(entry.quantity));
    setEditDate(entry.entryDate);
    setEditNote(entry.note ?? "");
    setEditError("");
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setEditError("");
    const check = validateQuantity(editKpi, editQuantity);
    if (!check.ok) {
      setEditError(check.message);
      return;
    }
    if (!editDate) {
      setEditError("اختار تاريخ الإنجاز");
      return;
    }
    setPending(true);
    try {
      const result = await api<{ message: string }>(`/api/entries/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ kpiKey: editKpi, quantity: check.value, entryDate: editDate, note: editNote }),
      });
      toast.push("success", result.message);
      setEditing(null);
      await load();
    } catch (err) {
      const message = err instanceof ApiError || err instanceof Error ? err.message : "مقدرناش نعدّل السجل";
      setEditError(message);
      toast.push("error", message);
    } finally {
      setPending(false);
    }
  }

  async function deleteEntry() {
    if (!deleteId) return;
    setPending(true);
    try {
      const result = await api<{ message: string }>(`/api/entries/${deleteId}`, { method: "DELETE" });
      toast.push("success", result.message);
      setDeleteId(null);
      await load();
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "فشل حذف السجل");
    } finally {
      setPending(false);
    }
  }

  async function clearMonth() {
    if (clearConfirm !== month) return;
    setPending(true);
    try {
      const result = await api<{ message: string }>(`/api/months/${month}/clear`, {
        method: "POST",
        body: JSON.stringify({ confirmMonth: month }),
      });
      toast.push("success", result.message);
      setClearOpen(false);
      setClearConfirm("");
      await load();
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "فشل مسح الشهر");
    } finally {
      setPending(false);
    }
  }

  async function exportBackup() {
    setPending(true);
    try {
      const result = await api<{ backup: BackupFile; summary: { entries: number; months: number; articles: number; isEmpty: boolean }; message: string }>(
        "/api/backup/export",
      );
      if (!result.backup || !Array.isArray(result.backup.entries) || !Array.isArray(result.backup.months) || !result.backup.profile) {
        throw new Error("التصدير ناقص، الملف متنزلش");
      }
      downloadJson(`targetx-backup-${cairoISODate()}.json`, result.backup);
      toast.push("info", result.message);
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "فشل التصدير");
    } finally {
      setPending(false);
    }
  }

  async function onPickRestore(file: File | null) {
    if (!file) return;
    setPending(true);
    try {
      const text = await file.text();
      const raw = JSON.parse(text) as unknown;
      const parsed = parseBackup(raw);
      const validated = await api<{ summary: { months: number; entries: number; articles: number; isEmpty: boolean; profile: { name: string; branch: string } } }>(
        "/api/backup/restore",
        {
          method: "POST",
          body: JSON.stringify({ dryRun: true, backup: parsed }),
        },
      );
      setRestoreBackup(parsed);
      setRestoreSummary(
        `الملف لـ ${validated.summary.profile.name} / ${validated.summary.profile.branch} — شهور: ${validated.summary.months} — سجلات: ${validated.summary.entries} — مقالات: ${validated.summary.articles}${validated.summary.isEmpty ? " — الملف فاضي من السجلات." : ""}`,
      );
      setRestoreMode("");
      setReplaceReady(false);
      setRestoreOpen(true);
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "الملف غير صالح");
      setRestoreBackup(null);
    } finally {
      setPending(false);
    }
  }

  async function prepareReplace() {
    setPending(true);
    try {
      const result = await api<{ backup: BackupFile }>("/api/backup/export");
      if (!result.backup || !Array.isArray(result.backup.entries)) {
        throw new Error("النسخة الاحتياطية الحالية ناقصة، الاستبدال متوقف");
      }
      downloadJson(`targetx-before-replace-${cairoISODate()}.json`, result.backup);
      setReplaceReady(true);
      toast.push("info", "اتنزّلت نسخة احتياطية من بياناتك الحالية. تقدر تكمل الاستبدال.");
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "فشل تجهيز نسخة قبل الاستبدال");
    } finally {
      setPending(false);
    }
  }

  async function applyRestore() {
    if (!restoreBackup || !restoreMode) return;
    if (restoreMode === "replace" && !replaceReady) {
      toast.push("error", "حمّل النسخة الاحتياطية الحالية قبل الاستبدال");
      return;
    }
    setPending(true);
    try {
      const result = await api<{ message: string }>("/api/backup/restore", {
        method: "POST",
        body: JSON.stringify({
          dryRun: false,
          mode: restoreMode,
          backup: restoreBackup,
          confirmReplace: restoreMode === "replace",
        }),
      });
      toast.push("success", result.message);
      setRestoreOpen(false);
      setRestoreBackup(null);
      await load();
      router.refresh();
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "فشلت الاستعادة");
    } finally {
      setPending(false);
    }
  }

  if (loading) return <Spinner label="ثواني… بنحمّل الصفحة" />;
  if (error) return <Banner tone="error">{error}</Banner>;

  const todayItems = todaySummary.filter((item) => item.quantity > 0 || item.count > 0);

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#f0802a] via-[#e06600] to-[#b84700] p-5 text-white shadow-[0_20px_50px_rgba(190,90,0,0.35)]">
        <img src="/track-your-sales/logo-full.png" alt="Track Your Sales" className="h-16 w-auto object-contain" />
        <p className="mt-1 text-xs text-white/85">أداة مساعدة مستقلة وغير رسمية، وليست تطبيقًا رسميًا تابعًا لشركة Orange.</p>
        <p className="mt-3 text-xs text-white/80">ملخص النهارده، سجل الشهر، النسخة الاحتياطية، والمساعد.</p>
        {reportData ? (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-white/15 px-2 py-3 ring-1 ring-white/25">
              <p className="text-xl font-black tabular-nums">{Math.round(reportData.overall)}%</p>
              <p className="text-[11px] text-white/85">التوتال</p>
            </div>
            <div className="rounded-2xl bg-white/15 px-2 py-3 ring-1 ring-white/25">
              <p className="text-xl font-black tabular-nums">{Math.round(reportData.estimatedCommission)}</p>
              <p className="text-[11px] text-white/85">الكوميشن (ج)</p>
            </div>
            <div className="rounded-2xl bg-white/15 px-2 py-3 ring-1 ring-white/25">
              <p className="text-xl font-black tabular-nums">{entries.length}</p>
              <p className="text-[11px] text-white/85">سجلات الشهر</p>
            </div>
          </div>
        ) : null}
      </section>

      {view === "menu" ? (
        <div className="space-y-3">
          {[
            { key: "today", icon: "📊", title: "اللي عملته النهارده", desc: "ملخص إنجازات اليوم" },
            { key: "history", icon: "🗂️", title: "سجل العمليات", desc: "كل الإنجازات الشهر ده" },
            { key: "profile", icon: "👤", title: "بياناتك", desc: "الاسم والفرع" },
            { key: "backup", icon: "💾", title: "نسخة احتياطية واستعادة", desc: "احفظ بياناتك أو استرجعها" },
            { key: "report", icon: "📄", title: "تقرير الشهر", desc: "اطبعه أو احفظه PDF" },
            { key: "about", icon: "ℹ️", title: "حول التطبيق", desc: "معلومات عن الأداة" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setView(item.key as typeof view)}
              className="flex w-full items-center gap-4 rounded-[24px] border border-orange-200/70 bg-white p-4 text-right shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-2xl">{item.icon}</span>
              <span className="flex-1">
                <span className="block font-black text-neutral-900">{item.title}</span>
                <span className="block text-xs text-neutral-500">{item.desc}</span>
              </span>
              <span className="text-neutral-300">‹</span>
            </button>
          ))}
        </div>
      ) : null}

      {view === "report" ? (
        <section className="space-y-4">
          <button type="button" onClick={() => setView("menu")} className="text-sm font-extrabold text-[#e06600]">← رجوع للقائمة</button>
          <div id="report-print" className="rounded-[24px] border border-orange-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
            <p className="text-xs font-bold text-neutral-500">تقرير الشهر · {monthLabelAr(month)}</p>
            <h2 className="mt-1 text-xl font-black">{profile.name || "—"}</h2>
            <p className="text-sm text-neutral-500">📍 {profile.branch || "—"}</p>
            {reportData ? (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-orange-100 p-3"><p className="text-[11px] font-bold text-neutral-500">التوتال</p><p className="text-2xl font-black text-[#8f4300]">{reportData.overall.toFixed(1)}%</p></div>
                  <div className="rounded-2xl bg-orange-100 p-3"><p className="text-[11px] font-bold text-neutral-500">الكوميشن المتوقع</p><p className="text-2xl font-black text-[#8f4300]">{Math.round(reportData.estimatedCommission)} ج</p><p className="text-[10px] text-neutral-500">من {Math.round(reportData.fullCommission)} ج</p></div>
                </div>
                <div className="mt-4 divide-y divide-dashed divide-orange-200">
                  {reportData.kpis.map((kpi) => (
                    <div key={kpi.kpiKey} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="font-extrabold" dir="ltr">{kpi.nameEn}</span>
                      <span className="text-neutral-600">{formatQty(kpi.achieved)} / {formatQty(kpi.target)} · <b className="text-[#8f4300]">{kpi.percent.toFixed(0)}%</b></span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-neutral-500">بنحمّل التقرير...</p>
            )}
          </div>
          <button type="button" onClick={() => window.print()} className="w-full rounded-2xl bg-gradient-to-br from-[#f0802a] to-[#b84700] py-3 font-extrabold text-white shadow-[0_10px_24px_rgba(190,90,0,0.3)]">
            🖨️ اطبع / احفظ PDF
          </button>
        </section>
      ) : null}

      {view === "about" ? (
        <div className="space-y-4">
          <button type="button" onClick={() => setView("menu")} className="text-sm font-extrabold text-[#e06600]">← رجوع للقائمة</button>
          <section className="rounded-[24px] border border-orange-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
            <p className="font-black">Target Tracker</p>
            <p className="mt-2 text-sm leading-7 text-neutral-600">أداة مساعدة مستقلة وغير رسمية، وليست تطبيقًا رسميًا تابعًا لشركة Orange.</p>
          </section>
        </div>
      ) : null}

      {view === "today" ? (
        <div className="space-y-4">
          <button type="button" onClick={() => setView("menu")} className="text-sm font-extrabold text-[#e06600]">← رجوع للقائمة</button>
      <section className="rounded-[24px] border border-orange-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
        <h2 className="text-lg font-black tracking-tight">📊 اللي عملته النهارده</h2>
        {todayItems.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-400">لسه مسجلتش حاجة النهارده. يلا نبدأ! 💪</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {todayItems.map((item) => (
              <li key={item.kpiKey} className="flex items-center justify-between rounded-2xl bg-orange-100 px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center text-[#e06600]"><KpiIcon kpiKey={item.kpiKey} className="h-5 w-5" /></span>
                  <span>
                    <span dir="ltr" className="font-extrabold">{item.nameEn}</span>
                    <span className="block text-xs text-neutral-500">{item.count} عملية</span>
                  </span>
                </span>
                <strong>
                  {formatQty(item.quantity)} {item.unitAr}
                </strong>
              </li>
            ))}
          </ul>
        )}
      </section>
        </div>
      ) : null}
      {view === "history" ? (
        <div className="space-y-4">
          <button type="button" onClick={() => setView("menu")} className="text-sm font-extrabold text-[#e06600]">← رجوع للقائمة</button>
      <section className="rounded-[24px] border border-orange-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black tracking-tight">🗂️ سجل عمليات {monthLabelAr(month)}</h2>
          <span className="text-sm text-neutral-400">{entries.length} سجل</span>
        </div>
        {entries.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="السجل فاضي" text="مفيش عمليات محفوظة في الشهر ده." />
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {entries.map((entry) => (
              <li key={entry.id} className="rounded-2xl border border-orange-200/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-extrabold">
                      <span className="ml-1 inline-flex align-middle text-[#e06600]"><KpiIcon kpiKey={entry.kpiKey} className="h-4 w-4" /></span>
                      <span dir="ltr">{entry.nameEn}</span>
                    </p>
                    <p className="text-xs text-neutral-500">
                      {formatDateAr(entry.entryDate)} · {formatQty(entry.quantity)} {entry.unitAr}
                    </p>
                    {entry.note ? <p className="mt-1 text-sm text-neutral-700">{entry.note}</p> : null}
                    <p className="mt-1 text-[11px] text-neutral-400">اتسجل {formatTimeCairo(entry.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button type="button" className="min-h-10 font-extrabold text-[#e06600]" onClick={() => openEdit(entry)}>
                      ✏️ عدّل
                    </button>
                    <button type="button" className="min-h-10 font-extrabold text-red-600" onClick={() => setDeleteId(entry.id)}>
                      🗑️ شيل
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="mt-4 min-h-12 w-full rounded-full border border-red-200 bg-red-50 font-extrabold text-red-700"
          onClick={() => setClearOpen(true)}
        >
          🚨 امسح كل سجلات الشهر (مش بيترجع)
        </button>
      </section>
        </div>
      ) : null}
      {view === "profile" ? (
        <div className="space-y-4">
          <button type="button" onClick={() => setView("menu")} className="text-sm font-extrabold text-[#e06600]">← رجوع للقائمة</button>
      <section className="rounded-[24px] border border-orange-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
        <h2 className="text-lg font-black tracking-tight">👤 بياناتك</h2>
        <form className="mt-4 space-y-3" onSubmit={saveProfile}>
          <Field label="اسم الموظف">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="الفرع">
            <input className={inputClass} value={branch} onChange={(e) => setBranch(e.target.value)} required />
          </Field>
          <PrimaryButton type="submit" disabled={pending}>
            {pending ? "⏳ بنحفظ..." : "💾 احفظ الاسم والفرع"}
          </PrimaryButton>
        </form>
        <p className="mt-3 text-xs leading-6 text-neutral-400">تقدر تغيّر اسمك والفرع في أي وقت من هنا.</p>
      </section>
        </div>
      ) : null}
      {view === "backup" ? (
        <div className="space-y-4">
          <button type="button" onClick={() => setView("menu")} className="text-sm font-extrabold text-[#e06600]">← رجوع للقائمة</button>
      <section className="rounded-[24px] border border-orange-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(40,20,0,0.04),0_12px_32px_rgba(40,20,0,0.07)]">
        <h2 className="text-lg font-black tracking-tight">💾 نسخة احتياطية واستعادة</h2>
        <p className="mt-2 text-sm leading-7 text-neutral-500">التصدير بينزّل ملف JSON فيه بياناتك وإعدادات الشهور والسجلات والملاحظات. من غير أي مفاتيح أو أسرار.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <PrimaryButton type="button" disabled={pending} onClick={() => void exportBackup()}>
            ⬇️ نزّل نسخة JSON
          </PrimaryButton>
          <label className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full border border-neutral-200 bg-white px-4 font-bold">
            ⬆️ اختار ملف للاستعادة
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = "";
                void onPickRestore(file);
              }}
            />
          </label>
        </div>
      </section>
        </div>
      ) : null}





      <Modal open={Boolean(editing)} title="✏️ تعديل السجل" onClose={() => setEditing(null)}>
        <form className="space-y-4" onSubmit={saveEdit}>
          {editError ? <Banner tone="error">❌ {editError}</Banner> : null}
          <div>
            <p className="mb-2 block text-sm font-bold text-neutral-800">الإيتم</p>
            <div className="grid grid-cols-2 gap-2">
              {KPI_CATALOG.map((kpi) => {
                const active = kpi.key === editKpi;
                return (
                  <button
                    key={kpi.key}
                    type="button"
                    onClick={() => setEditKpi(kpi.key)}
                    className={`flex min-h-12 items-center gap-2 rounded-2xl border px-3 text-right text-xs font-extrabold transition ${
                      active ? "border-[#e06600] bg-orange-100 text-[#8f4300]" : "border-neutral-200 bg-white text-neutral-700"
                    }`}
                  >
                    <span className="text-[#e06600]"><KpiIcon kpiKey={kpi.key} className="h-5 w-5" /></span>
                    <span dir="ltr" className="leading-4">
                      {kpi.nameEn}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <Field label={`${kpiEmoji(editKpi)} الكمية`} hint={quantityHint(editKpi)}>
            <input
              className={`${inputClass} text-xl font-black`}
              type="number"
              inputMode={editKpi === "quality" ? "decimal" : "numeric"}
              step={quantityStep(editKpi)}
              min={quantityMin(editKpi)}
              max={quantityMax(editKpi)}
              value={editQuantity}
              onChange={(e) => setEditQuantity(e.target.value)}
              required
            />
          </Field>
          <Field label="📅 تاريخ الإنجاز">
            <input className={inputClass} type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} required />
          </Field>
          <Field label="📝 ملاحظة">
            <textarea className={`${inputClass} min-h-20 py-3`} value={editNote} onChange={(e) => setEditNote(e.target.value)} maxLength={500} />
          </Field>
          <div className="flex gap-2">
            <SecondaryButton type="button" onClick={() => setEditing(null)}>
              إلغاء
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={pending}>
              {pending ? "⏳ بنحفظ..." : "💾 احفظ التعديل"}
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(deleteId)} title="🗑️ تشيل السجل ده؟" onClose={() => setDeleteId(null)}>
        <p className="text-sm leading-7 text-neutral-600">السجل هيتشال من قاعدة البيانات بعد ما السيرفر يأكد بس.</p>
        <div className="mt-4 flex gap-2">
          <SecondaryButton type="button" onClick={() => setDeleteId(null)}>
            لأ، خليه
          </SecondaryButton>
          <button type="button" disabled={pending} onClick={() => void deleteEntry()} className="min-h-12 rounded-full bg-red-600 px-4 font-extrabold text-white">
            أيوه، شيله
          </button>
        </div>
      </Modal>

      <Modal open={clearOpen} title="🚨 تمسح الشهر كله؟" onClose={() => setClearOpen(false)}>
        <p className="text-sm leading-7 text-neutral-700">
          هتمسح كل سجلات <strong>{monthLabelAr(month)}</strong> وعددها <strong>{entries.length}</strong>. الإعدادات مش هتتمسح. ده مش بيترجع بعد ما السيرفر ينفذ.
        </p>
        <Field label={`اكتب ${month} للتأكيد`}>
          <input className={inputClass} value={clearConfirm} onChange={(e) => setClearConfirm(e.target.value)} />
        </Field>
        <button
          type="button"
          disabled={pending || clearConfirm !== month}
          onClick={() => void clearMonth()}
          className="mt-4 min-h-12 w-full rounded-full bg-red-600 font-extrabold text-white disabled:opacity-50"
        >
          🚨 أيوه، امسح الشهر
        </button>
      </Modal>

      <Modal open={restoreOpen} title="⬆️ استعادة نسخة" onClose={() => setRestoreOpen(false)}>
        <p className="text-sm leading-7 text-neutral-700">{restoreSummary}</p>
        <div className="mt-4 grid gap-2">
          <label className="flex min-h-12 items-center gap-2 rounded-2xl bg-neutral-50 px-3 text-sm font-bold">
            <input type="radio" name="restore-mode" checked={restoreMode === "merge"} onChange={() => setRestoreMode("merge")} />
            🔀 ادمج مع البيانات الحالية
          </label>
          <label className="flex min-h-12 items-center gap-2 rounded-2xl bg-red-50 px-3 text-sm font-semibold">
            <input type="radio" name="restore-mode" checked={restoreMode === "replace"} onChange={() => setRestoreMode("replace")} />
            ♻️ استبدل البيانات الحالية
          </label>
        </div>
        {restoreMode === "replace" ? (
          <div className="mt-3 space-y-3">
            <Banner tone="warn">⚠️ الاستبدال هيمسح السجلات والإعدادات الحالية بعد ما تنزّل نسخة احتياطية منها.</Banner>
            <SecondaryButton type="button" className="w-full" disabled={pending} onClick={() => void prepareReplace()}>
              ⬇️ نزّل نسخة احتياطية الأول
            </SecondaryButton>
          </div>
        ) : null}
        <PrimaryButton
          type="button"
          className="mt-4"
          disabled={pending || !restoreMode || (restoreMode === "replace" && !replaceReady)}
          onClick={() => void applyRestore()}
        >
          ✅ نفّذ الاستعادة
        </PrimaryButton>
      </Modal>

    </div>
  );
}
