"use client";

import { FormEvent, useEffect, useState } from "react";
import { managerApi } from "@/lib/cloud";
import { readProfile } from "@/lib/local-api";
import { PrimaryButton, inputClass } from "@/components/ui";

type TeamRow = {
  branch_id: string;
  employee_name: string;
  branch_name: string;
  payload: { overall?: number; role?: string };
};

export default function TeamPage() {
  const [branch, setBranch] = useState("");
  const [isOb, setIsOb] = useState(false);
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [rows, setRows] = useState<TeamRow[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const profile = readProfile();
      const ob = profile.branch.startsWith("OB.") && profile.role === "team_leader";
      setBranch(profile.branch);
      setIsOb(ob);
      if (ob) {
        // جلسة واحدة: الباسورد بتتخزن مؤقتًا عشان ميكتبهاش كل مرة يفتح الصفحة.
        let saved = "";
        try { saved = sessionStorage.getItem(`tys.tlPass.${profile.branch}`) ?? ""; } catch { /* التخزين غير متاح. */ }
        if (saved) void openWith(saved);
      }
      setChecked(true);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openWith(pw: string) {
    setBusy(true);
    setError("");
    try {
      const data = await managerApi<TeamRow[]>("team_leader_branch", { branch, password: pw });
      setRows(data ?? []);
      try { sessionStorage.setItem(`tys.tlPass.${branch}`, pw); } catch { /* التخزين غير متاح. */ }
    } catch (err) {
      setRows(null);
      try { sessionStorage.removeItem(`tys.tlPass.${branch}`); } catch { /* التخزين غير متاح. */ }
      const raw = err instanceof Error ? err.message : "";
      setError(raw.includes("wrong password") ? "الباسورد غلط. جرّب تاني." : raw || "ماقدرناش نفتح متابعة الفريق.");
    } finally {
      setBusy(false);
    }
  }

  async function open(event: FormEvent) {
    event.preventDefault();
    if (!password) return;
    await openWith(password);
  }

  function lock() {
    try { sessionStorage.removeItem(`tys.tlPass.${branch}`); } catch { /* التخزين غير متاح. */ }
    setRows(null);
    setPassword("");
    setError("");
  }

  if (!checked) {
    return <div className="tys-page mx-auto max-w-md space-y-3 pb-4" dir="rtl"><PageLoading /></div>;
  }

  // التيم ليدر الفرنشايز: مالوش باسورد، ويشوف نفسه بس — مش بيدخل هنا.
  if (!isOb) {
    return (
      <div className="tys-page mx-auto max-w-md space-y-3 pb-4" dir="rtl">
        <section className="rounded-[24px] border border-white bg-white p-5 shadow-[0_1px_2px_rgba(43,20,0,.04)]">
          <p className="text-sm font-black text-[var(--color-text-primary)]">متابعة الفريق متاحة للفروع OB بس.</p>
        </section>
      </div>
    );
  }

  if (rows === null) {
    return (
      <form onSubmit={open} className="tys-page mx-auto max-w-md space-y-4 pb-4" dir="rtl">
        <section className="rounded-[24px] border border-white bg-white p-5 shadow-[0_1px_2px_rgba(43,20,0,.04)]">
          <h1 className="text-lg font-black text-[var(--color-text-primary)]">متابعة الفريق</h1>
          <p className="mt-1 text-xs font-semibold text-[var(--color-text-secondary)]">{branch}</p>
          <label className="mt-4 block text-xs font-bold text-[var(--color-text-secondary)]">باسورد الفرع</label>
          <input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
          {error ? <p className="mt-2 text-xs font-bold text-red-600">{error}</p> : null}
          <div className="mt-4">
            <PrimaryButton type="submit" disabled={busy || !password}>{busy ? "بنتحقق..." : "افتح"}</PrimaryButton>
          </div>
        </section>
      </form>
    );
  }

  return (
    <div className="tys-page mx-auto max-w-md space-y-3 pb-4" dir="rtl">
      <section className="flex items-center justify-between gap-3 rounded-[24px] border border-white bg-white p-5 shadow-[0_1px_2px_rgba(43,20,0,.04)]">
        <div>
          <h1 className="text-lg font-black text-[var(--color-text-primary)]">متابعة الفريق</h1>
          <p className="mt-1 text-xs font-semibold text-[var(--color-text-secondary)]">{branch}</p>
        </div>
        <button type="button" onClick={lock} className="shrink-0 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-600">قفل 🔒</button>
      </section>
      {rows.length === 0 ? (
        <section className="rounded-[20px] border border-white bg-white p-4 text-sm font-bold text-[var(--color-text-secondary)]">مفيش بيانات للفريق دلوقتي.</section>
      ) : (
        rows.map((row) => (
          <section key={row.branch_id + row.employee_name} className="flex items-center justify-between gap-3 rounded-[20px] border border-white bg-white p-4 shadow-[0_1px_2px_rgba(43,20,0,.04)]">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[var(--color-text-primary)]">{row.employee_name}</p>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)]">{row.payload.role === "team_leader" ? "تيم ليدر" : "موظف"}</p>
            </div>
            <span className="shrink-0 font-mono text-base font-black text-[var(--color-primary-700)]">{Math.round(row.payload.overall ?? 0)}%</span>
          </section>
        ))
      )}
    </div>
  );
}

function PageLoading() {
  return (
    <section className="rounded-[24px] border border-white bg-white p-5 text-center text-xs font-bold text-[var(--color-text-secondary)] shadow-[0_1px_2px_rgba(43,20,0,.04)]">
      ثواني…
    </section>
  );
}
