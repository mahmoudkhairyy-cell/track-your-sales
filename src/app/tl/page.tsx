"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BRANCHES, displayKpiName } from "@/lib/constants";
import { managerApi } from "@/lib/cloud";

type TeamRow = {
  branch_id: string;
  employee_name: string;
  updated_at: string;
  payload: {
    role?: string;
    overall?: number;
    kpis?: { name: string; achieved: number; target: number; percent: number }[];
  };
};

const fmt = (value: number) => `${Number.isFinite(value) ? value.toFixed(1).replace(/\.0$/, "") : "0"}%`;

export default function TeamLeaderPage() {
  const [branch, setBranch] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<TeamRow[] | null>(null);
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  async function load(saved?: { branch: string; password: string }) {
    const br = saved?.branch ?? branch;
    const pw = saved?.password ?? password;
    if (!br) { setError("اختار الفرع."); return; }
    if (!pw) { setError("اكتب كلمة السر."); return; }
    setPending(true);
    setError("");
    try {
      const data = await managerApi<TeamRow[]>("team_leader_branch", { branch: br, password: pw });
      try {
        sessionStorage.setItem("tys.tlPass", pw);
        sessionStorage.setItem("tys.tlBranch", br);
      } catch { /* التخزين اختياري. */ }
      setBranch(br);
      setRows(data ?? []);
      setLastLoaded(new Date());
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      if (raw.includes("wrong password")) {
        setRows(null);
        try { sessionStorage.removeItem("tys.tlPass"); } catch { /* ignore */ }
        setError("كلمة السر غير صحيحة. حاول مرة أخرى.");
      } else {
        setError("تعذر تحميل بيانات الفريق. تحقق من الاتصال وحاول مرة أخرى.");
      }
    } finally {
      setPending(false);
      setAuthChecking(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void load();
  }

  function logout() {
    if (!window.confirm("تسجيل الخروج من لوحة التيم ليدر؟")) return;
    try {
      sessionStorage.removeItem("tys.tlPass");
      sessionStorage.removeItem("tys.tlBranch");
    } catch { /* ignore */ }
    setRows(null);
    setPassword("");
  }

  useEffect(() => {
    let savedBranch = "";
    let savedPassword = "";
    try {
      savedBranch = sessionStorage.getItem("tys.tlBranch") ?? "";
      savedPassword = sessionStorage.getItem("tys.tlPass") ?? "";
    } catch { /* التخزين غير متاح. */ }
    // نأجل تحديث الحالة خطوة واحدة عشان منعملش setState متزامن جوه الـeffect.
    queueMicrotask(() => {
      if (savedBranch && savedPassword) {
        setBranch(savedBranch);
        setPassword(savedPassword);
        void load({ branch: savedBranch, password: savedPassword });
      } else {
        setAuthChecking(false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ordered = rows === null ? [] : [...rows].sort((a, b) => {
    const ra = a.payload.role === "team_leader" ? 1 : 0;
    const rb = b.payload.role === "team_leader" ? 1 : 0;
    if (ra !== rb) return rb - ra;
    return (b.payload.overall ?? 0) - (a.payload.overall ?? 0);
  });

  if (authChecking) {
    return (
      <main className="tys-page flex min-h-screen items-center justify-center bg-[linear-gradient(145deg,#fffaf6_0%,#f8f4ef_55%,#fff8f1_100%)]" dir="rtl">
        <p className="text-sm font-bold text-[var(--color-text-secondary)]">جاري تجهيز لوحة التيم ليدر...</p>
      </main>
    );
  }

  if (rows === null) {
    return (
      <main className="tys-page min-h-screen bg-[radial-gradient(ellipse_at_top_left,rgba(255,176,111,.13),transparent_38%),linear-gradient(145deg,#fffaf6_0%,#f8f4ef_55%,#fff8f1_100%)] px-3 py-4 sm:px-5 sm:py-6" dir="ltr">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-md items-center justify-center sm:min-h-[calc(100vh-3rem)]" dir="rtl">
        <section className="orn-rich-card w-full rounded-[32px] border border-[var(--color-border)] bg-white p-7 text-center shadow-[0_18px_50px_rgba(93,54,26,.10)] sm:p-9">
          <img src="/track-your-sales/logo-full.png" alt="Track Your Sales" className="mx-auto h-24 w-auto object-contain" />
          <div className="mx-auto mt-4 h-px w-24 bg-gradient-to-r from-transparent via-[#bd4b0a] to-transparent" />
          <p className="mt-4 text-[11px] font-black tracking-[.16em] text-[var(--color-primary-700)]">لوحة التيم ليدر</p>
          <h1 className="mt-1 text-2xl font-black">دخول التيم ليدر</h1>
          <p className="mt-2 text-xs leading-6 text-[var(--color-text-secondary)]">تابع تحقيق فريقك فرعك أول بأول.</p>
          <form onSubmit={submit} className="mt-6 space-y-3 text-right">
            <label className="block text-sm font-bold">الفرع
              <select value={branch} onChange={(e) => setBranch(e.target.value)} className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-cream)] px-4 py-3 text-base outline-none focus:border-[#d9651b]">
                <option value="">اختار الفرع</option>
                {BRANCHES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="block text-sm font-bold">كلمة السر
              <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="أدخل كلمة سر الفرع" className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-cream)] px-4 py-3 text-base outline-none focus:border-[#d9651b]" />
            </label>
            {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
            <button type="submit" disabled={pending} className="w-full rounded-2xl bg-gradient-to-br from-[#e96812] to-[#ff9d38] py-3 font-extrabold text-white shadow-sm disabled:opacity-50">{pending ? "جاري الدخول..." : "دخول"}</button>
          </form>
          <div className="mt-6 grid grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-5 text-[10px] font-extrabold text-[var(--color-text-secondary)]">
            <span>👥 متابعة الفريق</span>
            <span>📈 تحقيق الفرع</span>
          </div>
        </section>
        </div>
      </main>
    );
  }

  return (
    <main className="tys-page min-h-screen bg-[linear-gradient(145deg,#fffaf6_0%,#f8f4ef_55%,#fff8f1_100%)] px-3 py-4 text-[var(--color-text-primary)] sm:px-5" dir="rtl">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="orn-rich-card rounded-[26px] border border-[var(--color-border)] bg-white px-4 py-4 shadow-sm sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <span className="orn-avatar" aria-hidden="true">{(branch || "T").trim().charAt(0).toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black tracking-[.15em] text-[var(--color-primary-700)]">لوحة التيم ليدر</p>
              <h1 className="mt-1 truncate text-xl font-black" dir="auto">{branch}</h1>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{rows.length} في الفريق{lastLoaded ? ` · آخر تحديث ${lastLoaded.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}` : ""}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <button type="button" onClick={() => void load()} disabled={pending} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-cream)] px-3 py-2 text-xs font-bold text-[var(--color-primary-700)]">{pending ? "جاري التحديث..." : "تحديث ↻"}</button>
              <button type="button" onClick={logout} className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600">خروج ↪</button>
            </div>
          </div>
        </header>

        {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}

        <a href="/track-your-sales/home/" className="orn-rich-card flex items-center justify-between gap-3 rounded-[26px] border border-[var(--color-border)] bg-white px-4 py-4 shadow-sm transition hover:border-[#e5b58e]">
          <div>
            <p className="text-sm font-black text-[var(--color-text-primary)]">سجّل إنجازك بنفسك</p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">تسجيل إنجازاتك الشخصية بيتم من تطبيق الموظف، بنفس أوزانه.</p>
          </div>
          <span className="shrink-0 rounded-xl bg-gradient-to-br from-[#e96812] to-[#ff9d38] px-4 py-2.5 text-xs font-black text-white">افتح تطبيق الموظف ←</span>
        </a>

        <section className="space-y-3">
          <h2 className="text-lg font-black">الفريق</h2>
          {ordered.length === 0 ? <p className="orn-rich-card rounded-2xl border border-dashed border-[#e8d5c5] bg-white p-8 text-center text-xs text-[var(--color-text-secondary)]">لا توجد تقارير متزامنة للفرع ده بعد.</p> : null}
          {ordered.map((row) => (
            <article key={row.branch_id} className="orn-rich-card rounded-[26px] border border-[var(--color-border)] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-black">{row.employee_name}</h3>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{row.payload.role === "team_leader" ? "تيم ليدر" : "موظف"} · آخر مزامنة {new Date(row.updated_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--color-primary-50)] px-3 py-1.5 text-sm font-black text-[var(--color-primary-700)]">{fmt(row.payload.overall ?? 0)}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(row.payload.kpis ?? []).map((k) => (
                  <div key={k.name} className="rounded-xl bg-[var(--color-surface-cream)] p-2">
                    <p className="truncate text-[11px] font-bold text-[var(--color-text-secondary)]">{displayKpiName(k.name)}</p>
                    <p className="mt-1 text-base font-black">{fmt(k.percent)}</p>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">{k.achieved} / {k.target}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>

        <footer className="pb-6 pt-2 text-center text-[11px] text-[var(--color-text-secondary)]">تراك يور سيلز · لوحة التيم ليدر</footer>
      </div>
    </main>
  );
}
