"use client";

import { FormEvent, useState } from "react";
import { useHistoryView } from "@/lib/use-history-view";
import { cloudRpc } from "@/lib/cloud";

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

/** On track = النسبة المحققة أكبر من أو تساوي المطلوب لحد النهارده (بهامش 5%). */
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
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${branchName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type AggKpi = { name: string; achieved: number; target: number; percent: number; weight: number; expectedPercent?: number };

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
    const key = row.branch_name || "بدون فرع";
    map.set(key, [...(map.get(key) ?? []), row]);
  }
  return [...map.entries()];
}

export default function ManagerPage() {
  const [password, setPassword] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  // "list" = قايمة الفروع، و"branch:<اسم>" = صفحة فرع. الرجوع بيتسجل في تاريخ المتصفح.
  const [view, setView] = useHistoryView<string>("list");
  const branch = view.startsWith("branch:") ? view.slice("branch:".length) : null;
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
              {(row.payload.kpis ?? []).map((kpi) => {
                const ok = kpi.percent >= (kpi.expectedPercent ?? 0) - 10;
                const neutral = kpi.weight === 0;
                const tone = neutral
                  ? { text: "text-neutral-500", bar: "from-neutral-300 to-neutral-400", ring: "ring-neutral-200" }
                  : ok
                    ? { text: "text-emerald-700", bar: "from-emerald-400 to-emerald-600", ring: "ring-emerald-200" }
                    : { text: "text-red-600", bar: "from-red-400 to-red-600", ring: "ring-red-200" };
                const width = Math.min(100, Math.max(0, kpi.percent));
                return (
                  <div
                    key={kpi.name}
                    className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-orange-50/60 p-3 shadow-[0_6px_18px_rgba(40,20,0,0.06)] ring-1 ${tone.ring}`}
                  >
                    <p className="truncate text-[10px] font-extrabold text-neutral-500" dir="ltr">{kpi.name}</p>
                    <p className={`mt-1 text-2xl font-black tabular-nums tracking-tight ${tone.text}`}>
                      {Math.round(kpi.percent)}<span className="text-sm">%</span>
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80">
                      <div className={`h-full rounded-full bg-gradient-to-r ${tone.bar}`} style={{ width: `${width}%` }} />
                    </div>
                    <p className="mt-1.5 text-[10px] tabular-nums text-neutral-500" dir="ltr">
                      {kpi.achieved} / {kpi.target}
                    </p>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setDetailsId(detailsId === row.branch_id ? null : row.branch_id)}
              className="mt-3 w-full rounded-2xl bg-orange-50 py-2 text-xs font-extrabold text-[#8f4300]"
            >
              {detailsId === row.branch_id ? "إخفاء التفاصيل" : `عرض كل التفاصيل (${row.payload.entries?.length ?? 0} إنجاز)`}
            </button>
            {detailsId === row.branch_id ? (
              <div className="mt-3 space-y-3 text-xs">
                <div>
                  <p className="mb-1 font-black">التارجت والأوزان</p>
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
          </>
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
            {branch === null ? (
              <div className="space-y-3">
                {groupByBranch(rows)
                  .sort((a, b) => groupAverage(b[1]) - groupAverage(a[1]))
                  .map(([branchName, group]) => {
                  const withData = group.filter((r) => typeof r.payload.overall === "number");
                  const avg = withData.length ? withData.reduce((sum, r) => sum + (r.payload.overall ?? 0), 0) / withData.length : 0;
                  return (
                    <button
                      key={branchName}
                      type="button"
                      onClick={() => setView(`branch:${branchName}`)}
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
                <button type="button" onClick={() => { setView("list"); setOpenId(null); }} className="text-sm font-extrabold text-[#e06600]">← كل الفروع</button>
                <div className="rounded-[24px] bg-[#e06600] p-4 text-white">
                  <p className="text-xs text-white/80">الفرع</p>
                  <h2 className="font-black" dir="ltr">{branch}</h2>
                  <button
                    type="button"
                    onClick={() => downloadBranchCsv(branch, rows.filter((r) => (r.branch_name || "بدون فرع") === branch))}
                    className="mt-3 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-[#8f4300]"
                  >
                    📥 تحميل الفرع (Excel)
                  </button>
                  <div className="mt-2">
                    <TrackBadge
                      percent={groupAverage(rows.filter((r) => (r.branch_name || "بدون فرع") === branch))}
                      expected={groupExpected(rows.filter((r) => (r.branch_name || "بدون فرع") === branch))}
                    />
                  </div>
                </div>
                <section className="rounded-[24px] bg-white p-4 shadow-[0_12px_32px_rgba(40,20,0,0.07)] ring-1 ring-orange-200/70">
                  <p className="mb-3 text-sm font-black">إجمالي الفرع لكل مؤشر</p>
                  <div className="grid grid-cols-2 gap-2">
                    {aggregateKpis(rows.filter((r) => (r.branch_name || "بدون فرع") === branch)).map((kpi) => (
                      <KpiTile key={kpi.name} kpi={kpi} />
                    ))}
                  </div>
                </section>
                {groupByBranch(rows)
                  .filter(([name]) => name === branch)
                  .flatMap(([, group]) =>
                    [...group]
                      .sort((a, b) => (b.payload.overall ?? 0) - (a.payload.overall ?? 0))
                      .map((row, index) => (
                        <div key={row.branch_id} className="relative">
                          <span className="absolute -top-2 right-4 z-10 rounded-full bg-[#8f4300] px-2.5 py-0.5 text-[11px] font-black text-white">
                            المركز {index + 1}
                          </span>
                          {renderRow(row)}
                        </div>
                      )),
                  )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
