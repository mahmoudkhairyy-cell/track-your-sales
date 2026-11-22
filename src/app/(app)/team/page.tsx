"use client";

import { FormEvent, useState } from "react";
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
  const profile = readProfile();
  const branch = profile.branch;
  const isOb = branch.startsWith("OB.") && profile.role === "team_leader";
  const [password, setPassword] = useState("");
  const [rows, setRows] = useState<TeamRow[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  async function open(event: FormEvent) {
    event.preventDefault();
    if (!password) return;
    setBusy(true);
    setError("");
    try {
      const data = await managerApi<TeamRow[]>("team_leader_branch", { branch, password });
      setRows(data ?? []);
    } catch (err) {
      setRows(null);
      setError(err instanceof Error ? err.message : "ماقدرناش نفتح متابعة الفريق.");
    } finally {
      setBusy(false);
    }
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
      <section className="rounded-[24px] border border-white bg-white p-5 shadow-[0_1px_2px_rgba(43,20,0,.04)]">
        <h1 className="text-lg font-black text-[var(--color-text-primary)]">متابعة الفريق</h1>
        <p className="mt-1 text-xs font-semibold text-[var(--color-text-secondary)]">{branch}</p>
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
