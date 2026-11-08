export default function Loading() {
  return (
    <div className="mx-auto flex min-h-[55vh] w-full max-w-2xl flex-col items-center justify-center px-4 text-center" role="status" aria-live="polite">
      <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-[#f58a3c] to-[#bd4b0a] text-2xl text-white shadow-[0_12px_28px_rgba(189,75,10,0.22)]">
        🍊
        <span className="absolute -inset-2 animate-ping rounded-[26px] border border-[#e96812]/20" />
      </div>
      <p className="text-base font-black text-[#2d1d13]" dir="ltr">Track Your Sales</p>
      <p className="mt-2 text-sm text-[#8c7b6e]">بنجهّز الصفحة… لحظة واحدة</p>
      <div className="mt-6 h-1.5 w-40 overflow-hidden rounded-full bg-[#f4e6dc]">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-l from-[#bd4b0a] to-[#ffad69]" />
      </div>
      <span className="sr-only">جاري التحميل</span>
    </div>
  );
}
