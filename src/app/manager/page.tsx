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
  };
};

export default function ManagerPage() {
  const [password, setPassword] = useState("");
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
      setError(err instanceof Error && err.message.includes("wrong password") ? "كلمة السر غلط" : "مقدرناش نجيب البيانات، جرّب تاني");
    } finally {
      setPending(false);
    }
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
              <p className="text-sm font-bold text-neutral-500">{rows.length} فرع</p>
              <button type="button" onClick={() => load()} className="rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-[#8f4300] ring-1 ring-orange-200/70">
                🔄 تحديث
              </button>
            </div>
            {rows.length === 0 ? (
              <p className="rounded-2xl bg-white p-4 text-sm font-bold text-neutral-500">مفيش فروع بعتت بيانات لحد دلوقتي.</p>
            ) : null}
            {rows.map((row) => (
              <article key={row.branch_id} className="rounded-[24px] bg-white p-4 shadow-[0_12px_32px_rgba(40,20,0,0.07)] ring-1 ring-orange-200/70">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-black">{row.employee_name}</h2>
                    <p className="text-xs text-neutral-500">{row.branch_name || "—"}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-xl font-black text-[#e06600] tabular-nums">{Math.round(row.payload.overall ?? 0)}%</p>
                    <p className="text-[10px] text-neutral-400" dir="ltr">
                      {new Date(row.updated_at).toLocaleString("en-US", { timeZone: "Africa/Cairo", hour12: false })}
                    </p>
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
              </article>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
