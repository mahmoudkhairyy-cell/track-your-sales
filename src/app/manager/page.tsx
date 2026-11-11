"use client";

import { FormEvent, useEffect, useState } from "react";
import { useHistoryView } from "@/lib/use-history-view";
import { managerApi } from "@/lib/cloud";
import { applyCompanyRules } from "@/lib/calculations";
import { KPI_CATALOG, type KpiKey } from "@/lib/constants";
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
    ? { text: "text-[var(--color-text-secondary)]", bar: "from-[var(--color-border)] to-[#e8b88f]", ring: "ring-[var(--color-border)]" }
    : ok
      ? { text: "text-emerald-700", bar: "from-emerald-400 to-emerald-600", ring: "ring-emerald-200" }
      : { text: "text-red-600", bar: "from-red-400 to-red-600", ring: "ring-red-200" };
  return (
    <div
      style={neutral ? undefined : { boxShadow: ok
        ? "0 0 0 1px rgba(22,163,74,.12), 0 0 18px rgba(22,163,74,.16), 0 6px 18px rgba(22,163,74,.08)"
        : "0 0 0 1px rgba(220,38,38,.12), 0 0 18px rgba(220,38,38,.16), 0 6px 18px rgba(220,38,38,.08)" }}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-[var(--color-primary-50)]/60 p-3 shadow-sm ring-1 transition duration-300 hover:-translate-y-0.5 hover:shadow-lg ${tone.ring} ${neutral ? "" : ok ? "bg-emerald-50/70" : "bg-red-50/70"}`}
    >
      <p className="truncate text-[10px] font-extrabold text-[var(--color-text-secondary)]" dir="ltr">{kpi.name}</p>
      <p className={`mt-1 text-2xl font-black tabular-nums tracking-tight ${tone.text}`}>
        {Math.round(kpi.percent)}<span className="text-sm">%</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80">
        <div className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out ${tone.bar}`} style={{ width: `${Math.min(100, Math.max(0, kpi.percent))}%` }} />
      </div>
      <p className="mt-1.5 text-[10px] tabular-nums text-[var(--color-text-secondary)]" dir="ltr">{Math.round(kpi.achieved)} / {kpi.target}</p>
    </div>
  );
}

type TopRow = { rank: number; name: string; branch: string; branchId: string; percent: number };

