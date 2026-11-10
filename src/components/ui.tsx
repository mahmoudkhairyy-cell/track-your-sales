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
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#e96812] border-t-transparent" />
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
    <section className="tx-empty-state rounded-[30px] border border-[#f1e2d6] bg-gradient-to-b from-white to-[#fff8f1] px-5 py-10 text-center shadow-[0_12px_30px_rgba(105,54,20,.045)]">
      <div aria-hidden="true" className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] border border-[#f7dfcc] bg-[#fff0e4] text-3xl text-[#bd4b0a] shadow-[0_8px_20px_rgba(189,75,10,.08)]">⌕</div>
      <p className="text-lg font-extrabold text-[#2d1d13]">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-[#8c7b6e]">{text}</p>
      {action ? <div className="mx-auto mt-5 w-full max-w-xs">{action}</div> : null}
    </section>
  );
}

export function Banner({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success" | "warn";
  children: ReactNode;
}) {
  const config = {
    info: { icon: "ⓘ", style: "border-[#f0d5bf] bg-[#fff8f1] text-[#75401f]" },
    error: { icon: "!", style: "border-[#f0c9c3] bg-[#fff5f3] text-[#913b31]" },
    success: { icon: "✓", style: "border-[#cfe5d7] bg-[#f4fbf6] text-[#286345]" },
    warn: { icon: "⚠", style: "border-[#f0dfb8] bg-[#fffaf0] text-[#78551c]" },
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} aria-live={tone === "error" ? "assertive" : "polite"} className={`flex items-start gap-3 rounded-[20px] border px-4 py-3 text-sm leading-7 shadow-[0_5px_16px_rgba(105,54,20,.035)] ${config.style}`}>
      <span aria-hidden="true" className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/80 text-sm font-black shadow-sm">{config.icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
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
      <div aria-live="polite" aria-relevant="additions" className="pointer-events-none fixed left-1/2 top-4 z-[70] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
        {toasts.map((toast) => {
          const tone = toast.type === "success"
            ? "border-[#cfe5d7] text-[#286345]"
            : toast.type === "error"
              ? "border-[#f0c9c3] text-[#913b31]"
              : "border-[#f0d5bf] text-[#75401f]";
          const icon = toast.type === "success" ? "✓" : toast.type === "error" ? "!" : "ⓘ";
          return (
            <div key={toast.id} role={toast.type === "error" ? "alert" : "status"} className={`flex items-center gap-3 rounded-[20px] border bg-white/95 px-4 py-3 text-sm font-bold shadow-[0_14px_38px_rgba(75,42,20,.14)] backdrop-blur-xl ${tone}`}>
              <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fff0e4] text-[#bd4b0a]">{icon}</span>
              <span className="min-w-0 flex-1">{toast.text}</span>
            </div>
          );
        })}
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
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#24180f]/35 p-2 backdrop-blur-[3px] sm:items-center sm:p-3">
      <button type="button" className="absolute inset-0" aria-label="إغلاق النافذة" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="tx-modal-title" className="relative max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-[30px] border border-[#f1e2d6] bg-gradient-to-b from-white to-[#fffaf6] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_24px_70px_rgba(48,27,13,.22)] sm:rounded-[28px]">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#ead8ca] sm:hidden" />
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
