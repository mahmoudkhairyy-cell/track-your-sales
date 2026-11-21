"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";

export function Spinner({ label = "بيحمّل..." }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-3 py-10 text-ink-muted-3">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-spinner border-t-transparent" />
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
    <section className="tx-empty-state rounded-hero border border-line bg-gradient-to-b from-white to-brand-50 px-5 py-10 text-center shadow-empty">
      <div aria-hidden="true" className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-card border border-light bg-brand-200 text-3xl text-brand-deep shadow-empty-inner">⌕</div>
      <p className="text-lg font-extrabold text-ink-3">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted-3">{text}</p>
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
    info: { icon: "ⓘ", style: "border-line border-r-line-accent text-info-deep", iconStyle: "bg-brand-200 text-brand-deep" },
    error: { icon: "!", style: "border-line-risk border-r-line-risk-strong text-risk-deep", iconStyle: "bg-risk-soft text-risk-light" },
    success: { icon: "✓", style: "border-line-ok border-r-line-ok-strong text-ok-deep", iconStyle: "bg-ok-soft text-ok-light" },
    warn: { icon: "⚠", style: "border-line-warn border-r-line-warn-strong text-warn-deep", iconStyle: "bg-warn-soft text-warn-light" },
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} aria-live={tone === "error" ? "assertive" : "polite"} className={`flex items-start gap-3 rounded-card border border-r-4 bg-white px-4 py-3 text-sm leading-7 shadow-banner ${config.style}`}>
      <span aria-hidden="true" className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-sm font-black ${config.iconStyle}`}>{config.icon}</span>
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
      className={`tx-btn-primary inline-flex min-h-12 w-full items-center justify-center rounded-full border border-focus/35 bg-gradient-to-l from-brand-600 via-brand-500 to-brand-300 px-4 text-base font-extrabold text-white shadow-button-primary transition duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-button-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/25 enabled:active:translate-y-0 enabled:active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-55 disabled:saturate-50 ${className}`}
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
      className={`inline-flex min-h-12 items-center justify-center rounded-full border border-line bg-white px-4 text-base font-bold text-ink-muted-deep shadow-sm transition hover:border-line-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-spinner/15 disabled:opacity-60 ${className}`}
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
      <span className="mb-2 block text-sm font-bold text-ink">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs leading-6 text-ink-2">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "min-h-12 w-full rounded-2xl border border-line bg-white px-3 text-base text-ink-deep outline-none transition placeholder:text-muted-placeholder focus:border-focus focus:bg-white focus:ring-4 focus:ring-[#e96812]/10";

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
            ? "border-line-ok border-r-line-ok-strong text-ok-deep"
            : toast.type === "error"
              ? "border-line-risk border-r-line-risk-strong text-risk-deep"
              : "border-line border-r-line-accent text-info-deep";
          const icon = toast.type === "success" ? "✓" : toast.type === "error" ? "!" : "ⓘ";
          const iconTone = toast.type === "success"
            ? "bg-ok-soft text-ok-light"
            : toast.type === "error"
              ? "bg-risk-soft text-risk-light"
              : "bg-brand-200 text-brand-deep";
          return (
            <div key={toast.id} role={toast.type === "error" ? "alert" : "status"} className={`flex items-center gap-3 rounded-card border border-r-4 bg-white px-4 py-3 text-sm font-bold shadow-toast ${tone}`}>
              <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${iconTone}`}>{icon}</span>
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusFirst = () => dialog?.querySelector<HTMLElement>(focusableSelector)?.focus();
    focusFirst();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-backdrop/35 p-2 backdrop-blur-[3px] sm:items-center sm:p-3">
      <button type="button" className="absolute inset-0" aria-label="إغلاق النافذة" onClick={onClose} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="tx-modal-title" tabIndex={-1} className="relative max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-[30px] border border-line bg-gradient-to-b from-white to-[#fffaf6] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-modal sm:rounded-[28px]">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line sm:hidden" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="tx-modal-title" className="text-lg font-extrabold text-ink-3">{title}</h2>
          <button type="button" onClick={onClose} aria-label="إغلاق النافذة" className="min-h-10 min-w-10 rounded-full text-xl text-ink-2 transition hover:bg-brand-200 hover:text-brand-deep focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-spinner/20">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}


export function Skeleton({
  className = "",
  "aria-label": ariaLabel = "جاري التحميل...",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { "aria-label"?: string }) {
  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={`skeleton-shine rounded-xl bg-skeleton dark:bg-skeleton-dark ${className}`}
      {...props}
    />
  );
}

export function AnimatedCounter({
  value,
  duration = 400,
  className = "",
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    // لو المستخدم مفعّل تقليل الحركة، اعرض القيمة مباشرة بدون أنيميشن
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionMedia.matches) {
      setDisplay(value);
      prevValue.current = value;
      return;
    }

    const start = prevValue.current;
    const end = value;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;
      setDisplay(Math.round(current));

      if (progress < 1) {
        rafId.current = requestAnimationFrame(animate);
      } else {
        prevValue.current = end;
        rafId.current = null;
      }
    };

    // إلغاء أي حركة سابقة قبل بدء حركة جديدة
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }

    rafId.current = requestAnimationFrame(animate);

    // cleanup: إلغاء الحركة عند إزالة المكوّن أو تغيير القيمة
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, [value, duration]);

  return <span className={className}>{display.toLocaleString("ar-EG")}</span>;
}

export function BulletChart({
  percent,
  expected,
  className = "",
}: {
  percent: number;
  expected: number;
  className?: string;
}) {
  const capped = Math.min(100, Math.max(0, percent));
  const expectedCapped = Math.min(100, Math.max(0, expected));

  return (
    <div className={`relative ${className}`}>
      <div
        role="progressbar"
        aria-label="نسبة إنجاز التارجت الشهري"
        aria-valuenow={Math.round(capped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${Math.round(percent)} بالمئة، والمتوقع النهارده ${Math.round(expected)} بالمئة`}
        className="h-3 w-full overflow-hidden rounded-full bg-surface-2 dark:bg-surface-2-dark"
      >
        <div
          className="h-full rounded-full bg-gradient-to-l from-brand-500 to-brand-600 transition-all duration-700 ease-out dark:from-brand-500-dark dark:to-brand-600-dark"
          style={{ width: `${capped}%` }}
        />
      </div>
      <div
        className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-ink dark:bg-ink-dark"
        style={{ left: `${expectedCapped}%` }}
        title={`المتوقع النهارده: ${Math.round(expected)}%`}
        aria-hidden="true"
      />
    </div>
  );
}