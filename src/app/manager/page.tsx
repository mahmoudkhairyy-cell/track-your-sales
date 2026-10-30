"use client";

import { FormEvent, useEffect, useState } from "react";
import { useHistoryView } from "@/lib/use-history-view";
import { cloudRpc } from "@/lib/cloud";
import { KPI_CATALOG } from "@/lib/constants";
import { cairoISODate } from "@/lib/dates";

type ReportRow = {
  branch_id: string;
  employee_name: string;
  branch_name: string;
  updated_at: string;
  payload: {
    monthLabel?: string;
    overall?: number;
    expectedPercent?: number;
    estimatedCommission?: number;
    fullCommission?: number;
    kpis?: { name: string; achieved: number; target: number; percent: number; weight: number; expectedPercent?: number }[];
    settings?: { fullCommission: number; kpis: { kpiKey: string; target: number; weight: number; unitAr: string }[]; holidays: { date: string }[] };
    entries?: { date: string; kpi: string; quantity: number; unit: string; note: string }[];
  };
};

type AggKpi = { name: string; achieved: number; target: number; percent: number; weight: number; expectedPercent?: number };

const NO_BRANCH = "بدون فرع";

/** On track = النسبة المحققة أكبر من أو تساوي المطلوب لحد النهارده (بهامش 10%). */
function TrackBadge({ percent, expected }: { percent?: number; expected?: number }) {
  if (typeof percent !== "number" || typeof expected !== "number") return null;
  const onTrack = percent >= expected - 10;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${onTrack ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>
      {onTrack ? "🟢 On track" : "🔴 متأخر"}
    </span>
  );
}

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000);
}

/** اسم المؤشر بالإنجليزي من الكتالوج، ولو مش موجود بيرجع المفتاح نفسه. */
function kpiLabel(key: string): string {
  return KPI_CATALOG.find((item) => item.key === key)?.nameEn ?? key;
}

/** تحميل ملف: الرابط بيتضاف للصفحة ويتلغى بعد شوية عشان الموبايل يلحق يحمّل. */
function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function downloadBranchCsv(branchName: string, group: ReportRow[]) {
  const kpiNames = Array.from(new Set(group.flatMap((r) => (r.payload.kpis ?? []).map((k) => k.name))));
  const header = ["الموظف", "التوتال %", "آخر تحديث", ...kpiNames.flatMap((n) => [`${n} محقق`, `${n} تارجت`, `${n} %`])];
  const lines = group.map((row) => {
    const byName = new Map((row.payload.kpis ?? []).map((k) => [k.name, k]));
    return [
      row.employee_name,
      Math.round(row.payload.overall ?? 0),
      new Date(row.updated_at).toLocaleString("en-US", { timeZone: "Africa/Cairo", hour12: false }),
      ...kpiNames.flatMap((n) => {
        const k = byName.get(n);
        return [k?.achieved ?? "", k?.target ?? "", k ? Math.round(k.percent) : ""];
      }),
    ];
  });
  const csv = [header, ...lines]
    .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  saveBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `${branchName}.csv`);
}

