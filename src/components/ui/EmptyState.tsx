"use client";

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
};

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <section
      className="orn-rich-card mx-auto flex min-h-[48vh] w-full max-w-lg flex-col items-center justify-center rounded-3xl border border-orange-100 bg-white px-6 py-10 text-center shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
      dir="rtl"
      role="status"
    >
      <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-orange-50 text-orange-300 dark:bg-orange-950/40">
        <svg viewBox="0 0 64 64" aria-hidden="true" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m10 21 22-11 22 11v27L32 59 10 48z" />
          <path d="M10 21 32 33l22-12M32 33v26M21 15l22 12" />
          <path d="M25 39h14" strokeDasharray="3 4" />
        </svg>
      </span>
      <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-100">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-7 text-neutral-500">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#c2410c] px-6 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#9a3412] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
      >
        {actionLabel}
      </button>
    </section>
  );
}
