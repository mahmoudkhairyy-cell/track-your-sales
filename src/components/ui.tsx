"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

export function Spinner({ label = "بيحمّل..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-neutral-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#bd4b0a] border-t-transparent" />
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
    <div className="rounded-[28px] border border-dashed border-[#ff9d38] bg-white px-5 py-10 text-center">
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
    info: "bg-[#fff0e2] text-[#bd4b0a] border-[#f2e4d8]",
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
      className={`inline-flex min-h-12 w-full items-center justify-center rounded-full bg-gradient-to-br from-[#bd4b0a] to-[#e96812] px-4 text-base font-extrabold text-white shadow-[0_12px_28px_rgba(190,90,0,0.35)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_15px_32px_rgba(190,90,0,0.28)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e96812] enabled:active:translate-y-0 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
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
      className={`inline-flex min-h-12 items-center justify-center rounded-full border border-[#f0dfd2] bg-white px-4 text-base font-bold text-[#514238] shadow-[0_4px_12px_rgba(115,58,20,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[#e8b48e] hover:bg-[#fffaf5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e96812] disabled:opacity-60 ${className}`}
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
  "min-h-12 w-full rounded-2xl border border-[#f2e4d8] bg-white px-4 text-base text-[#241f1b] shadow-[0_2px_8px_rgba(115,58,20,0.025)] outline-none ring-[#bd4b0a] transition duration-150 placeholder:text-[#b5a69b] focus:border-[#e96812] focus:ring-2 focus:ring-[#e96812]/15";

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
            className={`rounded-2xl px-4 py-3 text-sm font-bold shadow-lg ${
              toast.type === "success"
                ? "bg-[#bd4b0a] text-white"
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
  const titleId = useId();
  // Escape بيقفل النافذة، زي أي نافذة على الويب.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <button className="absolute inset-0" aria-label="إغلاق" tabIndex={-1} onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-extrabold text-neutral-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="min-h-10 min-w-10 rounded-full text-xl text-neutral-500">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
