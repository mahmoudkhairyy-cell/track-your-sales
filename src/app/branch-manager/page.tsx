"use client";

import { useCallback, useMemo, useState } from "react";
import { BRANCHES, MANAGER_FIXED_SALARY, MANAGER_FULL_COMMISSION } from "@/lib/constants";
import { managerApi } from "@/lib/cloud";
import { cairoYearMonth, monthLabelAr } from "@/lib/dates";

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
    entries?: { date: string; kpi: string; quantity: number; unit: string }[];
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
  try { return new Date(value).toLocaleString("ar-EG", { timeZone: "Africa/Cairo", dateStyle: "short", timeStyle: "short" }); }
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
        values[row.employee_name] = employeeQuality(row, override);
      }
      setQualityInputs(values);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل بيانات الفرع");
    } finally { setLoading(false); }
  }, [month]);

  const reports = data?.reports ?? [];
  const qualityMap = useMemo(() => new Map((data?.qualityOverrides ?? []).map((item) => [item.employee_name, item.quality])), [data]);
  const metrics = useMemo(() => {
    const definitions = [
      { key: "new_lines", label: "GAs / الخطوط", weight: 30 },
      { key: "points", label: "Points / النقاط", weight: 10 },
      { key: "existing_wallets", label: "Excite / المحافظ", weight: 10 },
      { key: "postpaid_lines", label: "Postpaid", weight: 10 },
      { key: "dsl", label: "Home ADSL", weight: 10 },
    ];
    const rows = definitions.map((item) => {
      const percent = aggregatePercent(reports, item.key);
      return { ...item, percent, contribution: contribution(percent, item.weight) };
    });
    const quality = reports.length
      ? reports.reduce((sum, row) => sum + qualityPercent(employeeQuality(row, qualityMap.get(row.employee_name))), 0) / reports.length
      : 0;
    rows.push({ key: "quality", label: "Quality / الجودة", weight: 15, percent: quality, contribution: contribution(quality, 15) });
    const productivity = safePercent(data?.productivity?.productivity_percent);
    const productivityContribution = contribution(productivity, 15);
    const rawTotal = rows.reduce((sum, item) => sum + item.contribution, 0) + productivityContribution;
    return { rows, quality, productivity, productivityContribution, rawTotal, total: Math.min(200, rawTotal) };
  }, [reports, qualityMap, data?.productivity]);

  async function enter(event: React.FormEvent) {
    event.preventDefault();
    if (managerName.trim().length < 2 || !branch) { setError("اكتب اسم المدير واختار الفرع"); return; }
    setActive(true);
    await load(branch);
  }
  async function saveProductivity() {
    const value = Number(productivityInput);
    if (!Number.isFinite(value) || value < 0 || value > 1000) { setError("اكتب نسبة صحيحة من 0 إلى 1000"); return; }
    setSaving("productivity"); setError(""); setNotice("");
    try {
      await managerApi("save_branch_productivity", { branch, yearMonth: month, managerName: managerName.trim(), productivityPercent: value });
      setNotice("تم حفظ الإنتاجية وتسجيل التعديل في سجل المراجعة.");
      await load(branch);
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر حفظ الإنتاجية"); }
    finally { setSaving(""); }
  }
  async function saveQuality(employee: string) {
    const quality = qualityInputs[employee] ?? EMPTY_QUALITY;
    if (QUALITY_FIELDS.some((field) => !Number.isFinite(quality[field.key]) || quality[field.key] < 0 || quality[field.key] > 100)) {
      setError("كل بند جودة لازم يكون من 0 إلى 100"); return;
    }
    setSaving(employee); setError(""); setNotice("");
    try {
      await managerApi("save_branch_quality", { branch, employeeName: employee, yearMonth: month, managerName: managerName.trim(), quality });
      setNotice(`تم حفظ جودة ${employee} وتسجيل التعديل في سجل المراجعة.`);
      await load(branch);
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر حفظ الجودة"); }
    finally { setSaving(""); }
  }

  if (!active) return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#fff0e2_0%,_#fffaf5_60%,_#fff_100%)] px-4 py-10" dir="rtl">
      <section className="mx-auto max-w-md rounded-[28px] border border-[#f1dfd0] bg-white p-6 shadow-[0_18px_55px_rgba(126,65,24,.10)]">
        <img src="/track-your-sales/logo-full.png" alt="Track Your Sales" className="mx-auto mb-5 h-20 w-auto object-contain" />
        <p className="text-center text-xs font-black text-[#bd4b0a]">لوحة مستقلة لإدارة الفرع</p>
        <h1 className="mt-2 text-center text-2xl font-black text-[#2d2119]">مدير الفرع</h1>
        <p className="mt-2 text-center text-sm leading-6 text-[#88796e]">اكتب اسمك واختار فرعك لمتابعة الفريق وتحديث الإنتاجية والجودة.</p>
        <form onSubmit={enter} className="mt-6 space-y-4">
          <label className="block text-sm font-bold text-[#514238]">اسم مدير الفرع
            <input value={managerName} onChange={(e) => setManagerName(e.target.value)} maxLength={80} className="mt-2 w-full rounded-2xl border border-[#f2e4d8] bg-[#fffdfb] px-4 py-3 outline-none focus:border-[#e96812]" placeholder="اكتب اسمك" />
          </label>
          <label className="block text-sm font-bold text-[#514238]">الفرع
            <select value={branch} onChange={(e) => setBranch(e.target.value)} className="mt-2 w-full rounded-2xl border border-[#f2e4d8] bg-[#fffdfb] px-4 py-3 outline-none focus:border-[#e96812]">
              <option value="">اختار الفرع</option>
              {BRANCHES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
          <button disabled={loading} className="w-full rounded-2xl bg-gradient-to-l from-[#bd4b0a] to-[#ff9d38] py-3 font-black text-white disabled:opacity-60">{loading ? "بيحمّل..." : "دخول لوحة الفرع"}</button>
        </form>
        <p className="mt-5 text-center text-[11px] leading-5 text-[#a18b7b]">لوحة متابعة مستقلة. مدير الفرع لا يدخل مبيعات شخصية.</p>
      </section>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#fffaf5] px-3 py-5 text-[#2d2119] sm:px-6" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-gradient-to-l from-[#bd4b0a] via-[#e96812] to-[#ff9d38] p-5 text-white shadow-lg">
          <div><p className="text-xs font-bold text-white/80">لوحة مدير الفرع</p><h1 className="mt-1 text-xl font-black">{branch}</h1><p className="mt-1 text-xs text-white/85">{managerName} · {monthLabelAr(month)}</p></div>
          <button onClick={() => load(branch)} disabled={loading} className="rounded-xl border border-white/40 bg-white/15 px-4 py-2 text-sm font-bold">{loading ? "تحديث..." : "تحديث البيانات ↻"}</button>
        </header>
        {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
        {notice ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{notice}</p> : null}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[#f1dfd0] bg-white p-4"><p className="text-xs font-bold text-[#88796e]">إجمالي حافز المدير</p><p className="mt-2 text-3xl font-black text-[#bd4b0a]">{fmt(metrics.total)}</p><p className="mt-1 text-xs text-[#88796e]">من 200% كحد أقصى</p></div>
          <div className="rounded-2xl border border-[#f1dfd0] bg-white p-4"><p className="text-xs font-bold text-[#88796e]">العمولة التقديرية</p><p className="mt-2 text-3xl font-black">{Math.round(MANAGER_FULL_COMMISSION * metrics.total / 100).toLocaleString("en-US")} ج</p><p className="mt-1 text-xs text-[#88796e]">الثابت {MANAGER_FIXED_SALARY.toLocaleString("en-US")} ج</p></div>
          <div className="rounded-2xl border border-[#f1dfd0] bg-white p-4"><p className="text-xs font-bold text-[#88796e]">إجمالي الثابت + العمولة</p><p className="mt-2 text-3xl font-black">{Math.round(MANAGER_FIXED_SALARY + MANAGER_FULL_COMMISSION * metrics.total / 100).toLocaleString("en-US")} ج</p><p className="mt-1 text-xs text-[#88796e]">السقف 30,000 ج</p></div>
          <div className="rounded-2xl border border-[#f1dfd0] bg-white p-4"><p className="text-xs font-bold text-[#88796e]">عدد أفراد الفريق</p><p className="mt-2 text-3xl font-black">{reports.length}</p><p className="mt-1 text-xs text-[#88796e]">الموظفين والتيم ليدر</p></div>
        </section>
        <section className="rounded-3xl border border-[#f1dfd0] bg-white p-4 sm:p-5">
          <h2 className="text-lg font-black">مساهمة مؤشرات حافز المدير</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {metrics.rows.map((item) => <div key={item.key} className="rounded-2xl bg-[#fff8f1] p-3"><div className="flex justify-between gap-2 text-sm font-bold"><span>{item.label}</span><span>{fmt(item.percent)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f2e4d8]"><div className="h-full rounded-full bg-[#e96812]" style={{ width: `${Math.min(100,item.percent)}%` }} /></div><p className="mt-2 text-xs text-[#88796e]">الوزن {item.weight}% · المساهمة {item.contribution.toFixed(2)}%</p></div>)}
            <div className="rounded-2xl border border-[#f2c9a7] bg-[#fff1e4] p-3"><div className="flex justify-between text-sm font-bold"><span>Productivity / الإنتاجية</span><span>{fmt(metrics.productivity)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[#bd4b0a]" style={{ width: `${Math.min(100,metrics.productivity)}%` }} /></div><p className="mt-2 text-xs text-[#88796e]">الوزن 15% · المساهمة {metrics.productivityContribution.toFixed(2)}%</p></div>
          </div>
        </section>
        <section className="rounded-3xl border border-[#f1dfd0] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-black">إدخال إنتاجية الفرع</h2><p className="text-xs text-[#88796e]">نسبة واحدة للفرع، وليست إنتاجية لكل موظف.</p></div><span className="rounded-full bg-[#fff0e2] px-3 py-1 text-xs font-black text-[#bd4b0a]">وزن 15%</span></div>
          <div className="mt-4 flex flex-wrap items-end gap-3"><label className="min-w-44 flex-1 text-sm font-bold">نسبة الإنتاجية %
            <input type="number" min="0" max="1000" step="0.01" value={productivityInput} onChange={(e) => setProductivityInput(e.target.value)} className="mt-2 w-full rounded-xl border border-[#f2e4d8] px-3 py-3" />
          </label><button onClick={saveProductivity} disabled={saving==="productivity"} className="rounded-xl bg-[#bd4b0a] px-5 py-3 font-bold text-white disabled:opacity-60">{saving==="productivity"?"بيحفظ...":"حفظ الإنتاجية"}</button></div>
          {data?.productivity ? <p className="mt-2 text-xs text-[#88796e]">آخر تحديث بواسطة {data.productivity.updated_by} · {timeLabel(data.productivity.updated_at)}</p> : null}
        </section>
        <section className="space-y-3">
          <div><h2 className="text-lg font-black">فريق الفرع بالتفصيل</h2><p className="text-xs text-[#88796e]">الأرقام ونسب التحقيق والتارجت لكل موظف، مع بنود الجودة الخمسة.</p></div>
          {loading && !data ? <p className="rounded-2xl bg-white p-6 text-center">جاري تحميل بيانات الفرع...</p> : null}
          {!loading && reports.length===0 ? <p className="rounded-2xl border border-dashed border-[#e7cdb8] bg-white p-6 text-center text-sm text-[#88796e]">مفيش تقارير متزامنة للفرع في الشهر ده لسه.</p> : null}
          {reports.map((row) => {
            const q = qualityInputs[row.employee_name] ?? employeeQuality(row, qualityMap.get(row.employee_name));
            return <article key={row.branch_id} className="rounded-3xl border border-[#f1dfd0] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-black">{row.employee_name}</h3><p className="mt-1 text-xs text-[#88796e]">{row.payload.role==="team_leader"?"Team Leader":"Employee"} · آخر مزامنة {timeLabel(row.updated_at)}</p></div><span className="rounded-full bg-[#fff0e2] px-3 py-1 text-sm font-black text-[#bd4b0a]">{fmt(row.payload.overall ?? 0)}</span></div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {(row.payload.kpis ?? []).map((k) => <div key={k.name} className="rounded-xl bg-[#fff8f1] p-2"><p className="truncate text-[10px] font-bold text-[#88796e]">{k.name}</p><p className="mt-1 text-lg font-black">{fmt(k.percent)}</p><p className="text-[10px] text-[#88796e]">{k.achieved} / {k.target}</p></div>)}
              </div>
              <div className="mt-4 rounded-2xl border border-[#f2e4d8] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="font-black">اعتماد الجودة</h4><p className="text-xs text-[#88796e]">الموظف يحتفظ بإدخاله، وهنا المدير يدخل النسب المعتمدة.</p></div><span className="text-sm font-black text-[#bd4b0a]">النتيجة {fmt(qualityPercent(q))}</span></div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {QUALITY_FIELDS.map((field) => <label key={field.key} className="text-xs font-bold text-[#6e5543]">{field.label} · {field.weight}%
                    <div className="mt-1 flex items-center gap-1"><input type="number" min="0" max="100" step="0.1" value={q[field.key]} onChange={(e) => setQualityInputs((old) => ({ ...old, [row.employee_name]: { ...(old[row.employee_name] ?? q), [field.key]: Number(e.target.value) } }))} className="w-full min-w-0 rounded-lg border border-[#f2e4d8] px-2 py-2 text-sm" /><span>%</span></div>
                  </label>)}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] text-[#9a7963]">{qualityMap.has(row.employee_name) ? `آخر اعتماد: ${data?.qualityOverrides.find((item)=>item.employee_name===row.employee_name)?.updated_by ?? "مدير الفرع"}` : "لم يعتمد المدير الجودة بعد؛ المعروض حاليًا إدخال الموظف."}</p><button onClick={() => saveQuality(row.employee_name)} disabled={saving===row.employee_name} className="rounded-xl bg-[#bd4b0a] px-4 py-2 text-xs font-black text-white disabled:opacity-60">{saving===row.employee_name?"بيحفظ...":"حفظ الجودة"}</button></div>
              </div>
            </article>;
          })}
        </section>
        <section className="rounded-3xl border border-[#f1dfd0] bg-white p-4 sm:p-5">
          <h2 className="text-lg font-black">سجل المراجعة</h2><p className="mt-1 text-xs text-[#88796e]">آخر 100 تعديل على الإنتاجية والجودة.</p>
          <div className="mt-3 space-y-2">
            {(data?.audit ?? []).length===0 ? <p className="text-sm text-[#9a7963]">لا توجد تعديلات مسجلة لهذا الشهر.</p> : data!.audit.map((item) => <div key={item.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-[#fff8f1] p-3 text-xs"><div><p className="font-black">{item.employee_name ?? "الفرع"} · {item.field_name}</p><p className="mt-1 text-[#88796e]">{String(item.old_value ?? "—")} ← {String(item.new_value)} · بواسطة {item.updated_by}</p></div><time className="text-[#9a7963]">{timeLabel(item.updated_at)}</time></div>)}
          </div>
        </section>
        <footer className="pb-6 text-center text-[11px] text-[#a18b7b]">Track Your Sales · لوحة مستقلة لمدير الفرع</footer>
      </div>
    </main>
  );
}
