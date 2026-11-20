"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Report = {
  branch_id: string;
  employee_name: string;
  branch_name: string;
  payload: {
    overall?: number;
    monthLabel?: string;
    syncedAt?: string;
    kpis?: Array<{ name: string; achieved: number; target: number; percent: number; weight: number }>;
    entries?: Array<{ date: string; kpi: string; quantity: number; unit: string; note?: string }>;
  };
  updated_at: string;
};

const API = "https://fjhjqrgolqqtaokrlezd.supabase.co/functions/v1/manager-api";
const PUBLIC_KEY = "sb_publishable_6cLV7KQHG3RNeAenIUcKFg_qpWHumZq";

async function managerRequest(action: string, password: string, extra: Record<string, unknown> = {}) {
  const response = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: PUBLIC_KEY },
    body: JSON.stringify({ action, password, ...extra }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) throw new Error("كلمة المرور غير صحيحة");
    throw new Error(typeof result.error === "string" ? result.error : "تعذر الاتصال بالخادم");
  }
  return result;
}

function percent(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(1)}%` : "—";
}

export default function ManagerPage() {
  const [password, setPassword] = useState("");
  const [managerName, setManagerName] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const loadReports = useCallback(async (secret: string) => {
    setLoading(true);
    setError("");
    try {
      const [name, data] = await Promise.all([
        managerRequest("manager_name", secret),
        managerRequest("reports", secret),
      ]);
      setManagerName(typeof name === "string" ? name : "مدير المنطقة");
      setReports(Array.isArray(data) ? data as Report[] : []);
      setPassword(secret);
      setLoggedIn(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل التقارير");
      setLoggedIn(false);
      } finally {
      setLoading(false);
    }
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    await loadReports(password);
  }

  async function refresh() {
    await loadReports(password);
  }

  async function deleteReport(report: Report) {
    if (!window.confirm(`متأكد إنك عايز تحذف تقرير ${report.employee_name}؟`)) return;
    setLoading(true);
    try {
      await managerRequest("delete", password, { branchId: report.branch_id });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حذف التقرير");
    } finally { setLoading(false); }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword.length < 8) { setError("كلمة المرور الجديدة لازم تكون 8 أحرف على الأقل"); return; }
    setChangingPassword(true);
    try {
      await managerRequest("change_password", password, { newPassword });
      setPassword(newPassword);
      setNewPassword("");
      setError("");
      await loadReports(newPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تغيير كلمة المرور");
    } finally { setChangingPassword(false); }
  }

  function logout() {
    sessionStorage.removeItem("tys.manager.session");
    setPassword("");
    setManagerName("");
    setReports([]);
    setLoggedIn(false);
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#fff8f1] px-4 py-6 text-neutral-900 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between gap-3 rounded-3xl bg-gradient-to-l from-[#c6530b] via-[#f07818] to-[#ff9a45] p-5 text-white shadow-lg">
          <div>
            <p className="text-xs font-bold text-white/80">TRACK YOUR SALES</p>
            <h1 className="mt-1 text-2xl font-black">لوحة مدير المنطقة</h1>
            <p className="mt-1 text-sm text-white/85">متابعة تقارير الموظفين</p>
          </div>
          {loggedIn && <button onClick={logout} className="rounded-xl border border-white/40 px-3 py-2 text-sm font-bold">خروج</button>}
        </header>

        {!loggedIn ? (
          <form onSubmit={login} className="mx-auto max-w-md rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">دخول المدير</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500">اكتب كلمة مرور مدير المنطقة لعرض تقارير الموظفين.</p>
            <label className="mt-5 block text-sm font-bold" htmlFor="manager-password">كلمة المرور</label>
            <input id="manager-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-neutral-200 px-3 outline-none focus:border-orange-500" required />
            <button disabled={loading} className="mt-4 min-h-12 w-full rounded-xl bg-[#e86d12] font-black text-white disabled:opacity-60">{loading ? "جاري التحقق…" : "دخول"}</button>
          </form>
        ) : (
          <>
            <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-orange-100 bg-white p-4"><p className="text-xs text-neutral-500">المدير</p><p className="mt-1 font-black">{managerName}</p></div>
              <div className="rounded-2xl border border-orange-100 bg-white p-4"><p className="text-xs text-neutral-500">عدد التقارير</p><p className="mt-1 text-2xl font-black">{reports.length}</p></div>
              <button onClick={refresh} disabled={loading} className="rounded-2xl border border-orange-200 bg-white p-4 text-sm font-black text-orange-700 disabled:opacity-60">{loading ? "جاري التحديث…" : "↻ تحديث التقارير"}</button>
            </section>

            {reports.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-orange-200 bg-white p-8 text-center text-neutral-500">لسه مفيش تقارير مسجلة للمدير ده.</div>
            ) : (
              <section className="space-y-3">
                {reports.map((report) => (
                  <article key={report.branch_id} className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
                    <button onClick={() => setExpanded(expanded === report.branch_id ? null : report.branch_id)} className="flex w-full items-center justify-between gap-3 p-4 text-right">
                      <div className="min-w-0">
                        <p className="truncate font-black">{report.employee_name}</p>
                        <p className="mt-1 truncate text-xs text-neutral-500">{report.branch_name} · {report.payload?.monthLabel ?? ""}</p>
                      </div>
                      <div className="shrink-0 text-left">
                        <p className="text-xl font-black text-orange-700">{percent(report.payload?.overall)}</p>
                        <p className="text-[10px] text-neutral-400">آخر تحديث {new Date(report.updated_at).toLocaleString("ar-EG")}</p>
                      </div>
                    </button>
                    {expanded === report.branch_id && (
                      <div className="border-t border-orange-100 p-4">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {(report.payload?.kpis ?? []).map((kpi) => (
                            <div key={kpi.name} className="rounded-xl bg-orange-50/70 p-3">
                              <p className="text-xs font-bold text-neutral-600">{kpi.name}</p>
                              <p className="mt-1 font-black">{kpi.achieved} <span className="text-xs font-normal text-neutral-500">/ {kpi.target}</span></p>
                              <p className="mt-1 text-xs font-bold text-orange-700">{percent(kpi.percent)}</p>
                            </div>
                          ))}
                        </div>
                        <h3 className="mt-5 font-black">آخر العمليات</h3>
                        <div className="mt-2 max-h-64 space-y-2 overflow-auto">
                          {(report.payload?.entries ?? []).slice(0, 20).map((entry, index) => (
                            <div key={`${entry.date}-${entry.kpi}-${index}`} className="flex items-center justify-between gap-2 rounded-xl bg-neutral-50 px-3 py-2 text-sm">
                              <span>{entry.kpi} · {entry.date}</span><strong>{entry.quantity} {entry.unit}</strong>
                            </div>
                          ))}
                        </div>
                        <button onClick={() => void deleteReport(report)} className="mt-4 rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-600">حذف التقرير</button>
                      </div>
                    )}
                  </article>
                ))}
              </section>
            )}

            <form onSubmit={changePassword} className="mt-7 rounded-2xl border border-orange-100 bg-white p-4">
              <h2 className="font-black">تغيير كلمة المرور</h2>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input type="password" minLength={8} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="كلمة المرور الجديدة (8 أحرف على الأقل)" className="min-h-11 flex-1 rounded-xl border border-neutral-200 px-3" />
                <button disabled={changingPassword || !newPassword} className="min-h-11 rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white disabled:opacity-50">{changingPassword ? "جاري التغيير…" : "تغيير كلمة المرور"}</button>
              </div>
            </form>
          </>
        )}
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
        <footer className="mt-8 text-center text-xs text-neutral-400">أداة مستقلة لمتابعة المبيعات — ليست منتجًا رسميًا أو معتمدًا من Orange.</footer>
      </div>
    </main>
  );
}
