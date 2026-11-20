"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { BRANCHES, MANAGER_FIXED_SALARY, MANAGER_FULL_COMMISSION, MANAGER_KPI_WEIGHTS } from "@/lib/constants";
import { managerApi } from "@/lib/cloud";
import { cairoYearMonth } from "@/lib/dates";

type Kpi = { name: string; achieved: number; target: number; percent: number; weight: number };
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
  "GAs": "new_lines", "New Lines": "new_lines", "Points": "points",
  "Excite": "existing_wallets", "Exist": "existing_wallets", "Existing OC Wallets": "existing_wallets",
  "Postpaid": "postpaid_lines", "Postpaid Lines": "postpaid_lines",
  "Home ADSL": "dsl", "DSL": "dsl", "KYC & Compliance": "quality", "Quality": "quality",
};
const EMPTY_QUALITY: Quality = { kyc: 0, visits: 0, training: 0, pos: 0, csat: 0 };
const fmt = (value: number) => `${Number.isFinite(value) ? value.toFixed(1).replace(/\\.0$/, "") : "0"}%`;
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
function aggregatePercent(rows: Report[], key: string) {
  let achieved = 0, target = 0;
  for (const row of rows) {
    const k = kpiFor(row, key);
    if (!k) continue;
    achieved += Number(k.achieved) || 0;
    target += Number(k.target) || 0;
  }
  return target > 0 ? achieved / target * 100 : 0;
}
function timeLabel(value: string) {
  try { return new Date(value).toLocaleString("en-US", { timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short" }); }
  catch { return value; }
}

export default function BranchManagerPage() {
  const month = cairoYearMonth();
  const [managerName, setManagerName] = useState("");
  const [branch, setBranch] = useState("");
  const [active, setActive] = useState(false);
  const [data, setData] = useState<BranchData | null>(null);
  const [productivityInput, setProductivityInput] = useState("0");
  const [qualityInputs, setQualityInputs] = useState<Record<string, Quality>>({});
  const [saving, setSaving] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (selectedBranch: string) => {
    setLoading(true); setError("");
    try {
      const result = await managerApi<BranchData>("branch_reports", { branch: selectedBranch, yearMonth: month });
      const next = result ?? { reports: [], productivity: null, qualityOverrides: [], audit: [] };
      setData(next);
      setProductivityInput(String(next.productivity?.productivity_percent ?? 0));
      const values: Record<string, Quality> = {};
      for (const row of next.reports) {
        const override = next.qualityOverrides.find((item) => item.employee_name === row.employee_name)?.quality;
        values[row.employee_name] = override ?? { ...EMPTY_QUALITY };
      }
      setQualityInputs(values);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load branch data");
    } finally { setLoading(false); }
  }, [month]);

  const reports = data?.reports ?? [];
  const qualityMap = useMemo(() => new Map((data?.qualityOverrides ?? []).map((item) => [item.employee_name, item.quality] as const)), [data]);
  const metrics = useMemo(() => {
    const definitions = [
      { key: "new_lines", label: "GAs / GAs", weight: MANAGER_KPI_WEIGHTS.new_lines },
      { key: "points", label: "Points / Points", weight: MANAGER_KPI_WEIGHTS.points },
      { key: "existing_wallets", label: "Excite / Wallets", weight: MANAGER_KPI_WEIGHTS.existing_wallets },
      { key: "postpaid_lines", label: "Postpaid", weight: MANAGER_KPI_WEIGHTS.postpaid_lines },
      { key: "dsl", label: "Home ADSL", weight: MANAGER_KPI_WEIGHTS.dsl },
    ];
    const rows = definitions.map((item) => {
      const percent = aggregatePercent(reports, item.key);
      return { ...item, percent, contribution: contribution(percent, item.weight) };
    });
    const quality = reports.length
      ? reports.reduce((sum, row) => sum + qualityPercent(employeeQuality(row, qualityMap.get(row.employee_name))), 0) / reports.length
      : 0;
    rows.push({ key: "quality", label: "Quality / Quality", weight: MANAGER_KPI_WEIGHTS.quality, percent: quality, contribution: contribution(quality, MANAGER_KPI_WEIGHTS.quality) });
    const productivity = safePercent(data?.productivity?.productivity_percent);
    const productivityContribution = contribution(productivity, MANAGER_KPI_WEIGHTS.productivity);
    const rawTotal = rows.reduce((sum, item) => sum + item.contribution, 0) + productivityContribution;
    return { rows, quality, productivity, productivityContribution, rawTotal, total: Math.min(200, rawTotal) };
  }, [reports, qualityMap, data?.productivity]);

  async function enter(event: FormEvent) {
    event.preventDefault();
    if (managerName.trim().length < 2 || !branch) { setError("Enter your name and select your branch."); return; }
    setActive(true);
    await load(branch);
  }
  async function saveProductivity() {
    const value = Number(productivityInput);
    if (!Number.isFinite(value) || value < 0 || value > 1000) { setError("Enter a valid percentage between 0 and 1000."); return; }
    setSaving("productivity"); setError(""); setNotice("");
    try {
      await managerApi("save_branch_productivity", { branch, yearMonth: month, managerName: managerName.trim(), productivityPercent: value });
      setNotice("Productivity saved and recorded in the audit log.");
      await load(branch);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save productivity."); }
    finally { setSaving(""); }
  }
  async function saveQuality(employee: string) {
    const quality = qualityInputs[employee] ?? EMPTY_QUALITY;
    if (QUALITY_FIELDS.some((field) => !Number.isFinite(quality[field.key]) || quality[field.key] < 0 || quality[field.key] > 100)) {
      setError("Each quality field must be between 0 and 100."); return;
    }
    setSaving(employee); setError(""); setNotice("");
    try {
      await managerApi("save_branch_quality", { branch, employeeName: employee, yearMonth: month, managerName: managerName.trim(), quality });
      setNotice(`Quality data for ${employee} saved and recorded in the audit log.`);
      await load(branch);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save quality data."); }
    finally { setSaving(""); }
  }

  if (!active) return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#fff0e2_0%,_#fffaf5_60%,_#fff_100%)] px-4 py-10" dir="ltr">
      <section className="mx-auto max-w-md rounded-[28px] border border-[#f1dfd0] bg-white p-6 shadow-[0_18px_55px_rgba(126,65,24,.10)]">
        <img src="/track-your-sales/logo-full.png" alt="Track Your Sales" className="mx-auto mb-5 h-20 w-auto object-contain" />
        <p className="text-center text-xs font-black text-[#bd4b0a]">BRANCH MANAGEMENT</p>
        <h1 className="mt-2 text-center text-2xl font-black text-[#2d2119]">Branch Manager</h1>
        <p className="mt-2 text-center text-sm leading-6 text-[#88796e]">Enter your name and select your branch to review team performance and update productivity and quality.</p>
        <form onSubmit={enter} className="mt-6 space-y-4">
          <label className="block text-sm font-bold text-[#514238]">Manager Name
            <input value={managerName} onChange={(e) => setManagerName(e.target.value)} maxLength={80} className="mt-2 w-full rounded-2xl border border-[#f2e4d8] bg-[#fffdfb] px-4 py-3 outline-none focus:border-[#e96812]" placeholder="Enter your name" />
          </label>
          <label className="block text-sm font-bold text-[#514238]">Branch
            <select value={branch} onChange={(e) => setBranch(e.target.value)} className="mt-2 w-full rounded-2xl border border-[#f2e4d8] bg-[#fffdfb] px-4 py-3 outline-none focus:border-[#e96812]">
              <option value="">Select a branch</option>
              {BRANCHES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
          <button disabled={loading} className="w-full rounded-2xl bg-gradient-to-l from-[#bd4b0a] to-[#ff9d38] py-3 font-black text-white disabled:opacity-60">{loading ? "Loading..." : "Open Dashboard"}</button>
        </form>
        <p className="mt-5 text-center text-[11px] leading-5 text-[#a18b7b]">Independent dashboard. Branch managers do not enter personal sales.</p>
      </section>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#fffaf5] px-3 py-5 text-[#2d2119] sm:px-6" dir="ltr">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-gradient-to-l from-[#bd4b0a] via-[#e96812] to-[#ff9d38] p-5 text-white shadow-lg">
          <div><p className="text-xs font-bold text-white/80">Branch Manager Dashboard</p><h1 className="mt-1 text-xl font-black">{branch}</h1><p className="mt-1 text-xs text-white/85">{managerName} · {new Date(`${month}-01T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p></div>
          <button onClick={() => load(branch)} disabled={loading} className="rounded-xl border border-white/40 bg-white/15 px-4 py-2 text-sm font-bold">{loading ? "Refreshing..." : "Refresh Data ↻"}</button>
        </header>
        {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
        {notice ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{notice}</p> : null}
        <section className="relative isolate overflow-hidden rounded-[30px] border border-white bg-white p-5 shadow-[0_8px_28px_rgba(126,65,24,.10)] sm:p-7">
          <div className="pointer-events-none absolute -left-12 -top-16 h-52 w-52 rounded-full bg-[#ff9d38]/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 right-1/3 h-52 w-52 rounded-full bg-[#bd4b0a]/10 blur-3xl" />
          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-orange-100 pb-3">
              <div>
                <p className="text-xs font-black tracking-[0.16em] text-[#bd4b0a]">MONTHLY PERFORMANCE</p>
                <h2 className="mt-1 text-base font-black text-[#2d2119]">Branch Achievement</h2>
                <p className="mt-1 text-xs font-semibold text-[#88796e]">{managerName} · {new Date(`${month}-01T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
              </div>
              <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-extrabold text-[#bd4b0a]">Performance Overview</span>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4 py-5">
              <div>
                <p className="text-xs font-bold text-[#88796e]">Achievement Rate</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-mono text-[58px] font-black leading-none tracking-[-0.06em] text-[#bd4b0a] sm:text-[76px]">{fmt(metrics.total).replace("%","")}</span>
                  <span className="text-xl font-black text-[#e96812]">%</span>
                </div>
              </div>
              <div className="rounded-2xl border border-orange-100 bg-orange-50/80 px-4 py-3 shadow-sm">
                <p className="text-xs font-bold text-[#88796e]">Estimated Commission</p>
                <strong className="mt-1 block font-mono text-2xl font-black text-emerald-700">{Math.round(MANAGER_FULL_COMMISSION * metrics.total / 100).toLocaleString("en-US")} EGP</strong>
              </div>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-orange-100">
              <div className="h-full rounded-full bg-gradient-to-r from-[#bd4b0a] via-[#e96812] to-[#ff9d38] transition-all duration-700" style={{ width: `${Math.min(100, metrics.total / 2)}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[10px] font-bold text-[#88796e]" dir="ltr"><span>0%</span><span>100% achievement = full commission</span><span>200%</span></div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-[#f1dfd0] bg-white/90 p-3"><p className="text-[11px] font-bold text-[#88796e]">Base Salary</p><p className="mt-1 text-xl font-black text-[#2d2119]">{MANAGER_FIXED_SALARY.toLocaleString("en-US")} EGP</p></div>
              <div className="rounded-2xl border border-[#f1dfd0] bg-white/90 p-3"><p className="text-[11px] font-bold text-[#88796e]">Commission</p><p className="mt-1 text-xl font-black text-emerald-700">{Math.round(MANAGER_FULL_COMMISSION * metrics.total / 100).toLocaleString("en-US")} EGP</p></div>
              <div className="rounded-2xl border border-[#f1dfd0] bg-white/90 p-3"><p className="text-[11px] font-bold text-[#88796e]">Total Earnings</p><p className="mt-1 text-xl font-black text-[#bd4b0a]">{Math.round(MANAGER_FIXED_SALARY + MANAGER_FULL_COMMISSION * metrics.total / 100).toLocaleString("en-US")} EGP</p></div>
              <div className="rounded-2xl border border-[#f1dfd0] bg-white/90 p-3"><p className="text-[11px] font-bold text-[#88796e]">Team Members</p><p className="mt-1 text-xl font-black text-[#2d2119]">{reports.length}</p></div>
            </div>
          </div>
        </section>
        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#f1dfd0] bg-white p-4"><p className="text-xs font-bold text-[#88796e]">Branch Average</p><p className="mt-2 text-3xl font-black text-[#bd4b0a]">{fmt(reports.length ? reports.reduce((sum,row)=>sum+(row.payload.overall??0),0)/reports.length : 0)}</p><p className="mt-1 text-xs text-[#88796e]">Average of employees and team leaders</p></div>
          
        </section>
        <section className="rounded-3xl border border-[#f1dfd0] bg-white p-4 sm:p-5">
          <h2 className="text-lg font-black">Manager KPI Contributions</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {metrics.rows.map((item) => <div key={item.key} className="rounded-2xl bg-[#fff8f1] p-3"><div className="flex justify-between gap-2 text-sm font-bold"><span>{item.label}</span><span>{fmt(item.percent)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f2e4d8]"><div className="h-full rounded-full bg-[#e96812]" style={{ width: `${Math.min(100,item.percent)}%` }} /></div><p className="mt-2 text-xs text-[#88796e]">Weight {item.weight}% · Contribution {item.contribution.toFixed(2)}%</p></div>)}
            <div className="rounded-2xl border border-[#f2c9a7] bg-[#fff1e4] p-3"><div className="flex justify-between text-sm font-bold"><span>Productivity / Productivity</span><span>{fmt(metrics.productivity)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[#bd4b0a]" style={{ width: `${Math.min(100,metrics.productivity)}%` }} /></div><p className="mt-2 text-xs text-[#88796e]">Weight {MANAGER_KPI_WEIGHTS.productivity}% · Contribution {metrics.productivityContribution.toFixed(2)}%</p></div>
          </div>
        </section>
        <section className="rounded-3xl border border-[#f1dfd0] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-black">Branch Productivity</h2><p className="text-xs text-[#88796e]">One productivity percentage for the entire branch, not per employee.</p></div><span className="rounded-full bg-[#fff0e2] px-3 py-1 text-xs font-black text-[#bd4b0a]">15% Weight</span></div>
          <div className="mt-4 flex flex-wrap items-end gap-3"><label className="min-w-44 flex-1 text-sm font-bold">Productivity %
            <input type="number" min="0" max="1000" step="0.01" value={productivityInput} onChange={(e) => setProductivityInput(e.target.value)} className="mt-2 w-full rounded-xl border border-[#f2e4d8] px-3 py-3" />
          </label><button onClick={saveProductivity} disabled={saving==="productivity"} className="rounded-xl bg-[#bd4b0a] px-5 py-3 font-bold text-white disabled:opacity-60">{saving==="productivity"?"Saving...":"Save Productivity"}</button></div>
          {data?.productivity ? <p className="mt-2 text-xs text-[#88796e]">Last updated by {data.productivity.updated_by} · {timeLabel(data.productivity.updated_at)}</p> : null}
        </section>
        <section className="space-y-3">
          <div><h2 className="text-lg font-black">Branch Team Details</h2><p className="text-xs text-[#88796e]">Achievement, target and percentage for each team member, including all five quality fields.</p></div>
          {loading && !data ? <p className="rounded-2xl bg-white p-6 text-center">Loading branch data...</p> : null}
          {!loading && reports.length===0 ? <p className="rounded-2xl border border-dashed border-[#e7cdb8] bg-white p-6 text-center text-sm text-[#88796e]">No synchronized reports for this branch this month yet.</p> : null}
          {reports.map((row) => {
            const q = qualityInputs[row.employee_name] ?? employeeQuality(row, qualityMap.get(row.employee_name));
            return <article key={row.branch_id} className="rounded-3xl border border-[#f1dfd0] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-black">{row.employee_name}</h3><p className="mt-1 text-xs text-[#88796e]">{row.payload.role==="team_leader"?"Team Leader":"Employee"} · Last sync {timeLabel(row.updated_at)}</p></div><span className="rounded-full bg-[#fff0e2] px-3 py-1 text-sm font-black text-[#bd4b0a]">{fmt(row.payload.overall ?? 0)}</span></div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {(row.payload.kpis ?? []).map((k) => <div key={k.name} className="rounded-xl bg-[#fff8f1] p-2"><p className="truncate text-[10px] font-bold text-[#88796e]">{k.name}</p><p className="mt-1 text-lg font-black">{fmt(k.percent)}</p><p className="text-[10px] text-[#88796e]">{k.achieved} / {k.target}</p></div>)}
              </div>
              <details className="mt-3 rounded-xl border border-[#f2e4d8] bg-[#fffdfb] p-3">
                <summary className="cursor-pointer text-xs font-black text-[#8a4b20]">Daily Achievement Log ({row.payload.entries?.length ?? 0})</summary>
                <div className="mt-3 space-y-2">{(row.payload.entries ?? []).map((entry, index) => <div key={entry.at ?? `${entry.date}-${index}`} className="flex flex-wrap justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs"><span>{entry.date} · {entry.kpi}</span><b>{entry.quantity} {entry.unit}</b></div>)}</div>
              </details>
              <div className="mt-4 rounded-2xl border border-[#f2e4d8] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="font-black">Quality Approval</h4><p className="text-xs text-[#88796e]">Employees keep their own entries; manager-approved percentages are recorded here.</p></div><span className="text-sm font-black text-[#bd4b0a]">Result {fmt(qualityPercent(q))}</span></div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {QUALITY_FIELDS.map((field) => <label key={field.key} className="text-xs font-bold text-[#6e5543]">{field.label} · {field.weight}%
                    <div className="mt-1 flex items-center gap-1"><input type="number" min="0" max="100" step="0.1" value={q[field.key]} onChange={(e) => setQualityInputs((old) => ({ ...old, [row.employee_name]: { ...(old[row.employee_name] ?? q), [field.key]: Number(e.target.value) } }))} className="w-full min-w-0 rounded-lg border border-[#f2e4d8] px-2 py-2 text-sm" /><span>%</span></div>
                  </label>)}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] text-[#9a7963]">{qualityMap.has(row.employee_name) ? `Last approved by: ${data?.qualityOverrides.find((item)=>item.employee_name===row.employee_name)?.updated_by ?? "Branch Manager"}` : "Manager approval pending; employee-entered values are shown."}</p><button onClick={() => saveQuality(row.employee_name)} disabled={saving===row.employee_name} className="rounded-xl bg-[#bd4b0a] px-4 py-2 text-xs font-black text-white disabled:opacity-60">{saving===row.employee_name?"Saving...":"Save Quality"}</button></div>
              </div>
            </article>;
          })}
        </section>
        <section className="rounded-3xl border border-[#f1dfd0] bg-white p-4 sm:p-5">
          <h2 className="text-lg font-black">Audit Log</h2><p className="mt-1 text-xs text-[#88796e]">Latest 100 productivity and quality changes.</p>
          <div className="mt-3 space-y-2">
            {(data?.audit ?? []).length===0 ? <p className="text-sm text-[#9a7963]">No changes recorded this month.</p> : data!.audit.map((item) => <div key={item.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-[#fff8f1] p-3 text-xs"><div><p className="font-black">{item.employee_name ?? "Branch"} · {item.field_name}</p><p className="mt-1 text-[#88796e]">{String(item.old_value ?? "—")} ← {String(item.new_value)} · by {item.updated_by}</p></div><time className="text-[#9a7963]">{timeLabel(item.updated_at)}</time></div>)}
          </div>
        </section>
        <footer className="pb-6 text-center text-[11px] text-[#a18b7b]">Track Your Sales · Independent Branch Manager Dashboard</footer>
      </div>
    </main>
  );
}
