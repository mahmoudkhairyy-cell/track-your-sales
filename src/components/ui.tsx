"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

export function Spinner({ label = "بيحمّل..." }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-3 py-10 text-[#8c7b6e]">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#ff7900] border-t-transparent" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-dashed border-orange-200 bg-white px-5 py-10 text-center">
      <p className="text-lg font-extrabold text-neutral-900">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-neutral-500">{text}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Banner({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success" | "warn";
  children: ReactNode;
}) {
  const tones = {
    info: "bg-orange-50 text-orange-950 border-orange-100",
    error: "bg-red-50 text-red-900 border-red-200",
    success: "bg-emerald-50 text-emerald-950 border-emerald-200",
    warn: "bg-amber-50 text-amber-950 border-amber-200",
  };
  return <div role={tone === "error" ? "alert" : "status"} aria-live={tone === "error" ? "assertive" : "polite"} className={`rounded-2xl border px-4 py-3 text-sm leading-7 ${tones[tone]}`}>{children}</div>;
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-12 w-full items-center justify-center rounded-full bg-gradient-to-l from-[#bd4b0a] via-[#e96812] to-[#f58a3c] px-4 text-base font-extrabold text-white shadow-[0_9px_22px_rgba(189,75,10,0.23)] transition hover:brightness-[1.04] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e96812]/20 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-12 items-center justify-center rounded-full border border-[#ead8ca] bg-white px-4 text-base font-bold text-[#5c4030] shadow-sm transition hover:border-[#e7b990] hover:bg-[#fffaf6] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e96812]/15 disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-l from-red-700 to-red-500 px-4 text-base font-extrabold text-white shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/20 disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-neutral-800">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs leading-6 text-neutral-500">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "min-h-12 w-full rounded-2xl border border-[#ead8ca] bg-white px-3 text-base text-[#2b1c12] outline-none transition placeholder:text-[#aa998d] focus:border-[#e9782c] focus:bg-white focus:ring-4 focus:ring-[#e96812]/10";

type Toast = { id: number; type: "success" | "error" | "info"; text: string };

const ToastContext = createContext<{
  push: (type: Toast["type"], text: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((type: Toast["type"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, type, text }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);
  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" aria-relevant="additions" className="pointer-events-none fixed top-4 left-1/2 z-[70] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-2xl px-4 py-3 text-sm font-bold shadow-lg ${
              toast.type === "success"
                ? "bg-[#ff7900] text-white"
                : toast.type === "error"
                  ? "bg-red-600 text-white"
                  : "bg-neutral-900 text-white"
            }`}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("ToastProvider missing");
  return ctx;
}

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <button type="button" className="absolute inset-0" aria-label="إغلاق النافذة" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="tx-modal-title" className="relative w-full max-w-lg rounded-[28px] border border-[#f1e2d6] bg-[#fffdfb] p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="tx-modal-title" className="text-lg font-extrabold text-[#2d1d13]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="إغلاق النافذة" className="min-h-10 min-w-10 rounded-full text-xl text-neutral-500 transition hover:bg-[#fff0e4] hover:text-[#bd4b0a] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e96812]/20">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
