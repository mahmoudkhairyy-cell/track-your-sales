"use client";

import { FormEvent, useState } from "react";
import { cloudRpc } from "@/lib/cloud";

type ReportRow = {
  branch_id: string;
  employee_name: string;
  branch_name: string;
  updated_at: string;
  payload: {
    monthLabel?: string;
    overall?: number;
    estimatedCommission?: number;
    fullCommission?: number;
    kpis?: { name: string; achieved: number; target: number; percent: number; weight: number }[];
    settings?: { fullCommission: number; kpis: { kpiKey: string; target: number; weight: number; unitAr: string }[]; holidays: { date: string }[] };
    entries?: { date: string; kpi: string; quantity: number; unit: string; note: string }[];
  };
};

function groupByBranch(rows: ReportRow[]): [string, ReportRow[]][] {
  const map = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const key = row.branch_name || "بدون فرع";
    map.set(key, [...(map.get(key) ?? []), row]);
  }
  return [...map.entries()];
}

export default function ManagerPage() {
  const [password, setPassword] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function load(event?: FormEvent) {
    event?.preventDefault();
    setPending(true);
    setError("");
    try {
      const data = await cloudRpc<ReportRow[]>("get_all_reports", { p_password: password });
      setRows(data ?? []);
    } catch (err) {
      setRows(null);
      const raw = err instanceof Error ? err.message : "";
      setError(raw.includes("wrong password") ? "كلمة السر غلط" : `مقدرناش نجيب البيانات، جرّب تاني. (${raw.slice(0, 160)})`);
    } finally {
      setPending(false);
    }
  }

  function renderRow(row: ReportRow) {
    const open = openId === row.branch_id;
    return (
      <article key={row.branch_id} className="rounded-[24px] bg-white p-4 shadow-[0_12px_32px_rgba(40,20,0,0.07)] ring-1 ring-orange-200/70">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-black">{row.employee_name}</h3>
            <p className="text-[10px] text-neutral-400" dir="ltr">
              {new Date(row.updated_at).toLocaleString("en-US", { timeZone: "Africa/Cairo", hour12: false })}
            </p>
          </div>
          <div className="text-left">
            <p className="text-xl font-black text-[#e06600] tabular-nums">{Math.round(row.payload.overall ?? 0)}%</p>
            <p className="text-[11px] text-neutral-500 tabular-nums">كوميشن {Math.round(row.payload.estimatedCommission ?? 0)} ج</p>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {(row.payload.kpis ?? []).map((kpi) => (
            <div key={kpi.name} className="flex items-center justify-between text-xs">
              <span className="font-bold" dir="ltr">{kpi.name}</span>
              <span className="tabular-nums text-neutral-600">
                {kpi.achieved} / {kpi.target} ({Math.round(kpi.percent)}%)
              </span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setOpenId(open ? null : row.branch_id)}
          className="mt-3 w-full rounded-2xl bg-orange-50 py-2 text-xs font-extrabold text-[#8f4300]"
        >
          {open ? "إخفاء التفاصيل" : `عرض كل التفاصيل (${row.payload.entries?.length ?? 0} إنجاز)`}
        </button>
        {open ? (
          <div className="mt-3 space-y-3 text-xs">
            <div>
              <p className="mb-1 font-black">التارجت والأوزان</p>
              <p className="mb-1 text-neutral-500">الكوميشن الكامل: {row.payload.settings?.fullCommission ?? 0} جنيه</p>
              {(row.payload.settings?.kpis ?? []).map((k) => (
                <div key={k.kpiKey} className="flex justify-between">
                  <span dir="ltr">{k.kpiKey}</span>
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
                  <span dir="ltr">{e.kpi}</span>
                  <span className="tabular-nums">{e.quantity} {e.unit}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbe9da] p-4 text-neutral-900" dir="rtl">
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-black">لوحة المدير</h1>

        {rows === null ? (
          <form onSubmit={load} className="rounded-[24px] bg-white p-5 shadow-[0_12px_32px_rgba(40,20,0,0.07)] ring-1 ring-orange-200/70">
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
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-neutral-500">{rows.length} موظف</p>
              <button type="button" onClick={() => load()} className="rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-[#8f4300] ring-1 ring-orange-200/70">
                🔄 تحديث
              </button>
            </div>
            {rows.length === 0 ? (
              <p className="rounded-2xl bg-white p-4 text-sm font-bold text-neutral-500">مفيش فروع بعتت بيانات لحد دلوقتي.</p>
            ) : null}
            {groupByBranch(rows).map(([branchName, group]) => {
              const withData = group.filter((r) => typeof r.payload.overall === "number");
              const avg = withData.length ? withData.reduce((sum, r) => sum + (r.payload.overall ?? 0), 0) / withData.length : 0;
              const commission = group.reduce((sum, r) => sum + (r.payload.estimatedCommission ?? 0), 0);
              return (
                <section key={branchName} className="space-y-3">
                  <div className="flex items-center justify-between rounded-[24px] bg-[#e06600] p-4 text-white">
                    <div>
                      <p className="text-xs text-white/80">الفرع</p>
                      <h2 className="font-black" dir="ltr">{branchName}</h2>
                      <p className="text-xs text-white/85">{group.length} موظف</p>
                    </div>
                    <div className="text-left">
                      <p className="text-2xl font-black tabular-nums">{Math.round(avg)}%</p>
                      <p className="text-[11px] text-white/85 tabular-nums">كوميشن {Math.round(commission)} ج</p>
                    </div>
                  </div>
                  {group.map((row) => renderRow(row))}
                </section>
              );
            })}
          </>
        )}
      </div>
    </main>
  );
}