/** بيجمع كل موظفين الفرع لكل مؤشر: المحقق الكلي ÷ التارجت الكلي. الـ Quality بيتحسب متوسط نسبه لأنه مش بيتجمع. */
function aggregateKpis(group: ReportRow[]): AggKpi[] {
  const map = new Map<string, { achieved: number; target: number; weight: number; percents: number[]; expected: number[] }>();
  for (const row of group) {
    for (const k of row.payload.kpis ?? []) {
      const cur = map.get(k.name) ?? { achieved: 0, target: 0, weight: k.weight, percents: [], expected: [] };
      cur.achieved += k.achieved;
      cur.target += k.target;
      cur.percents.push(k.percent);
      if (typeof k.expectedPercent === "number") cur.expected.push(k.expectedPercent);
      map.set(k.name, cur);
    }
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return [...map.entries()].map(([name, v]) => {
    const isQuality = name.toLowerCase() === "quality";
    return {
      name,
      achieved: isQuality ? Math.round(avg(v.percents) * 10) / 10 : v.achieved,
      target: isQuality ? 100 : v.target,
      percent: isQuality ? avg(v.percents) : v.target > 0 ? (v.achieved / v.target) * 100 : 0,
      weight: v.weight,
      expectedPercent: v.expected.length ? avg(v.expected) : undefined,
    };
  });
}

function KpiTile({ kpi }: { kpi: AggKpi }) {
  const ok = kpi.percent >= (kpi.expectedPercent ?? 0) - 10;
  const neutral = kpi.weight === 0;
  const tone = neutral
    ? { text: "text-neutral-500", bar: "from-neutral-300 to-neutral-400", ring: "ring-neutral-200" }
    : ok
      ? { text: "text-emerald-700", bar: "from-emerald-400 to-emerald-600", ring: "ring-emerald-200" }
      : { text: "text-red-600", bar: "from-red-400 to-red-600", ring: "ring-red-200" };
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-orange-50/60 p-3 shadow-[0_6px_18px_rgba(40,20,0,0.06)] ring-1 ${tone.ring}`}>
      <p className="truncate text-[10px] font-extrabold text-neutral-500" dir="ltr">{kpi.name}</p>
      <p className={`mt-1 text-2xl font-black tabular-nums tracking-tight ${tone.text}`}>
        {Math.round(kpi.percent)}<span className="text-sm">%</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80">
        <div className={`h-full rounded-full bg-gradient-to-r ${tone.bar}`} style={{ width: `${Math.min(100, Math.max(0, kpi.percent))}%` }} />
      </div>
      <p className="mt-1.5 text-[10px] tabular-nums text-neutral-500" dir="ltr">{Math.round(kpi.achieved)} / {kpi.target}</p>
    </div>
  );
}

type TopRow = { rank: number; name: string; branch: string; percent: number };

function groupAverage(group: ReportRow[]): number {
  const withData = group.filter((r) => typeof r.payload.overall === "number");
  return withData.length ? withData.reduce((sum, r) => sum + (r.payload.overall ?? 0), 0) / withData.length : 0;
}

function groupExpected(group: ReportRow[]): number | undefined {
  const withData = group.filter((r) => typeof r.payload.expectedPercent === "number");
  return withData.length ? withData.reduce((sum, r) => sum + (r.payload.expectedPercent ?? 0), 0) / withData.length : undefined;
}

function groupByBranch(rows: ReportRow[]): [string, ReportRow[]][] {
  const map = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const key = row.branch_name || NO_BRANCH;
    map.set(key, [...(map.get(key) ?? []), row]);
  }
  return [...map.entries()];
}

export default function ManagerPage() {
  const [password, setPassword] = useState("");
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [branchOpen, setBranchOpen] = useState(false);
  // "list" = الفروع، "b:<فرع>" = صفحة فرع، "b:<فرع>|e:<id>" = موظف مفتوح. كل خطوة بتتسجل في تاريخ المتصفح.
  const [view, setView] = useHistoryView<string>("list");
  const branch = view.startsWith("b:") ? view.slice(2).split("|e:")[0] : null;
  const openId = view.includes("|e:") ? view.split("|e:")[1] : null;
  const setOpenId = (id: string | null) => {
    if (!branch) return;
    // قفل الموظف: نرجع خطوة لورا في التاريخ بدل ما نضيف خطوة جديدة، عشان زرار الرجوع ما يفتحش الموظف تاني.
    if (!id && openId && typeof window !== "undefined" && window.history.state?.tysView === view) {
      window.history.back();
      return;
    }
    setView(id ? `b:${branch}|e:${id}` : `b:${branch}`);
  };
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null);

  // إجمالي الفرع المفتوح بيتقفل لما تغيّر الفرع
  useEffect(() => {
    setBranchOpen(false);
  }, [branch]);

  const allRows = rows ?? [];
  const branchRows = branch ? allRows.filter((r) => (r.branch_name || NO_BRANCH) === branch) : [];
  const branchAvg = groupAverage(branchRows);
  const branchExpected = groupExpected(branchRows);

  const topRows: TopRow[] = allRows
    .map((r) => ({ name: r.employee_name, branch: r.branch_name || NO_BRANCH, percent: r.payload.overall ?? 0 }))
    .sort((a, b) => b.percent - a.percent)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  async function load(event?: FormEvent, savedPassword?: string) {
    event?.preventDefault();
    const pw = savedPassword ?? password;
    setPending(true);
    setError("");
    try {
      const data = await cloudRpc<ReportRow[]>("get_all_reports", { p_password: pw });
      // الباسورد بيفضل في الجلسة عشان الريفريش ما يطلبوش تاني.
      try {
        sessionStorage.setItem("tys.mgrPass", pw);
      } catch {
        // التخزين مش متاح، هيطلب الباسورد تاني.
      }
      setRows(data ?? []);
      setLastLoaded(new Date());
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      if (raw.includes("wrong password")) {
        // الباسورد غلط: نرجع لشاشة الدخول.
        setRows(null);
        try {
          sessionStorage.removeItem("tys.mgrPass");
        } catch {
          // لا شيء
        }
        setError("كلمة السر غلط");
      } else {
        // خطأ نت أو غيره: نحتفظ بالبيانات اللي موجودة ونعرض الخطأ فوقها.
        setError(`مقدرناش نحدّث البيانات، جرّب تاني. (${raw.slice(0, 160)})`);
      }
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem("tys.mgrPass");
    } catch {
      saved = null;
    }
    if (saved) {
      setPassword(saved);
      void load(undefined, saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function deleteEmployee(row: ReportRow) {
    if (!window.confirm(`متأكد إنك عايز تمسح ${row.employee_name}؟ الملخص بتاعه هيتمسح من اللوحة.`)) return;
    setPending(true);
    setError("");
    try {
      const pw = password || sessionStorage.getItem("tys.mgrPass") || "";
      await cloudRpc("delete_report", { p_password: pw, p_branch_id: row.branch_id });
      setRows((cur) => (cur ?? []).filter((r) => r.branch_id !== row.branch_id));
      setOpenId(null);
    } catch (err) {
      setError(`مقدرناش نمسح ${row.employee_name}. (${err instanceof Error ? err.message.slice(0, 120) : ""})`);
    } finally {
      setPending(false);
    }
  }

  function renderRow(row: ReportRow) {
    const open = openId === row.branch_id;
    const days = daysSince(row.updated_at);
    const staleClass = days >= 3 ? "bg-red-100 text-red-700" : days >= 1 ? "bg-amber-100 text-amber-800" : "";
    const percent = Math.round(row.payload.overall ?? 0);
    return (
      <article key={row.branch_id} className="rounded-[24px] bg-white p-4 shadow-[0_12px_32px_rgba(40,20,0,0.07)] ring-1 ring-orange-200/70">
        <button type="button" onClick={() => setOpenId(open ? null : row.branch_id)} className="flex w-full items-center justify-between gap-3 text-right">
          <div>
            <h3 className="font-black">{row.employee_name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <TrackBadge percent={row.payload.overall} expected={row.payload.expectedPercent} />
              {staleClass ? (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${staleClass}`}>آخر تحديث من {Math.floor(days)} يوم</span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-black text-[#e06600] tabular-nums">{percent}%</p>
            <span className="text-neutral-400">{open ? "▲" : "▼"}</span>
          </div>
        </button>

        {open ? (
          <>
            <p className="mt-1 text-[10px] text-neutral-400" dir="ltr">
              {new Date(row.updated_at).toLocaleString("en-US", { timeZone: "Africa/Cairo", hour12: false })}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(row.payload.kpis ?? []).map((kpi) => (
                <div key={kpi.name}>
                  <KpiTile kpi={kpi} />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setDetailsId(detailsId === row.branch_id ? null : row.branch_id)}
              className="mt-3 w-full rounded-2xl bg-orange-50 py-2 text-xs font-extrabold text-[#8f4300]"
            >
              {detailsId === row.branch_id ? "إخفاء التفاصيل" : `عرض كل التفاصيل (${row.payload.entries?.length ?? 0} إنجاز)`}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => deleteEmployee(row)}
              className="mt-3 w-full rounded-2xl border border-red-200 bg-red-50 py-2 text-xs font-extrabold text-red-700 disabled:opacity-60"
            >
              🗑 امسح الموظف من اللوحة
            </button>
            {detailsId === row.branch_id ? (
              <div className="mt-3 space-y-3 text-xs">
                <div>
                  <p className="mb-1 font-black">التارجت والأوزان</p>
                  {(row.payload.settings?.kpis ?? []).map((k) => (
                    <div key={k.kpiKey} className="flex justify-between">
                      <span dir="ltr">{kpiLabel(k.kpiKey)}</span>
                      <span className="tabular-nums">تارجت {k.target} · وزن {k.weight}%</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="mb-1 font-black">كل الإنجازات</p>
                  {(row.payload.entries ?? []).length === 0 ? <p className="text-neutral-500">لا يوجد</p> : null}
                  {(row.payload.entries ?? []).map((e, i) => (
                    <div key={`${e.date}-${i}`} className="flex justify-between border-b border-dashed border-orange-200/70 py-1">
                      <span dir="ltr">{e.date}</span>
                      <span dir="ltr">{kpiLabel(e.kpi)}</span>
                      <span className="tabular-nums">{e.quantity} {e.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </article>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbe9da] p-4 text-neutral-900" dir="rtl">
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-black">لوحة المدير</h1>
        {rows !== null ? (
          <div className="flex items-center justify-between rounded-[24px] bg-gradient-to-br from-[#f0802a] via-[#e06600] to-[#b84700] p-4 text-white shadow-[0_12px_32px_rgba(190,90,0,0.25)]">
            <div className="flex items-center gap-3">
              <img src="/track-your-sales/logo-mark.png" alt="" className="h-10 w-10 object-contain" />
              <div>
                <p className="text-sm font-black tracking-tight" dir="ltr">Track Your Sales</p>
                <p className="text-[11px] text-white/85" dir="ltr">Manager Dashboard</p>
              </div>
            </div>
            <p className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-extrabold ring-1 ring-white/30" dir="ltr">👑 Mr. Abdelrahman Mahmoud</p>
          </div>
        ) : null}

        {rows === null ? (
          <form onSubmit={load} className="overflow-hidden rounded-[28px] bg-white p-6 shadow-[0_20px_50px_rgba(190,90,0,0.15)] ring-1 ring-orange-200/70">
            <div className="-mx-6 -mt-6 mb-5 bg-gradient-to-br from-[#f0802a] via-[#e06600] to-[#b84700] px-6 py-6 text-center text-white">
              <img src="/track-your-sales/logo-mark.png" alt="" className="mx-auto h-14 w-14 object-contain" />
              <p className="mt-2 text-lg font-black tracking-tight" dir="ltr">Track Your Sales</p>
              <p className="mt-2 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-extrabold ring-1 ring-white/30" dir="ltr">
                👑 Mr. Abdelrahman Mahmoud
              </p>
              <p className="mt-1 text-[11px] text-white/80" dir="ltr">Manager Dashboard</p>
            </div>
            <label className="block text-sm font-bold text-neutral-700">
              كلمة السر
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-orange-200 px-4 py-3 outline-none focus:border-[#e06600]"
              />
            </label>
            {error ? <p className="mt-3 text-sm font-bold text-red-600">{error}</p> : null}
            <button type="submit" disabled={pending || !password} className="mt-4 w-full rounded-2xl bg-gradient-to-br from-[#f0802a] to-[#e06600] py-3 font-extrabold text-white disabled:opacity-60">
              {pending ? "⏳ بنجيب البيانات..." : "دخول"}
            </button>
          </form>
        ) : (
          <>
            {error ? <p className="rounded-2xl bg-red-50 p-3 text-xs font-bold text-red-600">{error}</p> : null}
            {view === "top" ? (
              <div className="space-y-3">
                <button type="button" onClick={() => setView("list")} className="text-sm font-extrabold text-[#e06600]">← رجوع</button>
                <div className="flex items-center justify-between rounded-[24px] bg-gradient-to-br from-[#f0802a] to-[#b84700] p-4 text-white">
                  <div>
                    <p className="text-3xl font-black tracking-tight">TOP</p>
                    <p className="text-[11px] text-white/85">كل الموظفين مرتبين حسب نسبة التحقيق</p>
                  </div>
                </div>
                {topRows.map((row) => (
                  <div key={`${row.branch}-${row.name}-${row.rank}`} className="flex items-center justify-between rounded-[22px] bg-white p-3.5 shadow-[0_8px_24px_rgba(40,20,0,0.06)] ring-1 ring-orange-200/70">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-black ${row.rank <= 3 ? "bg-gradient-to-br from-[#f5c542] to-[#e8a400] text-white" : "bg-orange-100 text-[#8f4300]"}`}>
                        {row.rank}
                      </span>
                      <div>
                        <p className="font-black">{row.name}</p>
                        <p className="text-[11px] text-neutral-500" dir="ltr">{row.branch}</p>
                      </div>
                    </div>
                    <p className="text-xl font-black tabular-nums text-[#e06600]">{Math.round(row.percent)}%</p>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-neutral-500">
                    {allRows.length} موظف
                    {lastLoaded ? <span className="block text-[10px] font-semibold text-neutral-400" dir="ltr">آخر تحديث {lastLoaded.toLocaleTimeString("en-US", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hour12: false })}</span> : null}
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setView("top")} className="rounded-full bg-gradient-to-br from-[#f0802a] to-[#b84700] px-3 py-1.5 text-xs font-black text-white">🏆 TOP</button>
                    <button type="button" disabled={pending} onClick={() => load()} className="rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-[#8f4300] ring-1 ring-orange-200/70 disabled:opacity-60">
                      {pending ? "⏳ بنحدّث..." : "🔄 تحديث"}
                    </button>
                  </div>
                </div>
                {allRows.length === 0 ? (
                  <p className="rounded-2xl bg-white p-4 text-sm font-bold text-neutral-500">مفيش فروع بعتت بيانات لحد دلوقتي.</p>
                ) : null}
                {branch === null && allRows.length > 0 ? (() => {
                  const today = cairoISODate();
                  const logged: ReportRow[] = [];
                  const missing: ReportRow[] = [];
                  const leave: ReportRow[] = [];
                  for (const r of allRows) {
                    if ((r.payload.settings?.holidays ?? []).some((h) => h.date === today)) leave.push(r);
                    else if ((r.payload.entries ?? []).some((e) => e.date === today)) logged.push(r);
                    else missing.push(r);
                  }
                  const names = (list: ReportRow[]) => (list.length === 0 ? <p className="text-xs text-neutral-400">لا يوجد</p> : list.map((r) => (
                    <p key={r.branch_id} className="flex justify-between text-sm font-bold">
                      <span>{r.employee_name}</span>
                      <span className="text-[11px] font-semibold text-neutral-500" dir="ltr">{r.branch_name || NO_BRANCH}</span>
                    </p>
                  )));
                  return (
                    <section className="rounded-[24px] bg-white p-4 shadow-[0_12px_32px_rgba(40,20,0,0.07)] ring-1 ring-orange-200/70">
                      <p className="mb-3 text-sm font-black">📅 النهارده ({today})</p>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs font-extrabold">
                        <div className="rounded-2xl bg-emerald-50 p-2 text-emerald-800">✅ سجّل<br /><span className="text-lg tabular-nums">{logged.length}</span></div>
                        <div className="rounded-2xl bg-red-50 p-2 text-red-700">❌ مسجلش<br /><span className="text-lg tabular-nums">{missing.length}</span></div>
                        <div className="rounded-2xl bg-neutral-100 p-2 text-neutral-700">🏖️ إجازة<br /><span className="text-lg tabular-nums">{leave.length}</span></div>
                      </div>
                      <div className="mt-3 space-y-3">
                        <div><p className="mb-1 text-xs font-black text-emerald-800">سجّلوا</p>{names(logged)}</div>
                        <div><p className="mb-1 text-xs font-black text-red-700">مسجلوش لسه</p>{names(missing)}</div>
                        <div><p className="mb-1 text-xs font-black text-neutral-600">في إجازة</p>{names(leave)}</div>
                      </div>
                      <p className="mt-3 text-[10px] text-neutral-400">* بيعتمد على آخر مزامنة من كل موظف.</p>
                    </section>
                  );
                })() : null}
                {branch === null && allRows.length > 0 ? (() => {
                  // تنبيه: الموظفين اللي ما سجلوش إنجاز امبارح (ومش في إجازة امبارح).
                  const yesterday = cairoISODate(new Date(Date.now() - 24 * 60 * 60 * 1000));
                  const missedYesterday = allRows.filter(
                    (r) =>
                      !(r.payload.settings?.holidays ?? []).some((h) => h.date === yesterday) &&
                      !(r.payload.entries ?? []).some((e) => e.date === yesterday),
                  );
                  if (missedYesterday.length === 0) return null;
                  return (
                    <section className="rounded-[24px] border-2 border-red-300 bg-red-50 p-4">
                      <p className="text-sm font-black text-red-700">🔔 ما سجلوش إنجاز امبارح ({yesterday})</p>
                      <div className="mt-2 space-y-1">
                        {missedYesterday.map((r) => (
                          <p key={r.branch_id} className="flex justify-between text-sm font-bold text-red-800">
                            <span>{r.employee_name}</span>
                            <span className="text-[11px] font-semibold" dir="ltr">{r.branch_name || NO_BRANCH}</span>
                          </p>
                        ))}
                      </div>
                    </section>
                  );
                })() : null}
                {branch === null ? (
                  <div className="space-y-3">
                    {groupByBranch(allRows)
                      .sort((a, b) => groupAverage(b[1]) - groupAverage(a[1]))
                      .map(([branchName, group]) => {
                        const avg = groupAverage(group);
                        return (
                          <button
                            key={branchName}
                            type="button"
                            onClick={() => setView(`b:${branchName}`)}
                            className="flex w-full items-center justify-between rounded-[24px] bg-white p-4 text-right shadow-[0_12px_32px_rgba(40,20,0,0.07)] ring-1 ring-orange-200/70"
                          >
                            <div>
                              <p className="font-black" dir="ltr">{branchName}</p>
                              <p className="text-xs text-neutral-500">{group.length} موظف</p>
                              <div className="mt-1"><TrackBadge percent={avg} expected={groupExpected(group)} /></div>
                            </div>
                            <p className="text-xl font-black text-[#e06600] tabular-nums">{Math.round(avg)}%</p>
                          </button>
                        );
                      })}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button type="button" onClick={() => setView("list")} className="text-sm font-extrabold text-[#e06600]">← كل الفروع</button>
                    <div className="rounded-[24px] bg-[#e06600] p-4 text-white">
                      <p className="text-xs text-white/80">الفرع</p>
                      <h2 className="font-black" dir="ltr">{branch}</h2>
                      <button
                        type="button"
                        onClick={() => downloadBranchCsv(branch, branchRows)}
                        className="mt-3 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-[#8f4300]"
                      >
                        📥 تحميل الفرع (Excel)
                      </button>
                      <div className="mt-2">
                        <TrackBadge percent={branchAvg} expected={branchExpected} />
                      </div>
                    </div>
                    <article className="rounded-[24px] bg-white p-4 shadow-[0_12px_32px_rgba(40,20,0,0.07)] ring-1 ring-orange-200/70">
                      <button
                        type="button"
                        onClick={() => setBranchOpen(!branchOpen)}
                        className="flex w-full items-center justify-between gap-3 text-right"
                      >
                        <div>
                          <h3 className="font-black">إجمالي الفرع</h3>
                          <div className="mt-1">
                            <TrackBadge percent={branchAvg} expected={branchExpected} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-2xl font-black text-[#e06600] tabular-nums">{Math.round(branchAvg)}%</p>
                          <span className="text-neutral-400">{branchOpen ? "▲" : "▼"}</span>
                        </div>
                      </button>
                      {branchOpen ? (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {aggregateKpis(branchRows).map((kpi) => (
                            <div key={kpi.name}>
              <KpiTile kpi={kpi} />
            </div>
                          ))}
                        </div>
                      ) : null}
                    </article>
                    {[...branchRows]
                      .sort((a, b) => (b.payload.overall ?? 0) - (a.payload.overall ?? 0))
                      .map((row, index) => (
                        <div key={row.branch_id} className="relative">
                          <span className="absolute -top-2 right-4 z-10 rounded-full bg-[#8f4300] px-2.5 py-0.5 text-[11px] font-black text-white">
                            المركز {index + 1}
                          </span>
                          {renderRow(row)}
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
