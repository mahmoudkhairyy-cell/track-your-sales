"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { logoutBranchManager, readProfile } from "@/lib/local-api";
import { BRANCHES, KPI_CATALOG, MANAGER_FULL_COMMISSION, MANAGER_KPI_WEIGHTS, displayKpiName } from "@/lib/constants";
import { managerApi } from "@/lib/cloud";
import { KpiIcon } from "@/components/KpiIcon";
import { cairoYearMonth, formatDateAr } from "@/lib/dates";

type Kpi = { name: string; achieved: number; target: number; percent: number; weight: number; expectedPercent?: number };
type Report = {
  branch_id: string;
  employee_name: string;
  branch_name: string;
  updated_at: string;
  payload: {
    role?: string;
    yearMonth?: string;
    overall?: number;
    monthLabel?: string;
    kpis?: Kpi[];
    entries?: { date: string; kpi: string; quantity: number; unit: string; at?: string }[];
    managerQuality?: { quality: Quality; updatedBy?: string; updatedAt?: string };
  };
};
type Quality = { kyc: number; visits: number; training: number; pos: number; csat: number };
type Audit = { id: number; employee_name: string | null; field_name: string; old_value: unknown; new_value: unknown; updated_by: string; updated_at: string };
type BranchData = {
  reports: Report[];
  productivity: { productivity_percent: number; updated_by: string; updated_at: string } | null;
  qualityOverrides: { employee_name: string; quality: Quality; updated_by: string; updated_at: string }[];
  audit: Audit[];
};
const QUALITY_FIELDS: { key: keyof Quality; label: string; weight: number }[] = [
  { key: "kyc", label: "KYC & Compliance", weight: 5 },
  { key: "visits", label: "Quality Visits", weight: 5 },
  { key: "training", label: "Training & Quiz", weight: 2 },
  { key: "pos", label: "POS Machines", weight: 1 },
  { key: "csat", label: "CSAT / Complaints", weight: 2 },
];
const KPI_KEYS: Record<string, string> = {
  "GAs": "new_lines", "New Lines": "new_lines", "Line": "new_lines", "Points": "points",
  "New Orange Cash Wallets": "new_orange_cash",
  "Excite": "existing_wallets", "Exist": "existing_wallets", "Existing OC Wallets": "existing_wallets",
  "Postpaid": "postpaid_lines", "Postpaid Lines": "postpaid_lines",
  "Home ADSL": "dsl", "DSL": "dsl", "KYC & Compliance": "quality", "Quality": "quality",
  "Productivity (GA & OC)": "productivity",
};
const EMPTY_QUALITY: Quality = { kyc: 0, visits: 0, training: 0, pos: 0, csat: 0 };
const fmt = (value: number) => `${Number.isFinite(value) ? value.toFixed(1).replace(/\.0$/, "") : "0"}%`;
const safePercent = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1000, value)) : 0;
function kpiFor(report: Report, key: string) {
  return (report.payload.kpis ?? []).find((item) => KPI_KEYS[item.name] === key);
}
function employeeQuality(report: Report, override?: Quality): Quality {
  if (override) return override;
  const own = kpiFor(report, "quality")?.percent ?? 0;
  return { kyc: own, visits: own, training: own, pos: own, csat: own };
}
function qualityPercent(q: Quality) {
  return QUALITY_FIELDS.reduce((sum, field) => sum + safePercent(q[field.key]) * field.weight, 0) / 15;
}
function contribution(percent: number, weight: number) {
  return percent < 90 ? 0 : percent * weight / 100;
}
function aggregateKpi(rows: Report[], key: string) {
  let achieved = 0, target = 0;
  for (const row of rows) {
    const k = kpiFor(row, key);
    if (!k) continue;
    achieved += Number(k.achieved) || 0;
    target += Number(k.target) || 0;
  }
  return { achieved, target, percent: target > 0 ? achieved / target * 100 : 0 };
}
function formatCount(value: number) {
  return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
}
function displayUnit(value: string) {
  const units: Record<string, string> = { "خط": "خط", "نقطة": "نقطة", "محفظة": "محفظة", "%": "%", "lines": "خط", "points": "نقطة", "wallets": "محفظة" };
  return units[value] ?? value;
}
function timeLabel(value: string) {
  try { return new Date(value).toLocaleString("ar-EG", { timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short" }); }
  catch { return value; }
}

export default function BranchManagerPage() {
  const month = cairoYearMonth();
  const [managerName, setManagerName] = useState("");
  const [branch, setBranch] = useState("");
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "team">("overview");
  const [teamFilter, setTeamFilter] = useState<"all" | "agent" | "team_leader">("all");
  const [data, setData] = useState<BranchData | null>(null);
  const [productivityInput, setProductivityInput] = useState("0");
  const [branchQuality, setBranchQuality] = useState<Quality>({ ...EMPTY_QUALITY });
  const [qualityOpen, setQualityOpen] = useState(false);
  const [openEmployees, setOpenEmployees] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (selectedBranch: string, pw?: string) => {
    const passwordToUse = pw ?? password;
    setLoading(true); setError("");
    try {
      const result = await managerApi<BranchData>("branch_reports", { branch: selectedBranch, yearMonth: month, password: passwordToUse });
      const next = result ?? { reports: [], productivity: null, qualityOverrides: [], audit: [] };
      setData(next);
      setProductivityInput(String(next.productivity?.productivity_percent ?? 0));
      // كواليتي الفرع نسبة واحدة لكل الفريق: ناخد أحدث اعتماد موجود ونعرضه.
      const latestOverride = [...next.qualityOverrides].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
      setBranchQuality(latestOverride ? { ...latestOverride.quality } : { ...EMPTY_QUALITY });
      try { sessionStorage.setItem("tys.bmPass", passwordToUse); } catch { /* Storage may be unavailable. */ }
    } catch (e) {
      const raw = e instanceof Error ? e.message : "تعذر تحميل بيانات الفرع";
      if (raw.includes("wrong password")) {
        try { sessionStorage.removeItem("tys.bmPass"); } catch { /* ignore */ }
        setActive(false);
        setError("كلمة السر غير صحيحة. حاول مرة أخرى.");
      } else {
        setError(raw);
      }
    } finally { setLoading(false); }
  }, [month, password]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const profile = readProfile();
      if (profile.role !== "manager") {
        window.location.replace(profile.role === "area_manager" ? "/track-your-sales/area/" : "/track-your-sales/");
        return;
      }
      if (profile.name.trim() && profile.branch.trim()) {
        setManagerName(profile.name);
        setBranch(profile.branch);
        let saved = "";
        try { saved = sessionStorage.getItem("tys.bmPass") ?? ""; } catch { /* Storage may be unavailable. */ }
        if (saved) {
          setPassword(saved);
          setActive(true);
          void load(profile.branch, saved);
        }
      }
      setAccessChecked(true);
    });
    return () => { cancelled = true; };
  }, [load]);

  const reports = data?.reports ?? [];
  const visibleReports = useMemo(() => reports.filter((row) => {
    const role = row.payload.role === "team_leader" ? "team_leader" : "agent";
    return teamFilter === "all" || role === teamFilter;
  }), [reports, teamFilter]);
  const qualityMap = useMemo(() => new Map((data?.qualityOverrides ?? []).map((item) => [item.employee_name, item.quality] as const)), [data]);
  const metrics = useMemo(() => {
    const definitions = [
      { key: "new_lines", label: "Line", weight: MANAGER_KPI_WEIGHTS.new_lines },
      { key: "points", label: "Points", weight: MANAGER_KPI_WEIGHTS.points },
      { key: "existing_wallets", label: "Excite", weight: MANAGER_KPI_WEIGHTS.existing_wallets },
      { key: "postpaid_lines", label: "Postpaid", weight: MANAGER_KPI_WEIGHTS.postpaid_lines },
      { key: "dsl", label: "Home ADSL", weight: MANAGER_KPI_WEIGHTS.dsl },
    ];
    const rows = definitions.map((item) => {
      const totals = aggregateKpi(reports, item.key);
      return { ...item, ...totals, contribution: contribution(totals.percent, item.weight) };
    });
    const quality = reports.length
      ? reports.reduce((sum, row) => sum + qualityPercent(employeeQuality(row, qualityMap.get(row.employee_name))), 0) / reports.length
      : 0;
    rows.push({ key: "quality", label: "الكواليتي", weight: MANAGER_KPI_WEIGHTS.quality, achieved: quality, target: 100, percent: quality, contribution: contribution(quality, MANAGER_KPI_WEIGHTS.quality) });
    const productivity = safePercent(data?.productivity?.productivity_percent);
    const productivityContribution = contribution(productivity, MANAGER_KPI_WEIGHTS.productivity);
    const rawTotal = rows.reduce((sum, item) => sum + item.contribution, 0) + productivityContribution;
    return { rows, quality, productivity, productivityContribution, rawTotal, total: Math.min(200, rawTotal) };
  }, [reports, qualityMap, data?.productivity]);

  function logout() {
    if (!window.confirm("تسجيل الخروج من لوحة مدير الفرع؟")) return;
    try { sessionStorage.removeItem("tys.bmPass"); } catch { /* Storage may be unavailable. */ }
    if (!logoutBranchManager()) {
      setError("تعذر تسجيل الخروج. حاول مرة أخرى.");
      return;
    }
    setActive(false);
    setManagerName("");
    setBranch("");
    setPassword("");
    setData(null);
    setError("");
    setNotice("");
  }

  async function enter(event: FormEvent) {
    event.preventDefault();
    if (managerName.trim().length < 2 || !branch) { setError("اكتب اسمك واختار الفرع."); return; }
    if (!password) { setError("اكتب كلمة سر الفرع."); return; }
    setActive(true);
    await load(branch);
  }
  async function saveProductivity() {
    const value = Number(productivityInput);
    if (!Number.isFinite(value) || value < 0 || value > 1000) { setError("اكتب نسبة صحيحة بين 0 و 1000."); return; }
    setSaving("productivity"); setError(""); setNotice("");
    try {
      await managerApi("save_branch_productivity", { branch, yearMonth: month, managerName: managerName.trim(), productivityPercent: value, password });
      setNotice("تم حفظ الإنتاجية وتسجيلها في سجل التعديلات.");
      await load(branch);
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر حفظ الإنتاجية."); }
    finally { setSaving(""); }
  }
  // الكواليتي بقت نسبة واحدة على مستوى الفرع: بنحفظ نفس القيمة لكل فرد في الفريق
  // (نفس الـ RPC الحالي، من غير أي تغيير في الباك إند) عشان تفضل التقارير والحسابات زي ما هي.
  async function saveBranchQuality() {
    const quality = branchQuality;
    if (QUALITY_FIELDS.some((field) => !Number.isFinite(quality[field.key]) || quality[field.key] < 0 || quality[field.key] > 100)) {
      setError("كل بند كواليتي لازم يكون بين 0 و 100."); return;
    }
    if (!data || data.reports.length === 0) { setError("مفيش فريق متزامن لحفظ الكواليتي."); return; }
    setSaving("quality"); setError(""); setNotice("");
    try {
      for (const row of data.reports) {
        await managerApi("save_branch_quality", { branch, employeeName: row.employee_name, yearMonth: month, managerName: managerName.trim(), quality, password });
      }
      setNotice("تم حفظ كواليتي الفرع لكل الفريق وتسجيلها في سجل التعديلات.");
      await load(branch);
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر حفظ الكواليتي."); }
    finally { setSaving(""); }
  }

  if (!accessChecked) return <main className="flex min-h-screen items-center justify-center bg-[#fffaf5] text-sm font-bold text-[#bd4b0a]">جاري تجهيز لوحة مدير الفرع...</main>;

  if (!active) return (
    <main className="tys-page tys-page-manager flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top_left,rgba(255,176,111,.13),transparent_38%),linear-gradient(145deg,#fffaf6_0%,#f8f4ef_55%,#fff8f1_100%)] px-3 py-4 sm:px-5 sm:py-6" dir="rtl">
      <section className="orn-rich-card w-full max-w-md rounded-[32px] border border-[#f1dfd0] bg-white p-7 text-center shadow-[0_18px_50px_rgba(93,54,26,.10)] sm:p-9">
          <img src="/track-your-sales/logo-full.png" alt="Track Your Sales" className="mx-auto h-24 w-auto object-contain" />
          <div className="mx-auto mt-4 h-px w-24 bg-gradient-to-r from-transparent via-[#bd4b0a] to-transparent" />
          <p className="mt-4 text-[11px] font-black tracking-[.16em] text-[#bd4b0a]">لوحة الفرع</p>
          <h1 className="mt-1 text-2xl font-black text-[#2d2119]">دخول مدير الفرع</h1>
          <p className="mt-2 text-xs leading-6 text-[#88796e]">أداء فريقك وإنتاجية فرعك في مكان واحد.</p>
          <form onSubmit={enter} className="tys-bm-signin-form mt-6 space-y-3 text-right">
            <label className="block text-sm font-bold text-[#514238]">الاسم
              <input value={managerName} onChange={(e) => setManagerName(e.target.value)} maxLength={80} className="mt-2 w-full rounded-2xl border border-[#f2e4d8] bg-[#fffdfb] px-4 py-3 text-base outline-none focus:border-[#e96812]" placeholder="اكتب اسمك" />
            </label>
            <label className="block text-sm font-bold text-[#514238]">الفرع
              <select value={branch} onChange={(e) => setBranch(e.target.value)} className="mt-2 w-full rounded-2xl border border-[#f2e4d8] bg-[#fffdfb] px-4 py-3 text-base outline-none focus:border-[#e96812]">
                <option value="">اختار الفرع</option>
                {BRANCHES.filter((item) => !item.startsWith("OB.")).map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="block text-sm font-bold text-[#514238]">كلمة السر
              <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={200} className="mt-2 w-full rounded-2xl border border-[#f2e4d8] bg-[#fffdfb] px-4 py-3 text-base outline-none focus:border-[#e96812]" placeholder="أدخل كلمة سر الفرع" />
            </label>
            {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
            <button disabled={loading} className="w-full rounded-2xl bg-gradient-to-br from-[#e96812] to-[#ff9d38] py-3 font-extrabold text-white shadow-sm disabled:opacity-50">{loading ? "جاري الدخول..." : "دخول"}</button>
          </form>
          <p className="mt-4 text-[11px] leading-5 text-[#a18b7b]">لوحة مستقلة، مدير الفرع مش بيسجل مبيعات شخصية.</p>
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#f1e8e0] pt-5 text-[10px] font-extrabold text-[#88796e]">
            <span>📊 أداء الفريق</span>
            <span>📈 إنتاجية الفرع</span>
          </div>
        </section>
    </main>
  );

  return (
    <main className="tys-page tys-page-manager min-h-screen bg-[#fffaf5] px-3 py-5 text-[#2d2119] sm:px-6" dir="ltr">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex items-end justify-between gap-3 rounded-[26px] border border-white bg-white px-4 py-4 shadow-[0_1px_2px_rgba(43,20,0,.04)] sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-black tracking-[0.16em] text-[#bd4b0a]">متابعة أداء الفرع</p>
            <h1 className="mt-1 text-xl font-black tracking-tight text-[#2d2119] sm:text-2xl">أهلًا {managerName} 👋</h1>
            <p className="mt-1 text-xs font-semibold text-[#88796e]">📍 {branch} · {new Date(`${month}-01T12:00:00`).toLocaleDateString("ar-EG", { month: "long", year: "numeric" })}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={() => load(branch)} disabled={loading} className="rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-xs font-bold text-[#bd4b0a]">{loading ? "جاري التحديث..." : "تحديث ↻"}</button>
          </div>
        </header>
        {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
        {notice ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{notice}</p> : null}
        <nav className="grid grid-cols-3 gap-2 rounded-2xl border border-[#f1dfd0] bg-white p-2 shadow-sm" aria-label="أقسام اللوحة">
          <button onClick={() => setActiveTab("overview")} className={`rounded-xl px-3 py-3 text-sm font-black transition ${activeTab === "overview" ? "bg-[#bd4b0a] text-white shadow-sm" : "text-[#88796e] hover:bg-[#fff4e9]"}`}>نظرة عامة</button>
          <button onClick={() => setActiveTab("team")} className={`rounded-xl px-3 py-3 text-sm font-black transition ${activeTab === "team" ? "bg-[#bd4b0a] text-white shadow-sm" : "text-[#88796e] hover:bg-[#fff4e9]"}`}>متابعة الفريق ({reports.length})</button>
        </nav>
        {activeTab === "overview" ? (
          <>
        <section className="orn-rich-card relative isolate overflow-hidden rounded-[30px] border border-white bg-white p-5 shadow-[0_8px_28px_rgba(126,65,24,.10)] sm:p-7">
          <div className="pointer-events-none absolute -left-12 -top-16 h-52 w-52 rounded-full bg-[#ff9d38]/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 right-1/3 h-52 w-52 rounded-full bg-[#bd4b0a]/10 blur-3xl" />
          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-orange-100 pb-3">
              <div>
                <p className="text-xs font-black tracking-[0.16em] text-[#bd4b0a]">الأداء الشهري</p>
                <h2 className="mt-1 text-base font-black text-[#2d2119]">تحقيق الفرع</h2>
                <p className="mt-1 text-xs font-semibold text-[#88796e]">{managerName} · {new Date(`${month}-01T12:00:00`).toLocaleDateString("ar-EG", { month: "long", year: "numeric" })}</p>
              </div>
              <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-extrabold text-[#bd4b0a]">نظرة عامة</span>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4 py-5">
              <div>
                <p className="text-xs font-bold text-[#88796e]">نسبة التحقيق</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-mono text-[58px] font-black leading-none tracking-[-0.06em] text-[#bd4b0a] sm:text-[76px]">{fmt(metrics.total).replace("%","")}</span>
                  <span className="text-xl font-black text-[#e96812]">%</span>
                </div>
              </div>
              <div className="rounded-2xl border border-orange-100 bg-orange-50/80 px-4 py-3 shadow-sm">
                <p className="text-xs font-bold text-[#88796e]">العمولة</p>
                <strong className="mt-1 block font-mono text-2xl font-black text-emerald-700">{Math.round(MANAGER_FULL_COMMISSION * metrics.total / 100).toLocaleString("en-US")} ج</strong>
              </div>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-orange-100">
              <div className="h-full rounded-full bg-gradient-to-r from-[#bd4b0a] via-[#e96812] to-[#ff9d38] transition-all duration-700" style={{ width: `${Math.min(100, metrics.total)}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[11px] font-bold text-[#88796e]" dir="ltr"><span>0%</span><span>100%</span></div>

          </div>
        </section>
        <section className="orn-rich-card rounded-3xl border border-[#f1dfd0] bg-white p-4 sm:p-5">
          <h2 className="text-lg font-black">مساهمة كل مؤشر</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {metrics.rows.map((item) => <div key={item.key} className="rounded-2xl bg-[#fff8f1] p-3"><div className="flex justify-between gap-2 text-sm font-bold"><span>{item.label}</span><span>{fmt(item.percent)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f2e4d8]"><div className="h-full rounded-full bg-[#e96812]" style={{ width: `${Math.min(100,item.percent)}%` }} /></div>{item.key !== "quality" ? <p className="mt-2 text-xs font-bold text-[#6e5543]">المحقق {formatCount(item.achieved)} / {formatCount(item.target)}</p> : null}<p className="mt-2 text-xs text-[#88796e]">الوزن {item.weight}% · المساهمة {item.contribution.toFixed(2)}%</p></div>)}
            <div className="rounded-2xl border border-[#f2c9a7] bg-[#fff1e4] p-3"><div className="flex justify-between text-sm font-bold"><span>الإنتاجية</span><span>{fmt(metrics.productivity)}</span></div><div className="orn-rich-card mt-2 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[#bd4b0a]" style={{ width: `${Math.min(100,metrics.productivity)}%` }} /></div><p className="mt-2 text-xs text-[#88796e]">الوزن {MANAGER_KPI_WEIGHTS.productivity}% · المساهمة {metrics.productivityContribution.toFixed(2)}%</p></div>
          </div>
        </section>
        <section className="orn-rich-card rounded-3xl border border-[#f1dfd0] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-black">إنتاجية الفرع</h2><p className="text-xs text-[#88796e]">نسبة واحدة للفرع كله، مش لكل موظف.</p></div><span className="rounded-full bg-[#fff0e2] px-3 py-1 text-xs font-black text-[#bd4b0a]">وزن 15%</span></div>
          <div className="mt-4 flex flex-wrap items-end gap-3"><label className="min-w-44 flex-1 text-sm font-bold">نسبة الإنتاجية %
            <input type="number" min="0" max="1000" step="0.01" value={productivityInput} onChange={(e) => setProductivityInput(e.target.value)} className="mt-2 w-full rounded-xl border border-[#f2e4d8] px-3 py-3" />
          </label><button onClick={saveProductivity} disabled={saving==="productivity"} className="rounded-xl bg-[#bd4b0a] px-5 py-3 font-bold text-white disabled:opacity-60">{saving==="productivity"?"جاري الحفظ...":"حفظ الإنتاجية"}</button></div>
          {data?.productivity ? <p className="mt-2 text-xs text-[#88796e]">آخر تحديث بواسطة {data.productivity.updated_by} · {timeLabel(data.productivity.updated_at)}</p> : null}
        </section>
          </>
        ) : null}
        {activeTab === "team" ? (
        <section className="space-y-3">
          <div><h2 className="text-lg font-black">متابعة الموظفين والتيم ليدر</h2><p className="text-xs text-[#88796e]">راجع تحقيق كل فرد وتارجته ونشاطه اليومي والكواليتي المعتمد من المدير.</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {([{key:"all",label:"الكل",count:reports.length},{key:"agent",label:"الموظفين",count:reports.filter((r)=>r.payload.role!=="team_leader").length},{key:"team_leader",label:"التيم ليدر",count:reports.filter((r)=>r.payload.role==="team_leader").length}] as const).map((item)=><button key={item.key} onClick={() => setTeamFilter(item.key)} className={`rounded-xl border px-2 py-2 text-xs font-black ${teamFilter===item.key?"border-[#bd4b0a] bg-[#fff0e2] text-[#bd4b0a]":"border-[#f1dfd0] bg-white text-[#88796e]"}`}>{item.label} <span className="opacity-70">({item.count})</span></button>)}
            </div></div>
          {loading && !data ? <p className="rounded-2xl bg-white p-6 text-center">جاري تحميل بيانات الفرع...</p> : null}
          {!loading && visibleReports.length===0 ? <p className="rounded-2xl border border-dashed border-[#e7cdb8] bg-white p-6 text-center text-sm text-[#88796e]">لسه مفيش تقارير متزامنة للفرع ده الشهر ده.</p> : null}
          {visibleReports.map((row) => {
            const isOpen = !!openEmployees[row.branch_id];
            return <article key={row.branch_id} className="orn-rich-card overflow-hidden rounded-3xl border border-[#f1dfd0] bg-white shadow-sm">
              <button type="button" onClick={() => setOpenEmployees((oldMap) => ({ ...oldMap, [row.branch_id]: !oldMap[row.branch_id] }))} className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-right">
                <div><h3 className="flex flex-wrap items-center gap-2 font-black">{row.employee_name}{row.payload.role==="team_leader" ? <span className="rounded-full bg-[#bd4b0a] px-2 py-0.5 text-[10px] font-black text-white">قائد فريق</span> : null}</h3><p className="mt-1 text-xs text-[#88796e]">{row.payload.role==="team_leader"?"تيم ليدر":"موظف"} · آخر مزامنة {timeLabel(row.updated_at)}</p></div>
                <span className="flex shrink-0 items-center gap-2"><span className="rounded-full bg-[#fff0e2] px-3 py-1 text-sm font-black text-[#bd4b0a]">{fmt(row.payload.overall ?? 0)}</span><span className="text-[#bd4b0a]">{isOpen ? "−" : "+"}</span></span>
              </button>
              {isOpen ? <div className="border-t border-[#f2e4d8] p-4" dir="rtl">
                <div className="orn-kpi-grid">
                  {(row.payload.kpis ?? []).map((k) => {
                    const pct = Math.min(100, Math.max(0, k.percent ?? 0));
                    const kpiKey = KPI_KEYS[k.name] ?? "";
                    const unit = KPI_CATALOG.find((item) => item.key === kpiKey)?.unitAr ?? "";
                    const expectedToDate = ((k.expectedPercent ?? 0) / 100) * (k.target ?? 0);
                    const onTrackKpi = (k.achieved ?? 0) >= expectedToDate;
                    return <article key={k.name} className={`orn-kpi orn-card ${(k.percent ?? 0) >= 100 ? "is-win" : ""}`}>
                      <span className="orn-watermark"><KpiIcon kpiKey={kpiKey}/></span>
                      <div className="orn-kpi-head"><div className="orn-kpi-identity"><span className="orn-kpi-icon"><KpiIcon kpiKey={kpiKey}/></span><span dir="ltr">{displayKpiName(k.name)}</span></div><span className={`orn-status ${onTrackKpi ? "" : "is-behind"}`}>{onTrackKpi ? "On track" : `ناقص ${formatCount(Math.max(0, Math.ceil(expectedToDate - (k.achieved ?? 0))))}`}</span></div>
                      <div className="orn-kpi-body"><div className="orn-kpi-numbers" dir="ltr"><strong>{formatCount(k.achieved ?? 0)}</strong><span>/ {formatCount(k.target ?? 0)}</span></div><div className="orn-kpi-ring"><svg viewBox="0 0 55 55" aria-hidden="true"><circle cx="27.5" cy="27.5" r="24"/><circle className="orn-ring-fill" cx="27.5" cy="27.5" r="24" pathLength={100} strokeDasharray={`${pct} 100`}/></svg><b>{Math.round(k.percent ?? 0)}%</b></div></div>
                      <div className="orn-track" role="progressbar" aria-label={k.name} aria-valuenow={Math.round(k.percent ?? 0)} aria-valuemin={0} aria-valuemax={100}><i style={{width:`${pct}%`}}/></div>
                      <p className="orn-kpi-foot">{(k.percent ?? 0) >= 100 ? <><span>✦</span> {(k.percent ?? 0) > 100 ? "عدّيت التارجت، عاش!" : "حققت التارجت، عاش!"}</> : <>المتبقي {formatCount(Math.max(0, (k.target ?? 0) - (k.achieved ?? 0)))} {unit}</>}</p>
                    </article>;
                  })}
                </div>
                <p className="mt-4 text-xs font-black text-[#8a4b20]">سجل الإنجاز اليومي ({row.payload.entries?.length ?? 0})</p>
                <div className="mt-2 space-y-2">{(row.payload.entries ?? []).length === 0 ? <p className="text-xs text-[#88796e]">لسه مفيش إنجازات مسجلة.</p> : (row.payload.entries ?? []).map((entry, index) => <div key={entry.at ?? `${entry.date}-${index}`} className="rounded-2xl border border-[#f1dfd0] bg-white p-3"><p className="flex items-center gap-1 font-extrabold"><span className="inline-flex align-middle text-[#bd4b0a]"><KpiIcon kpiKey={KPI_KEYS[entry.kpi] ?? ""} className="h-4 w-4" /></span><span dir="ltr">{displayKpiName(entry.kpi)}</span></p><p className="mt-0.5 text-xs text-[#88796e]">{formatDateAr(entry.date)} · {formatCount(entry.quantity)} {displayUnit(entry.unit)}</p></div>)}</div>
                <div className="mt-3 flex items-center justify-between rounded-xl bg-[#fff0e2] px-3 py-2"><span className="text-xs font-black text-[#8a4b20]">إجمالي التحقيق</span><span className="text-sm font-black text-[#bd4b0a]">{fmt(row.payload.overall ?? 0)}</span></div>
              </div> : null}
            </article>;
          })}
          <div className="orn-rich-card rounded-3xl border border-[#f1dfd0] bg-white shadow-sm">
            <button type="button" onClick={() => setQualityOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 p-4 text-right">
              <div><h4 className="font-black">اعتماد كواليتي الفرع</h4><p className="mt-0.5 text-xs text-[#88796e]">نسبة واحدة للفرع كله بتتطبق على كل الفريق — المدير بيملاها بنفسه.</p></div>
              <span className="flex shrink-0 items-center gap-2"><span className="text-sm font-black text-[#bd4b0a]">الناتج {fmt(qualityPercent(branchQuality))}</span><span className="text-[#bd4b0a]">{qualityOpen ? "−" : "+"}</span></span>
            </button>
            {qualityOpen ? <div className="border-t border-[#f2e4d8] p-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {QUALITY_FIELDS.map((field) => <label key={field.key} className="text-xs font-bold text-[#6e5543]">{field.label} · {field.weight}%
                  <div className="mt-1 flex items-center gap-1"><input type="number" min="0" max="100" step="0.1" value={branchQuality[field.key]} onChange={(e) => setBranchQuality((oldQ) => ({ ...oldQ, [field.key]: Number(e.target.value) }))} className="w-full min-w-0 rounded-lg border border-[#f2e4d8] px-2 py-2 text-sm" /><span>%</span></div>
                </label>)}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] text-[#9a7963]">{data && data.qualityOverrides.length > 0 ? `آخر اعتماد بواسطة: ${[...data.qualityOverrides].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]?.updated_by ?? "مدير الفرع"}` : "المدير لسه معتمدش كواليتي الفرع الشهر ده."}</p><button onClick={saveBranchQuality} disabled={saving==="quality"} className="rounded-xl bg-[#bd4b0a] px-4 py-2 text-xs font-black text-white disabled:opacity-60">{saving==="quality"?"جاري الحفظ...":"حفظ كواليتي الفرع"}</button></div>
            </div> : null}
          </div>
        </section>
        ) : null}
        {activeTab === "overview" ? (
        <section className="orn-rich-card rounded-3xl border border-[#f1dfd0] bg-white p-4 sm:p-5">
          <h2 className="text-lg font-black">سجل التعديلات</h2><p className="mt-1 text-xs text-[#88796e]">آخر 100 تعديل في الإنتاجية والكواليتي.</p>
          <div className="mt-3 space-y-2">
            {(data?.audit ?? []).length===0 ? <p className="text-sm text-[#9a7963]">لا توجد تعديلات مسجلة الشهر ده.</p> : data!.audit.map((item) => <div key={item.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-[#fff8f1] p-3 text-xs"><div><p className="font-black">{item.employee_name ?? "الفرع"} · {item.field_name}</p><p className="mt-1 text-[#88796e]">{String(item.old_value ?? "—")} ← {String(item.new_value)} · بواسطة {item.updated_by}</p></div><time className="text-[#9a7963]">{timeLabel(item.updated_at)}</time></div>)}
          </div>
        </section>
        ) : null}
        <div className="pb-8 pt-3">
          <button onClick={logout} className="mx-auto flex min-h-12 w-full max-w-sm items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-black text-red-600 shadow-sm transition hover:bg-red-50">↪ تسجيل الخروج</button>
        </div>
        <footer className="pb-6 text-center text-[11px] text-[#a18b7b]">Track Your Sales · لوحة مستقلة لمدير الفرع</footer>
      </div>
    </main>
  );
}
