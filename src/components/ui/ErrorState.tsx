"use client";

type ErrorStateProps = {
  title: string;
  description: string;
  onRetry: () => void;
};

export function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  return (
    <section
      className="mx-auto flex min-h-[48vh] w-full max-w-lg flex-col items-center justify-center rounded-3xl border border-red-100 bg-white px-6 py-10 text-center shadow-sm dark:border-red-950 dark:bg-neutral-900"
      dir="rtl"
      role="alert"
    >
      <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-red-50 text-red-400 dark:bg-red-950/30">
        <svg viewBox="0 0 64 64" aria-hidden="true" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M32 8 57 52H7L32 8Z" />
          <path d="M32 24v13M32 44h.02" />
          <path d="m13 13 38 38" strokeDasharray="3 5" opacity=".45" />
        </svg>
      </span>
      <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-100">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-7 text-neutral-500">{description}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#c2410c] px-6 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#9a3412] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
      >
        إعادة المحاولة
      </button>
    </section>
  );
}
