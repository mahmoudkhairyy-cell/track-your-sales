/** حبل التقدم لمظهر "فضاء": بيظهر بس لما المظهر ده يكون شغال (CSS بيخفيه في الباقي). */
export function Rope({ pct, label }: { pct: number; label?: string }) {
  const p = Math.min(100, Math.max(0, pct));
  return (
    <div className="tys-rope" role="img" aria-label={`${label ?? "التقدم"} ${Math.round(p)}%`}>
      <div className="tys-rope-track">
        <div className="tys-rope-fill" style={{ width: `calc((100% - 30px) * ${p / 100})` }} />
        <svg className="tys-rope-astro" viewBox="0 0 30 40" aria-hidden="true">
          <rect x="3" y="14" width="7" height="14" rx="3" fill="#9aa6a8" />
          <circle cx="16" cy="9" r="7.5" fill="#e8eef0" />
          <rect x="11" y="5.5" width="10" height="6" rx="3" fill="#0a1214" />
          <rect x="9" y="15" width="14" height="14" rx="5" fill="#e8eef0" />
          <path d="M22 17 L26 8" stroke="#e8eef0" strokeWidth="4" strokeLinecap="round" />
          <rect x="10" y="28" width="5" height="9" rx="2.5" fill="#cfd8da" />
          <rect x="17" y="28" width="5" height="9" rx="2.5" fill="#cfd8da" />
        </svg>
      </div>
    </div>
  );
}

/** مشهد رأسي في الهيرو (زي الصورة): كشاف فوق، حبل نازل، والرائد بيطلع كل ما النسبة تزيد. */
export function SpaceScene({ pct }: { pct: number }) {
  const p = Math.min(100, Math.max(0, pct));
  const y = 90 - (p / 100) * 62; // % من ارتفاع الهيرو: 90 تحت خالص، 28 قرب الكشاف
  return (
    <div className="tys-scene" aria-hidden="true">
      <span className="tys-scene-light" />
      <span className="tys-scene-rope" style={{ height: `${y}%` }} />
      <svg className="tys-scene-astro" style={{ top: `${y}%` }} viewBox="0 0 30 40">
        <rect x="3" y="14" width="7" height="14" rx="3" fill="#9aa6a8" />
        <circle cx="16" cy="9" r="7.5" fill="#e8eef0" />
        <rect x="11" y="5.5" width="10" height="6" rx="3" fill="#0a1214" />
        <rect x="9" y="15" width="14" height="14" rx="5" fill="#e8eef0" />
        <path d="M16 15 L15 2" stroke="#e8eef0" strokeWidth="4" strokeLinecap="round" />
        <rect x="10" y="28" width="5" height="9" rx="2.5" fill="#cfd8da" />
        <rect x="17" y="28" width="5" height="9" rx="2.5" fill="#cfd8da" />
      </svg>
    </div>
  );
}
