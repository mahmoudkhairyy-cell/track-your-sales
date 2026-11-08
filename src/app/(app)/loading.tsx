export default function Loading() {
  return (
    <div className="flex min-h-[45vh] flex-col items-center justify-center gap-4 rounded-[28px] border border-[#f1dfd0] bg-gradient-to-br from-white via-[#fffaf5] to-[#fff0e2] p-8 text-center text-[#927b69] shadow-[0_12px_30px_rgba(126,65,24,0.05)]">
      <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-[#f1dfd0]">
        <img src="/track-your-sales/logo-mark.png" alt="" className="h-10 w-10 animate-pulse object-contain" />
        <span className="absolute -inset-1 rounded-[19px] border border-[#e96812]/25" />
      </span>
      <span className="text-sm font-extrabold">بيحمّل Track Your Sales...</span>
      <span className="h-1.5 w-28 overflow-hidden rounded-full bg-[#f3e4d8]">
        <span className="block h-full w-1/2 animate-pulse rounded-full bg-gradient-to-l from-[#bd4b0a] to-[#ff9d38]" />
      </span>
    </div>
  );
}
