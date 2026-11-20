export default function Loading() {
  return (
    <div className="mx-auto flex min-h-[55vh] w-full max-w-2xl flex-col items-center justify-center px-4 text-center" role="status" aria-live="polite">
      <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-card bg-gradient-to-br from-brand-400 to-brand-deep text-2xl text-white shadow-deep">
        🍊
        <span className="absolute -inset-2 animate-ping rounded-card border border-[#e96812]/20" />
      </div>
      <p className="text-base font-black text-ink-3" dir="ltr">Track Your Sales</p>
      <p className="mt-2 text-sm text-ink-muted-3">بنجهّز الصفحة… لحظة واحدة</p>
      <div className="mt-6 h-1.5 w-40 overflow-hidden rounded-full bg-[#f4e6dc]">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-l from-brand-deep to-[#ffad69]" />
      </div>
      <span className="sr-only">جاري التحميل</span>
    </div>
  );
}