/** نسبة الفرع: كل بند نسبته الكلية للفرع (مجموع المحقق ÷ مجموع التارجت) × وزن البند من الشيت. */
// نفس قواعد الموظف بالظبط (applyCompanyRules) على مجموع الفرع، عشان الفرع اللي فيه موظف واحد يطلع نفس رقم الموظف.
function groupAverage(group: ReportRow[]): number {
  const rulesKpis = aggregateKpis(group).flatMap((k) => {
    const catalog = KPI_CATALOG.find((item) => item.nameEn === k.name);
    if (!catalog) return [];
    return [{ kpiKey: catalog.key as KpiKey, target: k.target, weight: k.weight, unitAr: catalog.unitAr, achieved: k.achieved }];
  });
  if (!rulesKpis.length) return 0;
  return applyCompanyRules(rulesKpis).total;
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

const FEMALE_MANAGER_NAMES = ["نسمة", "nasma", "nesma", "رنا", "rana"];

function managerTitle(name: string): string {
  const n = name.trim().toLowerCase();
  return n && FEMALE_MANAGER_NAMES.some((f) => n.includes(f.toLowerCase())) ? "MS." : "MR.";
}

type ManagerIconName = "home" | "branches" | "users" | "activity" | "reports" | "trend" | "alert" | "settings";

function ManagerIcon({ name, size = 18 }: { name: ManagerIconName; size?: number }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<ManagerIconName, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    branches: <><rect x="3.5" y="4" width="7" height="7" rx="1.5" /><rect x="13.5" y="13" width="7" height="7" rx="1.5" /><path d="M10.5 7.5h3a2 2 0 0 1 2 2V13" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20zM16 5.5a3 3 0 0 1 0 5.8M17 14a4.5 4.5 0 0 1 3.5 4.4V20" /></>,
    activity: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.2 2" /></>,
    reports: <><path d="M6 3.5h8l4 4V20H6z" /><path d="M14 3.5V8h4M9 12h6M9 16h6" /></>,
    trend: <><path d="m4 16 5-5 3 3 7-8" /><path d="M14 6h5v5" /></>,
    alert: <><path d="M12 3.5 21 20H3z" /><path d="M12 9v4M12 16.5h.01" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.2 1-1.4 2.4-1.5-.6a8 8 0 0 1-1.5.9l-.3 1.6h-2.8l-.3-1.6a8 8 0 0 1-1.5-.9l-1.5.6L6.5 16l1.2-1a7 7 0 0 1 0-1.8l-1.2-1 1.4-2.4 1.5.6a8 8 0 0 1 1.5-.9l.3-1.6H14l.3 1.6a8 8 0 0 1 1.5.9l1.5-.6 1.4 2.4-1.2 1a7 7 0 0 1-.1 1.8Z" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...common}>{paths[name]}</svg>;
}

export default function ManagerPage() {
  const [password, setPassword] = useState("");
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [branchOpenFor, setBranchOpenFor] = useState<string | null>(null);
  const [branchPreview, setBranchPreview] = useState<string | null>(null);
  // "list" = الفروع، "b:<فرع>" = صفحة فرع، "b:<فرع>|e:<id>" = موظف مفتوح. كل خطوة بتتسجل في تاريخ المتصفح.
  // زرار الرجوع في الموبايل بيرجّع لشاشة المدير اللي قبلها (الفرع/الموظف/الرئيسية) من غير ما يطلّع من الصفحة.
  const [view, setView] = useHistoryView<string>("overview");
  const branch = view.startsWith("b:") ? view.slice(2).split("|e:")[0] : null;
  const branchOpen = branch !== null && branchOpenFor === branch;
  // فتح وقفل بنود الموظف حالة داخل الصفحة فقط، ولا يضيف أي خطوة إلى سجل زر الرجوع.
  const [openId, setOpenId] = useState<string | null>(null);
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
  const [greeting, setGreeting] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setPwMsg("");
    if (newPw.length < 8) return setPwMsg("الباسورد الجديد لازم يكون 8 حروف على الأقل.");
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
      setPwMsg(raw.includes("wrong password") ? "الباسورد القديم مش صح. اكتبه تاني." : "حصلت مشكلة في الحفظ. اتأكد من النت وحاول تاني.");
    }
  }

  useEffect(() => {
    // بيتحسب بعد الـ render (مش جوه الـ effect مباشرة) عشان قاعدة lint بتمنع setState المتزامن.
    const id = setTimeout(() => {
      const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "numeric", hour12: false }).format(new Date()));
      setGreeting(hour < 12 ? "صباح الخير" : "مساء الخير");
    }, 0);
    return () => clearTimeout(id);
  }, []);

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
    .map((r) => ({ name: r.employee_name, branch: r.branch_name || NO_BRANCH, branchId: r.branch_id, percent: r.payload.overall ?? 0 }))
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
        setError("كلمة السر مش صح. جرّب تاني.");
      } else {
        // خطأ نت أو غيره: نحتفظ بالبيانات اللي موجودة ونعرض الخطأ فوقها.
        setError(`ماقدرناش نحدّث البيانات. اتأكد من النت وحاول تاني. (${raw.slice(0, 160)})`);
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
      setError(`ماقدرناش نمسح بيانات ${row.employee_name}. حاول تاني. (${err instanceof Error ? err.message.slice(0, 120) : ""})`);
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
      <article key={row.branch_id} className="tys-manager-employee-card rounded-[26px] bg-white/95 p-4 shadow-[0_10px_28px_rgba(126,65,24,0.06)] ring-1 ring-[var(--color-border)]/70">
        <button type="button" onClick={() => setOpenId(open ? null : row.branch_id)} className="flex w-full items-center justify-between gap-3 text-right">
          <div>
            <h3 className="font-black">{row.employee_name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {row.payload.role === "team_leader" ? <span className="rounded-full bg-[var(--color-primary-50)] px-2 py-0.5 text-[10px] font-black text-[var(--color-primary-700)]">🧑‍🏫 تيم ليدر</span> : null}
              <TrackBadge percent={row.payload.overall} expected={row.payload.expectedPercent} />
              {staleClass ? (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${staleClass}`}>آخر تحديث من {Math.floor(days)} يوم</span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-black text-[var(--color-primary-700)] tabular-nums">{percent}%</p>
            <span className="text-[var(--color-text-secondary)]">{open ? "▲" : "▼"}</span>
          </div>
        </button>

        {open ? (
          <>
            <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]" dir="ltr">
              {new Date(row.updated_at).toLocaleString("en-US", { timeZone: "Africa/Cairo", hour12: false })}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
              {(row.payload.kpis ?? []).map((kpi, index) => (
                <div key={kpi.name} className="tys-rise" style={{ animationDelay: `${index * 70}ms` }}>
                  <KpiTile kpi={kpi} />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setDetailsId(detailsId === row.branch_id ? null : row.branch_id)}
              className="mt-3 w-full rounded-2xl bg-[var(--color-primary-50)] py-2 text-xs font-extrabold text-[var(--color-primary-700)]"
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
                    <div key={k.kpiKey} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-cream)] px-3 py-2">
                      <span className="min-w-0 font-extrabold text-[var(--color-text-primary)]">{kpiLabel(k.kpiKey)}</span>
                      <span className="whitespace-nowrap text-[10px] font-bold tabular-nums text-[var(--color-text-secondary)] sm:text-xs">تارجت {k.target} · وزن {k.weight}%</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="mb-2 flex items-center justify-between font-black"><span>كل الإنجازات</span><span className="rounded-full bg-[var(--color-primary-50)] px-2 py-0.5 text-[10px] font-black text-[var(--color-primary-700)]">{row.payload.entries?.length ?? 0}</span></p>
                  {(row.payload.entries ?? []).length === 0 ? <p className="text-[var(--color-text-secondary)]">لا يوجد</p> : null}
                  {(row.payload.entries ?? []).map((e, i) => (
                    <div key={`${e.date}-${i}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-cream)] px-3 py-2.5 text-[11px] sm:text-xs">
                      <span className="font-bold text-[var(--color-text-secondary)]" dir="ltr">{e.date}</span>
                      <span className="min-w-0 truncate font-extrabold text-[var(--color-text-primary)]">{kpiLabel(e.kpi)}</span>
                      <span className="whitespace-nowrap rounded-lg bg-[var(--color-primary-50)] px-2 py-1 font-black tabular-nums text-[var(--color-primary-700)]">{e.quantity} {e.unit}</span>
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
  const onTrackEmployees = allRows.filter((r) => typeof r.payload.expectedPercent === "number" && (r.payload.overall ?? 0) >= (r.payload.expectedPercent ?? 0));
  const behindEmployees = allRows.filter((r) => typeof r.payload.expectedPercent === "number" && (r.payload.overall ?? 0) < (r.payload.expectedPercent ?? 0));
  const today = cairoISODate();
  const loggedToday = allRows.filter((r) => (r.payload.entries ?? []).some((e) => e.date === today));
  const onLeaveToday = allRows.filter((r) => (r.payload.settings?.holidays ?? []).some((h) => h.date === today));
  const missingToday = allRows.filter((r) => !onLeaveToday.some((x) => x.branch_id === r.branch_id) && !loggedToday.some((x) => x.branch_id === r.branch_id));
  const navItems = [
    { id: "overview", label: "الرئيسية", icon: "home" as const },
    { id: "list", label: "الفروع", icon: "branches" as const },
    { id: "top", label: "الموظفون", icon: "users" as const },
    { id: "activity", label: "التسجيلات", icon: "activity" as const },
    { id: "reports", label: "التقارير", icon: "reports" as const },
  ];
  const activeLabel = navItems.find((item) => item.id === view)?.label ?? (branch ? "تفاصيل الفرع" : "لوحة المدير");
  const changeView = (next: string) => { setView(next); setMobileMenuOpen(false); };
  const statusNames = (items: typeof branchStatus) => items.length ? (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((item) => <button key={item.name} type="button" onClick={() => changeView("b:" + item.name)} className="rounded-xl border border-[#f1dfd4] bg-white px-3 py-2 text-xs font-extrabold text-[var(--color-text-primary)]">{item.name}</button>)}
    </div>
  ) : <p className="mt-3 text-xs text-[var(--color-text-secondary)]">مفيش فروع في القائمة دي حاليًا.</p>;

  return (
    <main className="tys-page tx-manager min-h-screen bg-[radial-gradient(ellipse_at_top_left,rgba(255,176,111,.13),transparent_38%),linear-gradient(145deg,#fffaf6_0%,#f8f4ef_55%,#fff8f1_100%)] px-3 py-4 text-[var(--color-text-primary)] sm:px-5 sm:py-6" dir="rtl">
      {rows === null ? (
        <div className="mx-auto max-w-md">
          <section className="mt-10 rounded-[28px] border border-[var(--color-border)] bg-white p-6 shadow-sm">
            <div className="mb-6 text-center">
              <img src="/track-your-sales/logo-mark.png" alt="" className="mx-auto h-12 w-12 object-contain" />
              <p className="mt-3 text-[10px] font-black tracking-[.16em] text-[var(--color-primary-700)]" dir="ltr">MANAGEMENT</p>
              <h1 className="mt-1 text-2xl font-black">دخول المدير</h1>
              <p className="mt-2 text-xs leading-6 text-[var(--color-text-secondary)]">ادخل كلمة السر لمتابعة تقارير الفريق.</p>
            </div>
            <form onSubmit={load} className="space-y-3">
              <label className="block text-sm font-bold">كلمة السر
                <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="اكتب كلمة السر" className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-cream)] px-4 py-3 text-base outline-none focus:border-[#d9651b]" />
              </label>
              {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
              <button type="submit" disabled={pending || !password} className="w-full rounded-xl bg-[var(--color-primary-700)] py-3 font-extrabold text-white disabled:opacity-50">{pending ? "جاري الدخول..." : "دخول"}</button>
            </form>
          </section>
        </div>
      ) : (
        <div className="mx-auto flex max-w-[1440px] gap-5">
          {mobileMenuOpen ? <button type="button" aria-label="إغلاق القائمة" onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-40 bg-[var(--color-text-primary)]/30 backdrop-blur-[2px] lg:hidden" /> : null}
          <aside className={"fixed inset-y-0 right-0 z-50 flex w-[min(82vw,300px)] flex-col border-l border-white/70 bg-white/90 p-4 shadow-2xl backdrop-blur-2xl transition-transform duration-200 lg:sticky lg:top-5 lg:z-auto lg:h-[calc(100vh-2.5rem)] lg:w-[248px] lg:shrink-0 lg:translate-x-0 lg:rounded-[28px] lg:border lg:shadow-[0_14px_42px_rgba(93,54,26,.08)] " + (mobileMenuOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0")}>
            <div className="flex items-center gap-3 border-b border-[#f1e8e0] px-1 pb-5">
              <img src="/track-your-sales/logo-mark.png" alt="" className="h-10 w-10 object-contain" />
              <div className="min-w-0"><p className="text-[10px] font-black tracking-[.14em] text-[var(--color-primary-700)]" dir="ltr">TRACK YOUR SALES</p><h2 className="mt-1 truncate text-sm font-black">لوحة المدير</h2></div>
              <button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="إغلاق القائمة" className="mr-auto rounded-lg p-2 text-[#8c7868] lg:hidden">✕</button>
            </div>
            <p className="px-2 pb-2 pt-6 text-[10px] font-extrabold text-[var(--color-text-secondary)]">القائمة الرئيسية</p>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const active = view === item.id;
                const className = "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-right text-sm font-extrabold transition " + (active ? "bg-[#fff0e5] text-[var(--color-primary-700)] shadow-sm" : "text-[#766252] hover:bg-[#faf6f2]");
                const content = <>
                  <span className={"flex h-8 w-8 items-center justify-center rounded-xl " + (active ? "bg-white text-[var(--color-primary-700)]" : "bg-[#f8f5f1] text-[var(--color-text-secondary)]")}><ManagerIcon name={item.icon} size={17} /></span>{item.label}{active ? <span className="mr-auto h-1.5 w-1.5 rounded-full bg-[var(--color-primary-600)]" /> : null}
                </>;
                // الرجوع للرئيسية يتم داخل نفس الجلسة حتى لا نفقد حالة دخول المدير.
                if (item.id === "overview") {
                  return <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setView("overview");
                      setBranchPreview(null);
                      setBranchOpenFor(null);
                      setDetailsId(null);
                      setPwOpen(false);
                      setMobileMenuOpen(false);
                    }}
                    className={className}
                  >{content}</button>;
                }
                return <button key={item.id} type="button" onClick={() => changeView(item.id)} className={className}>{content}</button>;
              })}
            </nav>
            <div className="mt-auto rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface-cream)] to-[var(--color-primary-50)]/70 p-3">
              <p className="truncate text-xs font-extrabold">{managerName || "إدارة الفريق"}</p><p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">متابعة الأداء اليومي</p>
              <button type="button" onClick={() => { setPwOpen((v) => !v); setPwMsg(""); setMobileMenuOpen(false); }} className="mt-3 w-full rounded-xl border border-[#eadbce] bg-white px-3 py-2 text-xs font-bold text-[var(--color-primary-700)]">⚙ تغيير كلمة السر</button>
            </div>
          </aside>

          <div className="min-w-0 flex-1 space-y-5">
            <header className="flex items-center justify-between gap-3 rounded-[24px] border border-white/80 bg-white/80 px-4 py-3 shadow-[0_10px_30px_rgba(104,53,19,.055)] backdrop-blur-xl sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <button type="button" onClick={() => setMobileMenuOpen(true)} aria-label="فتح القائمة" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-50)] text-xl text-[var(--color-primary-700)] lg:hidden">☰</button>
                <div className="min-w-0"><p className="text-[10px] font-black tracking-[.14em] text-[var(--color-primary-700)]" dir="ltr">MANAGEMENT</p><h1 className="mt-0.5 truncate text-xl font-black sm:text-2xl">{activeLabel}</h1><p className="mt-0.5 truncate text-[11px] text-[var(--color-text-secondary)]">متابعة أداء الفريق</p></div>
              </div>
              <div className="flex shrink-0 items-center gap-2"><div className="flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-cream)] py-1 pl-1 pr-1 sm:py-1.5 sm:pl-3 sm:pr-1.5"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-primary-700)] to-[var(--color-primary-500)] text-xs font-black text-white">{(managerName.trim()[0] || "م").toUpperCase()}</span><span className="hidden max-w-[120px] truncate text-[11px] font-extrabold text-[var(--color-text-primary)] sm:inline">{managerName || "المدير"}</span></div><button type="button" disabled={pending} onClick={() => load()} className="shrink-0 rounded-xl border border-[#eee0d5] bg-white px-3 py-2.5 text-xs font-extrabold text-[var(--color-primary-700)] disabled:opacity-50">{pending ? "تحديث..." : "↻ تحديث"}</button></div>
            </header>
            {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</p> : null}

            {view === "overview" ? (
              <div className="space-y-5">
                {greeting && managerName ? (
                  <p className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-cream)] px-3 py-1.5 text-xs font-extrabold text-[var(--color-primary-700)]">
                    <span aria-hidden="true">👋</span>{greeting}، {managerTitle(managerName)} {managerName}
                  </p>
                ) : null}
                
                <section className="grid grid-cols-3 gap-2.5 sm:grid-cols-3 sm:gap-3">
                  {[
                    {label:"إجمالي الفروع",value:branchGroups.length,sub:"كل فروع الأريا",tone:"orange",icon:"branches" as const},
                    {label:"فروع متقدمة",value:branchStatus.filter(b=>b.expected!==undefined && b.percent-b.expected>=5).length,sub:"أعلى من المتوقع",tone:"green",icon:"trend" as const},
                    {label:"فروع متأخرة",value:behindBranches.length,sub:"تحتاج متابعة",tone:"red",icon:"alert" as const},
                    {label:"إجمالي الموظفين",value:allRows.length,sub:"ضمن التقارير الحالية",tone:"violet",icon:"users" as const},
                    {label:"موظفون On Track",value:onTrackEmployees.length,sub:"على المسار أو متقدم",tone:"green",icon:"trend" as const},
                    {label:"Behind",value:behindEmployees.length,sub:"يحتاجون متابعة",tone:"red",icon:"alert" as const}
                  ].map((item)=>(
                    <article key={item.label} className="min-w-0 rounded-[20px] border border-[var(--color-border)] bg-white/85 p-3 shadow-[0_8px_24px_rgba(126,65,24,.055)] backdrop-blur-xl sm:rounded-[24px] sm:p-4">
                      <div className="flex items-center justify-between gap-1">
                        <span className={"flex h-8 w-8 items-center justify-center rounded-xl text-sm font-black "+(item.tone==="red"?"bg-red-50 text-red-600":item.tone==="green"?"bg-emerald-50 text-emerald-700":item.tone==="violet"?"bg-violet-50 text-violet-700":"bg-[var(--color-primary-50)] text-[var(--color-primary-700)]")}><ManagerIcon name={item.icon} size={17} /></span>
                        <span className="hidden text-[9px] font-bold text-[var(--color-text-secondary)] sm:inline">{item.sub}</span>
                      </div>
                      <p className="mt-3 truncate text-[10px] font-extrabold text-[var(--color-text-secondary)] sm:text-xs">{item.label}</p>
                      <strong className={"mt-0.5 block text-2xl font-black tabular-nums sm:text-3xl "+(item.tone==="red"?"text-red-600":item.tone==="green"?"text-emerald-700":"text-[var(--color-text-primary)]")}>{item.value}</strong>
                    </article>
                  ))}
                </section>

                
              </div>
            ) : view === "list" ? (
              <div className="space-y-4">
                <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[#eee5dc] bg-white p-4"><p className="text-xs text-[var(--color-text-secondary)]">الفروع</p><p className="mt-1 text-2xl font-black">{branchGroups.length}</p></div>
                  <div className="rounded-2xl border border-[#eee5dc] bg-white p-4"><p className="text-xs text-[var(--color-text-secondary)]">الموظفين</p><p className="mt-1 text-2xl font-black">{allRows.length}</p></div>
                  <div className="col-span-2 rounded-2xl border border-[#eee5dc] bg-white p-4 sm:col-span-1"><p className="text-xs text-[var(--color-text-secondary)]">فروع متأخرة</p><p className="mt-1 text-2xl font-black text-red-600">{behindBranches.length}</p></div>
                </section>
                <section><h2 className="text-lg font-black">كل الفروع</h2><p className="text-[11px] text-[var(--color-text-secondary)]">{allRows.length} تقرير · {lastLoaded ? lastLoaded.toLocaleTimeString("en-US", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hour12: false }) : "لم يتم التحديث بعد"}</p></section>
                {branchStatus.length ? <section className="overflow-hidden rounded-[26px] border border-[var(--color-border)] bg-white/90 shadow-[0_10px_28px_rgba(104,53,19,.055)]"><div className="hidden grid-cols-[52px_minmax(0,1.5fr)_minmax(100px,1fr)_100px_90px] gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface-cream)] px-4 py-3 text-[10px] font-black text-[var(--color-text-secondary)] sm:grid"><span>الترتيب</span><span>الفرع</span><span>الحالة</span><span>الإنجاز</span><span>الموظفون</span></div><div className="divide-y divide-[var(--color-border)]">{[...branchStatus].sort((a,b)=>b.percent-a.percent).map((b,index)=>{const delta=b.expected===undefined?null:b.percent-b.expected;const label=delta===null?"بيانات غير مكتملة":delta<0?"متأخر":delta>=15?"متقدم جدًا":delta>=5?"متقدم":"على المسار";const tone=delta===null?"bg-stone-100 text-stone-600":delta<0?"bg-red-50 text-red-700":delta>=5?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-800";const ring=delta!==null&&delta<0?"var(--color-danger-text)":"var(--color-primary-600)";return <button key={b.name} type="button" onClick={()=>changeView("b:"+b.name)} className="grid w-full grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 text-right transition hover:bg-[var(--color-surface-cream)] sm:grid-cols-[52px_minmax(0,1.5fr)_minmax(100px,1fr)_100px_90px] sm:px-4"><span className="text-[10px] font-black text-[var(--color-text-secondary)]">#{index+1}</span><span className="min-w-0"><span className="block truncate text-xs font-black text-[var(--color-text-primary)]">{b.name}</span><span className="mt-1 block text-[10px] text-[var(--color-text-secondary)] sm:hidden">{b.group.length} موظف · {Math.round(b.percent)}% إنجاز</span></span><span className={"col-start-3 row-start-1 rounded-full px-2.5 py-1 text-[10px] font-black "+tone+" sm:col-start-auto sm:row-auto sm:justify-self-start"}>{label}</span><span className="col-span-2 flex items-center gap-2 sm:col-span-1"><span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{background:"conic-gradient("+ring+" "+Math.min(100,Math.max(0,b.percent))+"%, var(--color-border) 0)"}}><span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[9px] font-black tabular-nums">{Math.round(b.percent)}%</span></span><span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-border)] sm:hidden"><span className="block h-full rounded-full bg-gradient-to-l from-[var(--color-primary-700)] to-[var(--color-primary-500)]" style={{width:Math.min(100,Math.max(0,b.percent))+"%"}} /></span></span><span className="hidden text-xs font-bold text-[#6f5948] sm:block">{b.group.length}</span></button>})}</div></section> : <div className="rounded-2xl border border-dashed border-[#e8d5c5] bg-white p-8 text-center"><p className="font-extrabold">لا توجد تقارير حتى الآن</p><p className="mt-1 text-xs text-[var(--color-text-secondary)]">ستظهر بيانات الفريق بعد المزامنة.</p></div>}
              </div>
            ) : view === "top" ? (
              <section className="overflow-hidden rounded-[26px] border border-[var(--color-border)] bg-white/90 shadow-[0_10px_28px_rgba(104,53,19,.055)]">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-4 sm:px-5"><div><p className="text-[10px] font-black tracking-[.15em] text-[var(--color-primary-700)]" dir="ltr">TEAM LEADERBOARD</p><h2 className="mt-1 text-lg font-black">ترتيب الموظفين</h2><p className="mt-0.5 text-[10px] text-[var(--color-text-secondary)]">من الأعلى إلى الأقل تحقيقًا</p></div><span className="rounded-xl bg-[var(--color-primary-50)] px-3 py-2 text-xs font-black text-[var(--color-primary-700)]">{topRows.length} موظف</span></div>
                <div className="divide-y divide-[var(--color-border)]">{topRows.map((row) => {
                  const employee = allRows.find((item) => item.branch_id === row.branchId);
                  const expanded = openId === row.branchId;
                  return <div key={row.branchId}>
                    <button type="button" aria-expanded={expanded} onClick={() => setOpenId(expanded ? null : row.branchId)} className="flex w-full items-center gap-3 px-4 py-3.5 text-right transition hover:bg-[var(--color-surface-cream)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary-600)] sm:px-5"><span className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black "+(row.rank===1?"bg-[#fff0d7] text-[#a66a08]":row.rank===2?"bg-[#f2f3f5] text-[#657080]":row.rank===3?"bg-[#faeee5] text-[#9b5b31]":"bg-[var(--color-surface-cream)] text-[var(--color-primary-700)]")}>{row.rank}</span><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ffe2c9] to-[var(--color-primary-50)] text-sm font-black text-[var(--color-primary-700)]">{(row.name.trim()[0]||"م").toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-[var(--color-text-primary)]">{row.name}</p><p className="truncate text-[10px] text-[var(--color-text-secondary)]" dir="ltr">{row.branch}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]"><div className="h-full rounded-full bg-gradient-to-l from-[var(--color-primary-700)] to-[var(--color-primary-500)]" style={{width:Math.min(100,Math.max(0,row.percent))+"%"}} /></div></div><strong className="shrink-0 text-lg font-black tabular-nums text-[var(--color-primary-700)]">{Math.round(row.percent)}%</strong><span className="text-[var(--color-text-secondary)]" aria-hidden="true">{expanded ? "⌄" : "‹"}</span></button>
                    {expanded && employee ? <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-cream)]/60 px-4 py-4 sm:px-5">
                      <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-xs font-black">بنود التارجت</h3><TrackBadge percent={employee.payload.overall} expected={employee.payload.expectedPercent} /></div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{(employee.payload.kpis ?? []).map((kpi) => <KpiTile key={kpi.name} kpi={kpi} />)}</div>
                      <p className="mt-3 text-[10px] text-[var(--color-text-secondary)]" dir="ltr">Last update: {new Date(employee.updated_at).toLocaleString("en-US", { timeZone: "Africa/Cairo", hour12: false })}</p>
                    </div> : null}
                  </div>;
                })}</div>
              </section>
            ) : view === "activity" ? (
              <section className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-black tracking-[.15em] text-[var(--color-primary-700)]" dir="ltr">DAILY CHECK-IN</p><h2 className="mt-1 text-xl font-black">متابعة تسجيلات النهارده</h2><p className="mt-1 text-xs text-[var(--color-text-secondary)]" dir="ltr">{today}</p></div><span className="rounded-xl border border-[var(--color-border)] bg-white/80 px-3 py-2 text-[10px] font-bold text-[var(--color-text-secondary)]">حالة تسجيل الفريق</span></div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[{title:"سجّلوا",items:loggedToday,tone:"text-emerald-700",surface:"bg-emerald-50",dot:"bg-emerald-500"},{title:"لم يسجلوا",items:missingToday,tone:"text-red-700",surface:"bg-red-50",dot:"bg-red-500"},{title:"إجازة",items:onLeaveToday,tone:"text-[var(--color-text-secondary)]",surface:"bg-[#f7f1eb]",dot:"bg-[#b69b84]"}].map((group)=><article key={group.title} className="overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-white/90 shadow-[0_8px_24px_rgba(126,65,24,.05)]"><div className="flex items-center justify-between border-b border-[#f3e9e1] px-4 py-3"><div className="flex items-center gap-2"><span className={"h-2.5 w-2.5 rounded-full "+group.dot}/><h3 className={"text-sm font-black "+group.tone}>{group.title}</h3></div><span className={"rounded-lg px-2.5 py-1 text-sm font-black tabular-nums "+group.surface}>{group.items.length}</span></div><div className="space-y-2 p-3">{group.items.length?group.items.map((r)=><div key={r.branch_id} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--color-surface-cream)] px-3 py-2.5 text-xs"><b className="min-w-0 truncate">{r.employee_name}</b><span className="max-w-[45%] truncate text-[10px] text-[var(--color-text-secondary)]" dir="ltr">{r.branch_name||NO_BRANCH}</span></div>):<p className="py-5 text-center text-xs text-[var(--color-text-secondary)]">لا يوجد</p>}</div></article>)}
                </div>
              </section>
            ) : view === "reports" ? (
              <section className="overflow-hidden rounded-[26px] border border-[var(--color-border)] bg-white/90 shadow-[0_10px_28px_rgba(104,53,19,.055)]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-4 sm:px-5"><div><p className="text-[10px] font-black tracking-[.15em] text-[var(--color-primary-700)]" dir="ltr">BRANCH REPORTS</p><h2 className="mt-1 text-lg font-black">تقارير الفروع</h2><p className="mt-0.5 text-[10px] text-[var(--color-text-secondary)]">تحميل تقرير CSV تفصيلي لكل فرع</p></div><span className="rounded-xl bg-[var(--color-primary-50)] px-3 py-2 text-xs font-black text-[var(--color-primary-700)]">{branchGroups.length} فرع</span></div>
                {branchGroups.length?<div className="divide-y divide-[var(--color-border)]">{branchGroups.map(([name,group])=><div key={name} className="flex items-center gap-3 px-4 py-3.5 sm:px-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-50)] text-sm font-black text-[var(--color-primary-700)]">▦</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-[var(--color-text-primary)]" dir="ltr">{name}</p><p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">{group.length} موظف · تقرير تفصيلي</p></div><button type="button" onClick={()=>downloadBranchCsv(name,group)} className="shrink-0 rounded-xl border border-[#f0d4bd] bg-gradient-to-l from-[var(--color-primary-50)] to-[var(--color-surface-cream)] px-3 py-2.5 text-[11px] font-black text-[#a94b13] transition hover:border-[#e5b58e]">↓ CSV</button></div>)}</div>:<p className="py-8 text-center text-xs text-[var(--color-text-secondary)]">لا توجد بيانات لتصديرها.</p>}
              </section>
            ) : branch !== null ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3"><div><button type="button" onClick={()=>changeView("list")} className="mb-1 text-xs font-bold text-[var(--color-primary-700)]">← كل الفروع</button><h2 className="text-xl font-black" dir="ltr">{branch}</h2><p className="text-xs text-[var(--color-text-secondary)]">{branchRows.length} موظف</p></div><button type="button" onClick={()=>downloadBranchCsv(branch,branchRows)} className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--color-primary-700)]">↓ CSV</button></div>
                <article className="rounded-2xl border border-[var(--color-border)] bg-white p-3"><button type="button" onClick={()=>setBranchOpenFor(branchOpen?null:branch)} className="flex w-full items-center justify-between gap-3 text-right"><span className="text-xs font-bold text-[var(--color-text-secondary)]">إجمالي أداء الفرع</span><strong className="text-2xl text-[var(--color-primary-700)]">{Math.round(branchAvg)}%　{branchOpen?"−":"+"}</strong></button>{branchOpen?<div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-3 sm:grid-cols-3">{aggregateKpis(branchRows).map(k=><KpiTile key={k.name} kpi={k}/>)}</div>:null}<TrackBadge percent={branchAvg} expected={branchExpected}/></article>
                <h3 className="text-sm font-black">الموظفون · مرتّبون حسب الأداء</h3><div className="space-y-2">{[...branchRows].sort((a,b)=>(b.payload.overall??0)-(a.payload.overall??0)).map((row,index)=><div key={row.branch_id} className="relative"><span className="absolute right-3 top-2 z-10 rounded-md bg-[var(--color-primary-50)] px-2 py-0.5 text-[10px] font-black text-[var(--color-primary-700)]">#{index+1}</span>{renderRow(row)}</div>)}</div>
              </section>
            ) : null}

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eee5dc] pt-4"><p className="text-[10px] text-[var(--color-text-secondary)]">Track Your Sales · لوحة متابعة الأداء</p><button type="button" onClick={()=>{setPwOpen(v=>!v);setPwMsg("");}} className="text-xs font-bold text-[var(--color-primary-700)]">{pwOpen?"إخفاء تغيير كلمة السر":"🔑 تغيير كلمة السر"}</button></footer>
            {branchPreview ? (() => {
              const previewRows = branchGroups.find(([name]) => name === branchPreview)?.[1] ?? [];
              const preview = branchStatus.find((item) => item.name === branchPreview);
              const previewKpis = aggregateKpis(previewRows);
              return (
                <div className="fixed inset-0 z-[70] flex justify-end bg-[#2d211a]/35 backdrop-blur-[3px]" onClick={() => setBranchPreview(null)}>
                  <aside role="dialog" aria-modal="true" aria-label={"تفاصيل فرع " + branchPreview} onClick={(event) => event.stopPropagation()} className="h-full w-full max-w-[520px] overflow-y-auto border-r border-white/50 bg-[var(--color-surface-cream)] p-4 shadow-2xl sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="text-[10px] font-black tracking-[.15em] text-[var(--color-primary-700)]" dir="ltr">BRANCH QUICK VIEW</p><h2 className="mt-1 text-2xl font-black text-[#382719]" dir="auto">{branchPreview}</h2><p className="mt-1 text-xs text-[var(--color-text-secondary)]">ملخص أداء الفرع والموظفين</p></div>
                      <button type="button" aria-label="إغلاق التفاصيل" onClick={() => setBranchPreview(null)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white text-lg font-bold text-[var(--color-text-secondary)]">×</button>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-white p-4 ring-1 ring-[var(--color-border)]"><p className="text-[10px] font-bold text-[var(--color-text-secondary)]">إنجاز الفرع</p><strong className="mt-1 block text-3xl font-black tabular-nums text-[var(--color-primary-700)]">{Math.round(preview?.percent ?? 0)}%</strong></div>
                      <div className="rounded-2xl bg-white p-4 ring-1 ring-[var(--color-border)]"><p className="text-[10px] font-bold text-[var(--color-text-secondary)]">حالة الفرع</p><strong className={"mt-2 inline-flex rounded-full px-3 py-1.5 text-xs font-black "+(preview?.expected===undefined?"bg-stone-100 text-stone-600":preview.onTrack?"bg-emerald-50 text-emerald-700":"bg-red-50 text-red-700")}>{preview?.expected===undefined?"بيانات غير مكتملة":preview.onTrack?"على المسار":"متأخر"}</strong></div>
                    </div>
                    <div className="mt-5"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black">أداء المؤشرات</h3><span className="text-[10px] text-[var(--color-text-secondary)]">{previewKpis.length} مؤشرات</span></div><div className="grid grid-cols-2 gap-2">{previewKpis.map((k)=> <KpiTile key={k.name} kpi={k}/>)}</div></div>
                    <div className="mt-6"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black">موظفو الفرع</h3><span className="rounded-full bg-[var(--color-primary-50)] px-2.5 py-1 text-[10px] font-black text-[var(--color-primary-700)]">{previewRows.length}</span></div><div className="space-y-2">{[...previewRows].sort((a,b)=>(b.payload.overall??0)-(a.payload.overall??0)).map((row,index)=><div key={row.branch_id} className="rounded-2xl border border-[var(--color-border)] bg-white p-3"><div className="mb-2 flex items-center justify-between gap-3"><span className="text-[10px] font-black text-[var(--color-primary-700)]">#{index+1}</span><strong className="text-sm font-black text-[var(--color-text-primary)]">{Math.round(row.payload.overall??0)}%</strong></div>{renderRow(row)}</div>)}</div></div>
                    <button type="button" onClick={() => { setBranchPreview(null); changeView("b:" + branchPreview); }} className="mt-6 w-full rounded-xl bg-gradient-to-l from-[var(--color-primary-700)] to-[#e97824] px-4 py-3 text-sm font-black text-white shadow-lg shadow-orange-900/10">فتح صفحة الفرع بالكامل ←</button>
                  </aside>
                </div>
              );
            })() : null}
            {pwOpen ? <form onSubmit={changePassword} className="rounded-2xl border border-[var(--color-border)] bg-white p-4"><h3 className="mb-3 text-sm font-black">تغيير كلمة السر</h3><div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-bold">كلمة السر الحالية<input type="password" autoComplete="current-password" value={oldPw} onChange={e=>setOldPw(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm"/></label>
              <label className="text-xs font-bold">كلمة السر الجديدة<input type="password" autoComplete="new-password" value={newPw} onChange={e=>setNewPw(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm"/></label>
              <label className="text-xs font-bold">تأكيد كلمة السر<input type="password" autoComplete="new-password" value={newPw2} onChange={e=>setNewPw2(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm"/></label>
            </div>{pwMsg?<p className="mt-3 text-xs font-bold text-red-600">{pwMsg}</p>:null}<button type="submit" disabled={!oldPw||!newPw||!newPw2} className="mt-3 rounded-xl bg-[var(--color-primary-700)] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">حفظ كلمة السر</button></form>:null}
          </div>
        </div>
      )}
    </main>
  );
}
