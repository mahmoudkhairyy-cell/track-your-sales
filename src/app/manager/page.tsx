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
  const [view, setView] = useHistoryView<string>("overview");
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  const branchStatus = branchGroups.map(([name, group]) => {
    const percent = groupAverage(group);
    const expected = groupExpected(group);
    return { name, group, percent, expected, onTrack: expected !== undefined && percent >= expected };
  });
  const onTrackBranches = branchStatus.filter((b) => b.onTrack);
  const behindBranches = branchStatus.filter((b) => b.expected !== undefined && !b.onTrack);
  const unclassifiedBranches = branchStatus.filter((b) => b.expected === undefined);
  const today = cairoISODate();
  const loggedToday = allRows.filter((r) => (r.payload.entries ?? []).some((e) => e.date === today));
  const onLeaveToday = allRows.filter((r) => (r.payload.settings?.holidays ?? []).some((h) => h.date === today));
  const missingToday = allRows.filter((r) => !onLeaveToday.some((x) => x.branch_id === r.branch_id) && !loggedToday.some((x) => x.branch_id === r.branch_id));
  const navItems = [
    { id: "overview", label: "الرئيسية", icon: "⌂" },
    { id: "list", label: "الفروع", icon: "▦" },
    { id: "top", label: "الموظفون", icon: "♙" },
    { id: "activity", label: "التسجيلات", icon: "◷" },
    { id: "reports", label: "التقارير", icon: "▤" },
  ];
  const activeLabel = navItems.find((item) => item.id === view)?.label ?? (branch ? "تفاصيل الفرع" : "لوحة المدير");
  const changeView = (next: string) => { setView(next); setMobileMenuOpen(false); };
  const statusNames = (items: typeof branchStatus) => items.length ? (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((item) => <button key={item.name} type="button" onClick={() => changeView("b:" + item.name)} className="rounded-xl border border-[#f1dfd4] bg-white px-3 py-2 text-xs font-extrabold text-[#5b4030]">{item.name}</button>)}
    </div>
  ) : <p className="mt-3 text-xs text-[#927b69]">مفيش فروع في القائمة دي حاليًا.</p>;

  return (
    <main className="tys-page tx-manager min-h-screen bg-[#faf8f5] px-3 py-4 text-[#30251e] sm:px-5 sm:py-6" dir="rtl">
      {rows === null ? (
        <div className="mx-auto max-w-md">
          <section className="mt-10 rounded-[28px] border border-[#f0dfd2] bg-white p-6 shadow-sm">
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
        </div>
      ) : (
        <div className="mx-auto flex max-w-[1440px] gap-5">
          {mobileMenuOpen ? <button type="button" aria-label="إغلاق القائمة" onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-40 bg-[#30251e]/30 backdrop-blur-[2px] lg:hidden" /> : null}
          <aside className={"fixed inset-y-0 right-0 z-50 flex w-[min(82vw,300px)] flex-col border-l border-[#eee3d9] bg-white p-4 shadow-2xl transition-transform duration-200 lg:sticky lg:top-5 lg:z-auto lg:h-[calc(100vh-2.5rem)] lg:w-[248px] lg:shrink-0 lg:translate-x-0 lg:rounded-[28px] lg:border lg:shadow-sm " + (mobileMenuOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0")}>
            <div className="flex items-center gap-3 border-b border-[#f1e8e0] px-1 pb-5">
              <img src="/track-your-sales/logo-mark.png" alt="" className="h-10 w-10 object-contain" />
              <div className="min-w-0"><p className="text-[10px] font-black tracking-[.14em] text-[#c45b18]" dir="ltr">TRACK YOUR SALES</p><h2 className="mt-1 truncate text-sm font-black">لوحة المدير</h2></div>
              <button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="إغلاق القائمة" className="mr-auto rounded-lg p-2 text-[#8c7868] lg:hidden">✕</button>
            </div>
            <p className="px-2 pb-2 pt-6 text-[10px] font-extrabold text-[#a18c7c]">القائمة الرئيسية</p>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const active = view === item.id;
                return <button key={item.id} type="button" onClick={() => changeView(item.id)} className={"flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-right text-sm font-extrabold transition " + (active ? "bg-[#fff0e5] text-[#b94e0c] shadow-sm" : "text-[#766252] hover:bg-[#faf6f2]")}>
                  <span className={"flex h-8 w-8 items-center justify-center rounded-xl text-lg " + (active ? "bg-white text-[#c45b18]" : "bg-[#f8f5f1] text-[#927b69]")}>{item.icon}</span>{item.label}{active ? <span className="mr-auto h-1.5 w-1.5 rounded-full bg-[#d96a20]" /> : null}
                </button>;
              })}
            </nav>
            <div className="mt-auto rounded-2xl bg-[#fbf7f2] p-3">
              <p className="truncate text-xs font-extrabold">{managerName || "إدارة الفريق"}</p><p className="mt-1 text-[10px] text-[#9a8879]">متابعة الأداء اليومي</p>
              <button type="button" onClick={() => { setPwOpen((v) => !v); setPwMsg(""); setMobileMenuOpen(false); }} className="mt-3 w-full rounded-xl border border-[#eadbce] bg-white px-3 py-2 text-xs font-bold text-[#8f3d0a]">⚙ تغيير كلمة السر</button>
            </div>
          </aside>

          <div className="min-w-0 flex-1 space-y-5">
            <header className="flex items-center justify-between gap-3 rounded-[24px] border border-[#eee5dc] bg-white px-4 py-3 shadow-sm sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <button type="button" onClick={() => setMobileMenuOpen(true)} aria-label="فتح القائمة" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff2e8] text-xl text-[#b94e0c] lg:hidden">☰</button>
                <div className="min-w-0"><p className="text-[10px] font-black tracking-[.14em] text-[#c45b18]" dir="ltr">MANAGEMENT</p><h1 className="mt-0.5 truncate text-xl font-black sm:text-2xl">{activeLabel}</h1><p className="mt-0.5 truncate text-[11px] text-[#927b69]">{managerName || "متابعة أداء الفريق"}</p></div>
              </div>
              <button type="button" disabled={pending} onClick={() => load()} className="shrink-0 rounded-xl border border-[#eee0d5] bg-white px-3 py-2.5 text-xs font-extrabold text-[#8f3d0a] disabled:opacity-50">{pending ? "تحديث..." : "↻ تحديث"}</button>
            </header>
            {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</p> : null}

            {view === "overview" ? (
              <div className="space-y-5">
                <section className="relative overflow-hidden rounded-[28px] border border-[#f0e2d7] bg-gradient-to-br from-white via-[#fffaf6] to-[#fff0e4] p-5 shadow-sm sm:p-7">
                  <div className="pointer-events-none absolute -left-12 -top-16 h-48 w-48 rounded-full bg-[#f6d7bd]/35 blur-3xl" />
                  <div className="relative">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><p className="text-[10px] font-black tracking-[.16em] text-[#bd642c]" dir="ltr">AREA OVERVIEW</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">أداء الأريا</h2><p className="mt-1 text-xs text-[#927b69]">ملخص حالة الفروع ومين محتاج متابعة</p></div>
                      <span className={"rounded-full px-3 py-1.5 text-xs font-black " + (behindBranches.length ? "bg-[#fff0ed] text-[#b83c32]" : unclassifiedBranches.length === branchGroups.length && branchGroups.length > 0 ? "bg-[#f5f1eb] text-[#806c5a]" : "bg-[#eaf6ef] text-[#28764b]")}>{behindBranches.length ? "تحتاج متابعة" : unclassifiedBranches.length === branchGroups.length && branchGroups.length > 0 ? "في انتظار البيانات" : "الأريا On Track"}</span>
                    </div>
                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-[#e5eee7] bg-white/85 p-4 shadow-sm"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-[#718477]">فروع On Track</span><span className="text-lg text-[#36845a]">✓</span></div><p className="mt-2 text-4xl font-black tabular-nums text-[#28764b]">{onTrackBranches.length}</p></div>
                      <div className="rounded-2xl border border-[#f3e0dc] bg-white/85 p-4 shadow-sm"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-[#96716b]">فروع متأخرة</span><span className="text-lg text-[#c34c42]">!</span></div><p className="mt-2 text-4xl font-black tabular-nums text-[#b83c32]">{behindBranches.length}</p></div>
                    </div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl border border-[#f1e7df] bg-white/75 p-4"><div className="flex items-center gap-2 text-sm font-black text-[#28764b]">✓ الفروع المنتظمة</div>{statusNames(onTrackBranches)}</div>
                      <div className="rounded-2xl border border-[#f1e1de] bg-white/75 p-4"><div className="flex items-center gap-2 text-sm font-black text-[#b83c32]">! الفروع المتأخرة</div>{statusNames(behindBranches)}</div>
                    </div>
                    {unclassifiedBranches.length ? <p className="mt-3 text-[11px] leading-5 text-[#927b69]">فيه {unclassifiedBranches.length} فرع من غير نسبة متوقعة كافية لتحديد حالته حاليًا.</p> : null}
                  </div>
                </section>
                <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[#eee5dc] bg-white p-4 shadow-sm"><p className="text-xs font-bold text-[#927b69]">إجمالي الفروع</p><p className="mt-2 text-3xl font-black tabular-nums">{branchGroups.length}</p></div>
                  <div className="rounded-2xl border border-[#eee5dc] bg-white p-4 shadow-sm"><p className="text-xs font-bold text-[#927b69]">إجمالي الموظفين</p><p className="mt-2 text-3xl font-black tabular-nums">{allRows.length}</p></div>
                  <div className="col-span-2 rounded-2xl border border-[#eee5dc] bg-white p-4 shadow-sm sm:col-span-1"><p className="text-xs font-bold text-[#927b69]">سجلوا إنجازاتهم النهارده</p><p className="mt-2 text-3xl font-black tabular-nums text-[#bd5b1b]">{loggedToday.length}<span className="mr-1 text-sm text-[#927b69]">/ {allRows.length}</span></p></div>
                </section>
                <section className="rounded-[24px] border border-[#eee5dc] bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-center justify-between gap-3"><div><h3 className="text-base font-black">الفروع محتاجة متابعة</h3><p className="mt-1 text-[11px] text-[#927b69]">اضغط على الفرع لفتح تفاصيله</p></div><button type="button" onClick={() => changeView("list")} className="rounded-xl bg-[#fff1e7] px-3 py-2 text-xs font-extrabold text-[#a94b13]">كل الفروع</button></div>
                  {behindBranches.length ? <div className="mt-3 divide-y divide-[#f3eae3]">{behindBranches.slice(0, 5).map((b) => <button key={b.name} type="button" onClick={() => changeView("b:" + b.name)} className="flex w-full items-center justify-between gap-3 py-3 text-right"><span className="font-extrabold">{b.name}</span><span className="rounded-full bg-[#fff0ed] px-2.5 py-1 text-[10px] font-black text-[#b83c32]">متأخر</span></button>)}</div> : <p className="mt-4 rounded-xl bg-[#f4f8f4] p-3 text-xs text-[#54745f]">مفيش فروع متأخرة حاليًا حسب البيانات المتاحة.</p>}
                </section>
              </div>
            ) : view === "list" ? (
              <div className="space-y-4">
                <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[#eee5dc] bg-white p-4"><p className="text-xs text-[#927b69]">الفروع</p><p className="mt-1 text-2xl font-black">{branchGroups.length}</p></div>
                  <div className="rounded-2xl border border-[#eee5dc] bg-white p-4"><p className="text-xs text-[#927b69]">الموظفين</p><p className="mt-1 text-2xl font-black">{allRows.length}</p></div>
                  <div className="col-span-2 rounded-2xl border border-[#eee5dc] bg-white p-4 sm:col-span-1"><p className="text-xs text-[#927b69]">متوسط أداء الفروع</p><p className="mt-1 text-2xl font-black text-[#bd5b1b]">{branchGroups.length ? Math.round(branchGroups.reduce((sum, [, group]) => sum + groupAverage(group), 0) / branchGroups.length) : 0}%</p></div>
                </section>
                <section><h2 className="text-lg font-black">كل الفروع</h2><p className="text-[11px] text-[#887565]">{allRows.length} تقرير · {lastLoaded ? lastLoaded.toLocaleTimeString("en-US", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hour12: false }) : "لم يتم التحديث بعد"}</p></section>
                {branchStatus.length ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[...branchStatus].sort((a,b)=>a.percent-b.percent).map((b)=><button key={b.name} type="button" onClick={()=>changeView("b:" + b.name)} className="rounded-2xl border border-[#eee5dc] bg-white p-4 text-right shadow-sm"><div className="flex items-center justify-between gap-2"><p className="font-black" dir="ltr">{b.name}</p><span className={"rounded-full px-2 py-1 text-[10px] font-black " + (b.expected===undefined?"bg-[#f5f1eb] text-[#806c5a]":b.onTrack?"bg-[#eaf6ef] text-[#28764b]":"bg-[#fff0ed] text-[#b83c32]")}>{b.expected===undefined?"غير محدد":b.onTrack?"On Track":"متأخر"}</span></div><p className="mt-3 text-2xl font-black tabular-nums text-[#bd5b1b]">{Math.round(b.percent)}%</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f5eee8]"><div className="h-full rounded-full bg-[#d96a20]" style={{width: Math.min(100,Math.max(0,b.percent)) + "%"}} /></div><p className="mt-2 text-[10px] text-[#927b69]">{b.group.length} موظف</p></button>)}</section> : <div className="rounded-2xl border border-dashed border-[#e8d5c5] bg-white p-8 text-center"><p className="font-extrabold">لا توجد تقارير حتى الآن</p><p className="mt-1 text-xs text-[#887565]">ستظهر بيانات الفريق بعد المزامنة.</p></div>}
              </div>
            ) : view === "top" ? (
              <section className="space-y-3 rounded-[24px] border border-[#eee5dc] bg-white p-4 shadow-sm sm:p-5">
                <div><h2 className="text-lg font-black">ترتيب الموظفين</h2><p className="text-xs text-[#887565]">من الأعلى إلى الأقل تحقيقًا</p></div>
                <div className="divide-y divide-[#f4e9df]">{topRows.map((row) => <div key={row.branch + row.name + row.rank} className="flex items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#fff0e2] text-xs font-black text-[#a94308]">{row.rank}</span><div className="min-w-0"><p className="truncate text-sm font-extrabold">{row.name}</p><p className="truncate text-[11px] text-[#887565]" dir="ltr">{row.branch}</p></div></div><strong className="text-lg tabular-nums text-[#bd4b0a]">{Math.round(row.percent)}%</strong></div>)}</div>
              </section>
            ) : view === "activity" ? (
              <section className="space-y-4 rounded-[24px] border border-[#eee5dc] bg-white p-4 shadow-sm sm:p-5">
                <div><h2 className="text-lg font-black">متابعة تسجيلات النهارده</h2><p className="text-xs text-[#887565]" dir="ltr">{today}</p></div>
                <div className="grid gap-4 sm:grid-cols-3">
                  {[{title:"سجّلوا",items:loggedToday,tone:"text-emerald-700"},{title:"لم يسجلوا",items:missingToday,tone:"text-red-700"},{title:"إجازة",items:onLeaveToday,tone:"text-[#927b69]"}].map((group)=><div key={group.title} className="rounded-2xl bg-[#fbf8f5] p-3"><div className="mb-3 flex items-center justify-between"><h3 className={"text-sm font-black " + group.tone}>{group.title}</h3><span className="text-lg font-black tabular-nums">{group.items.length}</span></div>{group.items.length?<div className="space-y-2">{group.items.map((r)=><div key={r.branch_id} className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-xs"><b>{r.employee_name}</b><span className="truncate text-[#927b69]" dir="ltr">{r.branch_name||NO_BRANCH}</span></div>)}</div>:<p className="text-xs text-[#927b69]">لا يوجد</p>}</div>)}
                </div>
              </section>
            ) : view === "reports" ? (
              <section className="space-y-3 rounded-[24px] border border-[#eee5dc] bg-white p-4 shadow-sm sm:p-5">
                <div><h2 className="text-lg font-black">تقارير الفروع</h2><p className="text-xs text-[#887565]">حمّل تقرير CSV تفصيلي لكل فرع</p></div>
                {branchGroups.length?<div className="divide-y divide-[#f4e9df]">{branchGroups.map(([name,group])=><div key={name} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-extrabold" dir="ltr">{name}</p><p className="mt-1 text-[10px] text-[#927b69]">{group.length} موظف</p></div><button type="button" onClick={()=>downloadBranchCsv(name,group)} className="shrink-0 rounded-xl bg-[#fff0e5] px-3 py-2 text-xs font-black text-[#a94b13]">↓ تحميل CSV</button></div>)}</div>:<p className="py-8 text-center text-xs text-[#927b69]">لا توجد بيانات لتصديرها.</p>}
              </section>
            ) : branch !== null ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3"><div><button type="button" onClick={()=>changeView("list")} className="mb-1 text-xs font-bold text-[#bd4b0a]">← كل الفروع</button><h2 className="text-xl font-black" dir="ltr">{branch}</h2><p className="text-xs text-[#887565]">{branchRows.length} موظف</p></div><button type="button" onClick={()=>downloadBranchCsv(branch,branchRows)} className="rounded-xl border border-[#efdfd2] bg-white px-3 py-2 text-xs font-bold text-[#8f3d0a]">↓ CSV</button></div>
                <article className="rounded-2xl border border-[#efdfd2] bg-white p-3"><button type="button" onClick={()=>setBranchOpenFor(branchOpen?null:branch)} className="flex w-full items-center justify-between gap-3 text-right"><span className="text-xs font-bold text-[#887565]">إجمالي أداء الفرع</span><strong className="text-2xl text-[#bd4b0a]">{Math.round(branchAvg)}%　{branchOpen?"−":"+"}</strong></button>{branchOpen?<div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#f4e9df] pt-3 sm:grid-cols-3">{aggregateKpis(branchRows).map(k=><KpiTile key={k.name} kpi={k}/>)}</div>:null}<TrackBadge percent={branchAvg} expected={branchExpected}/></article>
                <h3 className="text-sm font-black">الموظفون · مرتّبون حسب الأداء</h3><div className="space-y-2">{[...branchRows].sort((a,b)=>(b.payload.overall??0)-(a.payload.overall??0)).map((row,index)=><div key={row.branch_id} className="relative"><span className="absolute right-3 top-2 z-10 rounded-md bg-[#fff0e2] px-2 py-0.5 text-[10px] font-black text-[#8f3d0a]">#{index+1}</span>{renderRow(row)}</div>)}</div>
              </section>
            ) : null}

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eee5dc] pt-4"><p className="text-[10px] text-[#9a8879]">Track Your Sales · لوحة متابعة الأداء</p><button type="button" onClick={()=>{setPwOpen(v=>!v);setPwMsg("");}} className="text-xs font-bold text-[#8f3d0a]">{pwOpen?"إخفاء تغيير كلمة السر":"🔑 تغيير كلمة السر"}</button></footer>
            {pwOpen ? <form onSubmit={changePassword} className="rounded-2xl border border-[#efdfd2] bg-white p-4"><h3 className="mb-3 text-sm font-black">تغيير كلمة السر</h3><div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-bold">كلمة السر الحالية<input type="password" autoComplete="current-password" value={oldPw} onChange={e=>setOldPw(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#ead8c9] px-3 py-2.5 text-sm"/></label>
              <label className="text-xs font-bold">كلمة السر الجديدة<input type="password" autoComplete="new-password" value={newPw} onChange={e=>setNewPw(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#ead8c9] px-3 py-2.5 text-sm"/></label>
              <label className="text-xs font-bold">تأكيد كلمة السر<input type="password" autoComplete="new-password" value={newPw2} onChange={e=>setNewPw2(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#ead8c9] px-3 py-2.5 text-sm"/></label>
            </div>{pwMsg?<p className="mt-3 text-xs font-bold text-red-600">{pwMsg}</p>:null}<button type="submit" disabled={!oldPw||!newPw||!newPw2} className="mt-3 rounded-xl bg-[#bd4b0a] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">حفظ كلمة السر</button></form>:null}
          </div>
        </div>
      )}
    </main>
  );
}
