"use client";

import { FormEvent, useEffect, useState } from "react";
import { useHistoryView } from "@/lib/use-history-view";
import { managerApi } from "@/lib/cloud";
import { KPI_CATALOG } from "@/lib/constants";
import { cairoISODate } from "@/lib/dates";

type ReportRow = {
  branch_id: string;
  employee_name: string;
  branch_name: string;
  updated_at: string;
  payload: {
    role?: string;
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

/** On track = النسبة المحققة أكبر من أو تساوي المطلوب لحد النهارده (مقارنة مباشرة). */
function TrackBadge({ percent, expected }: { percent?: number; expected?: number }) {
  if (typeof percent !== "number" || typeof expected !== "number") return null;
  const onTrack = percent >= expected;
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
/** أسماء قديمة في التقارير اللي اتبعتت قبل تغيير الأسماء: بتتجمع مع الاسم الجديد عشان متتكررش. */
const LEGACY_KPI_NAMES: Record<string, string> = {
  "New Lines": "GAs",
  "Postpaid Lines": "Postpaid",
  DSL: "Home ADSL",
  Exist: "Excite",
  "Existing OC Wallets": "Excite",
  Quality: "KYC & Compliance",
};

function aggregateKpis(group: ReportRow[]): AggKpi[] {
  const map = new Map<string, { achieved: number; target: number; weight: number; percents: number[]; expected: number[] }>();
  for (const row of group) {
    for (const raw of row.payload.kpis ?? []) {
      const k = { ...raw, name: LEGACY_KPI_NAMES[raw.name] ?? raw.name };
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
    // الكواليتي بتتحسب كمتوسط نسب الموظفين (كل موظف بحصة متساوية)، مش مجموع مرجّح.
    const isQuality = name.toLowerCase() === "quality" || name.toLowerCase().startsWith("kyc");
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
  const ok = kpi.expectedPercent === undefined || kpi.percent >= kpi.expectedPercent;
  const neutral = kpi.weight === 0;
  const tone = neutral
    ? { text: "text-[#927b69]", bar: "from-[#f1dfd0] to-[#e8b88f]", ring: "ring-[#f1dfd0]" }
    : ok
      ? { text: "text-emerald-700", bar: "from-emerald-400 to-emerald-600", ring: "ring-emerald-200" }
      : { text: "text-red-600", bar: "from-red-400 to-red-600", ring: "ring-red-200" };
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-[#fff0e2]/60 p-3 shadow-sm ring-1 ${tone.ring}`}>
      <p className="truncate text-[10px] font-extrabold text-[#927b69]" dir="ltr">{kpi.name}</p>
      <p className={`mt-1 text-2xl font-black tabular-nums tracking-tight ${tone.text}`}>
        {Math.round(kpi.percent)}<span className="text-sm">%</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80">
        <div className={`h-full rounded-full bg-gradient-to-r ${tone.bar}`} style={{ width: `${Math.min(100, Math.max(0, kpi.percent))}%` }} />
      </div>
      <p className="mt-1.5 text-[10px] tabular-nums text-[#927b69]" dir="ltr">{Math.round(kpi.achieved)} / {kpi.target}</p>
    </div>
  );
}

type TopRow = { rank: number; name: string; branch: string; percent: number };

/** نسبة الفرع: كل بند نسبته الكلية للفرع (مجموع المحقق ÷ مجموع التارجت) × وزن البند من الشيت. */
function groupAverage(group: ReportRow[]): number {
  const kpis = aggregateKpis(group);
  const totalWeight = kpis.reduce((sum, k) => sum + k.weight, 0);
  if (totalWeight <= 0) return 0;
  return kpis.reduce((sum, k) => sum + k.percent * k.weight, 0) / totalWeight;
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
  const [branchOpenFor, setBranchOpenFor] = useState<string | null>(null);
  // "list" = الفروع، "b:<فرع>" = صفحة فرع، "b:<فرع>|e:<id>" = موظف مفتوح. كل خطوة بتتسجل في تاريخ المتصفح.
  const [view, setView] = useHistoryView<string>("list");
  const branch = view.startsWith("b:") ? view.slice(2).split("|e:")[0] : null;
  const branchOpen = branch !== null && branchOpenFor === branch;
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
  const [yesterday, setYesterday] = useState("");
  const [pwOpen, setPwOpen] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [managerName, setManagerName] = useState("");

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setPwMsg("");
    if (newPw.length < 6) return setPwMsg("الباسورد الجديد لازم يكون 6 حروف على الأقل.");
    if (newPw !== newPw2) return setPwMsg("الباسورد الجديد مش متطابق.");
    try {
      await managerApi("change_password", { password: oldPw, newPassword: newPw });
      sessionStorage.setItem("tys.mgrPass", newPw);
      setPassword(newPw);
      setOldPw("");
      setNewPw("");
      setNewPw2("");
      setPwOpen(false);
      setPwMsg("");
      setError("");
      alert("✅ اتغيّر الباسورد بنجاح.");
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      setPwMsg(raw.includes("wrong password") ? "الباسورد القديم غلط." : "حصلت مشكلة، حاول تاني.");
    }
  }

   useEffect(() => {
    const timer = window.setTimeout(() => {
      setYesterday(cairoISODate(new Date(Date.now() - 24 * 60 * 60 * 1000)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

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
      const data = await managerApi<ReportRow[]>("reports", { password: pw });
      // الباسورد بيفضل في الجلسة عشان الريفريش ما يطلبوش تاني.
      try {
        sessionStorage.setItem("tys.mgrPass", pw);
      } catch {
        // التخزين مش متاح، هيطلب الباسورد تاني.
      }
      setRows(data ?? []);
      setLastLoaded(new Date());
      managerApi<string>("manager_name", { password: pw }).then((name) => setManagerName(name ?? "")).catch(() => setManagerName(""));
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
    let cancelled = false;
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem("tys.mgrPass");
    } catch {
      saved = null;
    }
    if (saved) {
      queueMicrotask(() => {
        if (cancelled) return;
        setPassword(saved);
        void load(undefined, saved);
      });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function deleteEmployee(row: ReportRow) {
    if (!window.confirm(`متأكد إنك عايز تمسح ${row.employee_name}؟ الملخص بتاعه هيتمسح من اللوحة.`)) return;
    setPending(true);
    setError("");
    try {
      const pw = password || sessionStorage.getItem("tys.mgrPass") || "";
      await managerApi("delete", { password: pw, branchId: row.branch_id });
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
      <article key={row.branch_id} className="tys-manager-employee-card rounded-[26px] bg-white/95 p-4 shadow-[0_10px_28px_rgba(126,65,24,0.06)] ring-1 ring-[#f1dfd0]/70">
        <button type="button" onClick={() => setOpenId(open ? null : row.branch_id)} className="flex w-full items-center justify-between gap-3 text-right">
          <div>
            <h3 className="font-black">{row.employee_name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {row.payload.role === "team_leader" ? <span className="rounded-full bg-[#fff0e2] px-2 py-0.5 text-[10px] font-black text-[#bd4b0a]">🧑‍🏫 تيم ليدر</span> : null}
              <TrackBadge percent={row.payload.overall} expected={row.payload.expectedPercent} />
              {staleClass ? (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${staleClass}`}>آخر تحديث من {Math.floor(days)} يوم</span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-black text-[#bd4b0a] tabular-nums">{percent}%</p>
            <span className="text-[#927b69]">{open ? "▲" : "▼"}</span>
          </div>
        </button>

        {open ? (
          <>
            <p className="mt-1 text-[10px] text-[#927b69]" dir="ltr">
              {new Date(row.updated_at).toLocaleString("en-US", { timeZone: "Africa/Cairo", hour12: false })}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
              {(row.payload.kpis ?? []).map((kpi) => (
                <div key={kpi.name}>
                  <KpiTile kpi={kpi} />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setDetailsId(detailsId === row.branch_id ? null : row.branch_id)}
              className="mt-3 w-full rounded-2xl bg-[#fff0e2] py-2 text-xs font-extrabold text-[#bd4b0a]"
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
                    <div key={k.kpiKey} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[#f4e5d9] bg-[#fffaf6] px-3 py-2">
                      <span className="min-w-0 font-extrabold text-[#5b4030]">{kpiLabel(k.kpiKey)}</span>
                      <span className="whitespace-nowrap text-[10px] font-bold tabular-nums text-[#927b69] sm:text-xs">تارجت {k.target} · وزن {k.weight}%</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="mb-2 flex items-center justify-between font-black"><span>كل الإنجازات</span><span className="rounded-full bg-[#fff0e2] px-2 py-0.5 text-[10px] font-black text-[#bd4b0a]">{row.payload.entries?.length ?? 0}</span></p>
                  {(row.payload.entries ?? []).length === 0 ? <p className="text-[#927b69]">لا يوجد</p> : null}
                  {(row.payload.entries ?? []).map((e, i) => (
                    <div key={`${e.date}-${i}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-[#f4e5d9] bg-[#fffaf6] px-3 py-2.5 text-[11px] sm:text-xs">
                      <span className="font-bold text-[#806653]" dir="ltr">{e.date}</span>
                      <span className="min-w-0 truncate font-extrabold text-[#5b4030]">{kpiLabel(e.kpi)}</span>
                      <span className="whitespace-nowrap rounded-lg bg-[#fff0e2] px-2 py-1 font-black tabular-nums text-[#bd4b0a]">{e.quantity} {e.unit}</span>
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

  const branchGroups = groupByBranch(allRows);
  const dashboardAverage = branchGroups.length
    ? branchGroups.reduce((sum, [, group]) => sum + groupAverage(group), 0) / branchGroups.length
    : 0;
  const activeToday = allRows.filter((r) => (r.payload.entries ?? []).some((e) => e.date === cairoISODate())).length;

  return (
    <main className="tys-page tx-manager min-h-screen px-3 py-4 text-[#30251e] sm:px-5 sm:py-6" dir="rtl">
      <div className="mx-auto max-w-5xl space-y-4">
        {rows === null ? (
          <section className="mx-auto mt-10 max-w-sm rounded-3xl border border-[#f0dfd2] bg-white p-6 shadow-sm">
            <div className="mb-6 text-center">
              <img src="/track-your-sales/logo-mark.png" alt="" className="mx-auto h-12 w-12 object-contain" />
              <p className="mt-3 text-[10px] font-black tracking-[.16em] text-[#bd4b0a]" dir="ltr">MANAGEMENT</p>
              <h1 className="mt-1 text-2xl font-black">دخول المدير</h1>
              <p className="mt-2 text-xs leading-6 text-[#887565]">ادخل كلمة السر لمتابعة تقارير الفريق.</p>
            </div>
            <form onSubmit={load} className="space-y-3">
              <label className="block text-sm font-bold">كلمة السر
                <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="اكتب كلمة السر" className="mt-2 w-full rounded-xl border border-[#ead8c9] bg-[#fffaf6] px-4 py-3 text-base outline-none focus:border-[#d9651b]" />
              </label>
              {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
              <button type="submit" disabled={pending || !password} className="w-full rounded-xl bg-[#bd4b0a] py-3 font-extrabold text-white disabled:opacity-50">{pending ? "جاري الدخول..." : "دخول"}</button>
            </form>
          </section>
        ) : (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-[#efdfd2] pb-3">
              <div>
                <p className="text-[10px] font-black tracking-[.16em] text-[#bd4b0a]" dir="ltr">MANAGEMENT</p>
                <h1 className="text-2xl font-black">لوحة المدير</h1>
                <p className="mt-1 text-xs text-[#887565]">{managerName || "متابعة أداء الفريق"}</p>
              </div>
              <button type="button" disabled={pending} onClick={() => load()} className="rounded-xl border border-[#efdfd2] bg-white px-3 py-2 text-xs font-extrabold text-[#8f3d0a] disabled:opacity-50">{pending ? "تحديث..." : "↻ تحديث"}</button>
            </header>
            {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</p> : null}

            {view === "top" ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div><h2 className="text-lg font-black">ترتيب الموظفين</h2><p className="text-xs text-[#887565]">من الأعلى إلى الأقل تحقيقًا</p></div>
                  <button type="button" onClick={() => setView("list")} className="rounded-lg bg-[#fff0e2] px-3 py-2 text-xs font-bold text-[#9f430b]">كل الفروع</button>
                </div>
                <div className="overflow-hidden rounded-2xl border border-[#efdfd2] bg-white">
                  {topRows.map((row) => (
                    <div key={`${row.branch}-${row.name}-${row.rank}`} className="flex items-center justify-between gap-3 border-b border-[#f4e9df] px-3 py-3 last:border-0">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#fff0e2] text-xs font-black text-[#a94308]">{row.rank}</span>
                        <div className="min-w-0"><p className="truncate text-sm font-extrabold">{row.name}</p><p className="truncate text-[11px] text-[#887565]" dir="ltr">{row.branch}</p></div>
                      </div>
                      <strong className="text-lg tabular-nums text-[#bd4b0a]">{Math.round(row.percent)}%</strong>
                    </div>
                  ))}
                </div>
              </section>
            ) : branch === null ? (
              <>
                <section className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-[#fff4eb] p-3"><p className="text-[11px] font-bold text-[#927b69]">الفروع</p><p className="mt-1 text-2xl font-black tabular-nums">{branchGroups.length}</p></div>
                  <div className="rounded-2xl bg-[#f8f5f1] p-3"><p className="text-[11px] font-bold text-[#927b69]">الموظفين</p><p className="mt-1 text-2xl font-black tabular-nums">{allRows.length}</p></div>
                  <div className="rounded-2xl bg-[#fff4eb] p-3"><p className="text-[11px] font-bold text-[#927b69]">متوسط الأداء</p><p className="mt-1 text-2xl font-black tabular-nums text-[#bd4b0a]">{Math.round(dashboardAverage)}%</p></div>
                </section>

                <section className="flex items-center justify-between gap-3">
                  <div><h2 className="text-lg font-black">الفروع</h2><p className="text-[11px] text-[#887565]">{allRows.length} تقرير · {lastLoaded ? lastLoaded.toLocaleTimeString("en-US", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hour12: false }) : "لم يتم التحديث بعد"}</p></div>
                  <button type="button" onClick={() => setView("top")} className="rounded-xl border border-[#efdfd2] bg-white px-3 py-2 text-xs font-extrabold text-[#8f3d0a]">🏆 ترتيب الموظفين</button>
                </section>

                {allRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#e8d5c5] bg-white p-8 text-center"><p className="font-extrabold">لا توجد تقارير حتى الآن</p><p className="mt-1 text-xs text-[#887565]">ستظهر بيانات الفريق بعد المزامنة.</p></div>
                ) : (
                  <section className="space-y-2">
                    {branchGroups.sort((a,b) => groupAverage(b[1])-groupAverage(a[1])).map(([branchName,group]) => {
                      const avg=groupAverage(group);
                      return (
                        <button key={branchName} type="button" onClick={() => setView(`b:${branchName}`)} className="w-full rounded-2xl border border-[#efdfd2] bg-white p-3.5 text-right shadow-[0_2px_8px_rgba(91,49,23,.035)] transition hover:border-[#e5b18a]">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0"><p className="truncate text-sm font-black" dir="ltr">{branchName}</p><p className="mt-1 text-[11px] text-[#887565]">{group.length} موظف</p></div>
                            <div className="text-left"><p className="text-xl font-black tabular-nums text-[#bd4b0a]">{Math.round(avg)}%</p><TrackBadge percent={avg} expected={groupExpected(group)} /></div>
                          </div>
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#f5eee8]"><div className="h-full rounded-full bg-[#d96a20]" style={{width:`${Math.min(100,Math.max(0,avg))}%`}} /></div>
                        </button>
                      );
                    })}
                  </section>
                )}

                {allRows.length > 0 ? (() => {
                  const today=cairoISODate();
                  const logged:ReportRow[]=[]; const missing:ReportRow[]=[]; const leave:ReportRow[]=[];
                  for (const r of allRows) {
                    if ((r.payload.settings?.holidays ?? []).some(h=>h.date===today)) leave.push(r);
                    else if ((r.payload.entries ?? []).some(e=>e.date===today)) logged.push(r);
                    else missing.push(r);
                  }
                  const names=(list:ReportRow[])=>list.length ? <div className="space-y-2">{list.map(r=><p key={r.branch_id} className="flex justify-between gap-2 text-xs"><b>{r.employee_name}</b><span className="text-[#887565]" dir="ltr">{r.branch_name||NO_BRANCH}</span></p>)}</div> : <p className="text-xs text-[#887565]">لا يوجد</p>;
                  return <details className="rounded-2xl border border-[#efdfd2] bg-white"><summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3"><span><b className="block text-sm">متابعة تسجيلات النهارده</b><small className="text-[#887565]" dir="ltr">{today}</small></span><span className="text-[11px] font-black"><span className="text-emerald-700">✓ {logged.length}</span> · <span className="text-red-600">{missing.length} لم يسجلوا</span> · {leave.length} إجازة</span></summary><div className="grid gap-4 border-t border-[#f4e9df] p-3 sm:grid-cols-3"><div><b className="mb-2 block text-xs text-emerald-700">سجّلوا</b>{names(logged)}</div><div><b className="mb-2 block text-xs text-red-700">لم يسجلوا</b>{names(missing)}</div><div><b className="mb-2 block text-xs text-[#887565]">إجازة</b>{names(leave)}</div></div></details>;
                })() : null}
                {allRows.length > 0 ? (() => {
                  const missed=allRows.filter(r=>!(r.payload.settings?.holidays??[]).some(h=>h.date===yesterday)&&!(r.payload.entries??[]).some(e=>e.date===yesterday)&&!(r.payload.entries??[]).some(e=>e.date===cairoISODate()));
                  return missed.length ? <details className="rounded-2xl border border-red-200 bg-white"><summary className="cursor-pointer p-3 text-xs font-bold text-red-700">تنبيه: {missed.length} موظف لم يسجلوا امبارح</summary><div className="space-y-2 border-t border-red-100 p-3">{missed.map(r=><p key={r.branch_id} className="flex justify-between gap-2 text-xs"><b>{r.employee_name}</b><span dir="ltr">{r.branch_name||NO_BRANCH}</span></p>)}</div></details> : null;
                })() : null}
              </>
            ) : (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div><button type="button" onClick={()=>setView("list")} className="mb-1 text-xs font-bold text-[#bd4b0a]">← كل الفروع</button><h2 className="text-xl font-black" dir="ltr">{branch}</h2><p className="text-xs text-[#887565]">{branchRows.length} موظف</p></div>
                  <button type="button" onClick={()=>downloadBranchCsv(branch,branchRows)} className="rounded-xl border border-[#efdfd2] bg-white px-3 py-2 text-xs font-bold text-[#8f3d0a]">↓ CSV</button>
                </div>
                <article className="rounded-2xl border border-[#efdfd2] bg-white p-3">
                  <button type="button" onClick={()=>setBranchOpenFor(branchOpen?null:branch)} className="flex w-full items-center justify-between gap-3 text-right"><span className="text-xs font-bold text-[#887565]">إجمالي أداء الفرع</span><strong className="text-2xl text-[#bd4b0a]">{Math.round(branchAvg)}%　{branchOpen?"−":"+"}</strong></button>
                  {branchOpen ? <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#f4e9df] pt-3 sm:grid-cols-3">{aggregateKpis(branchRows).map(k=><KpiTile key={k.name} kpi={k}/>)}</div> : null}
                  <TrackBadge percent={branchAvg} expected={branchExpected}/>
                </article>
                <h3 className="text-sm font-black">الموظفون · مرتّبون حسب الأداء</h3>
                <div className="space-y-2">{[...branchRows].sort((a,b)=>(b.payload.overall??0)-(a.payload.overall??0)).map((row,index)=><div key={row.branch_id} className="relative"><span className="absolute right-3 top-2 z-10 rounded-md bg-[#fff0e2] px-2 py-0.5 text-[10px] font-black text-[#8f3d0a]">#{index+1}</span>{renderRow(row)}</div>)}</div>
              </section>
            )}

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#efdfd2] pt-3">
              <p className="text-[10px] text-[#9a8879]">Track Your Sales · لوحة متابعة الأداء</p>
              <button type="button" onClick={()=>{setPwOpen(v=>!v);setPwMsg("");}} className="text-xs font-bold text-[#8f3d0a]">{pwOpen?"إخفاء تغيير كلمة السر":"🔑 تغيير كلمة السر"}</button>
            </footer>
            {pwOpen ? <form onSubmit={changePassword} className="rounded-2xl border border-[#efdfd2] bg-white p-4"><h3 className="mb-3 text-sm font-black">تغيير كلمة السر</h3><div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-bold">كلمة السر الحالية<input type="password" autoComplete="current-password" value={oldPw} onChange={e=>setOldPw(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#ead8c9] px-3 py-2.5 text-sm"/></label>
              <label className="text-xs font-bold">كلمة السر الجديدة<input type="password" autoComplete="new-password" value={newPw} onChange={e=>setNewPw(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#ead8c9] px-3 py-2.5 text-sm"/></label>
              <label className="text-xs font-bold">تأكيد كلمة السر<input type="password" autoComplete="new-password" value={newPw2} onChange={e=>setNewPw2(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#ead8c9] px-3 py-2.5 text-sm"/></label>
            </div>{pwMsg?<p className="mt-3 text-xs font-bold text-red-600">{pwMsg}</p>:null}<button type="submit" disabled={!oldPw||!newPw||!newPw2} className="mt-3 rounded-xl bg-[#bd4b0a] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">حفظ كلمة السر</button></form>:null}
          </>
        )}
      </div>
    </main>
  );
}
