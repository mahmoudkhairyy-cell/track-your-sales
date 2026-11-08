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
    <div className="flex items-center justify-center gap-3 py-10 text-neutral-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#B94700] border-t-transparent" />
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
    <div className="rounded-[28px] border border-dashed border-[#F3D2B5] bg-white/80 px-5 py-10 text-center shadow-[0_8px_24px_-16px_rgba(23,32,51,0.18)]">
      <p className="text-lg font-black text-[#172033]">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-[#556070]">{text}</p>
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
    info: "bg-[#FCEBDD] text-[#B94700] border-[#F3D2B5]",
    error: "bg-red-50 text-red-900 border-red-200",
    success: "bg-emerald-50 text-emerald-950 border-emerald-200",
    warn: "bg-amber-50 text-amber-950 border-amber-200",
  };
  return <div className={`rounded-2xl border px-4 py-3 text-sm leading-7 ${tones[tone]}`}>{children}</div>;
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-12 w-full items-center justify-center rounded-full bg-gradient-to-br from-[#D95B00] to-[#E87518] px-4 text-base font-extrabold text-white shadow-[0_14px_28px_-10px_rgba(217,91,0,0.55)] transition enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
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
      className={`inline-flex min-h-12 items-center justify-center rounded-full border border-[#E8EDF4] bg-white px-4 text-base font-bold text-[#172033] shadow-[0_6px_16px_-12px_rgba(23,32,51,0.25)] transition enabled:active:scale-[0.98] disabled:opacity-60 ${className}`}
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
      className={`inline-flex min-h-12 items-center justify-center rounded-full bg-red-600 px-4 text-base font-extrabold text-white disabled:opacity-60 ${className}`}
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
  "min-h-12 w-full rounded-2xl border border-[#F3D2B5] bg-white px-4 text-base text-neutral-900 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] outline-none ring-[#B94700] focus:border-[#E87518] focus:ring-2";

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
      <div className="pointer-events-none fixed top-4 left-1/2 z-[70] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-2xl px-4 py-3 text-sm font-bold shadow-[0_12px_30px_-10px_rgba(23,32,51,0.45)] ${
              toast.type === "success"
                ? "bg-gradient-to-br from-[#D95B00] to-[#E87518] text-white"
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
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#172033]/40 p-3 backdrop-blur-sm sm:items-center">
      <button className="absolute inset-0" aria-label="إغلاق" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-[28px] border border-[#F3D2B5]/50 bg-white p-5 shadow-[0_24px_60px_-20px_rgba(23,32,51,0.35)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-black text-[#172033]">{title}</h2>
          <button onClick={onClose} className="flex min-h-10 min-w-10 items-center justify-center rounded-full bg-[#FCEBDD] text-xl text-[#B94700]">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
