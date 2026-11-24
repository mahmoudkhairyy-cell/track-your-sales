type SparklineProps = {
  values: number[];
  color?: string;
  className?: string;
};

/** رسم صغير (تراكمي) بدون مكتبات. بيتجاهل الداتا الأقل من نقطتين. */
export function Sparkline({ values, color = "#e96812", className = "" }: SparklineProps) {
  if (values.length < 2) return null;
  const width = 100;
  const height = 24;
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const points = values.map((value, index) => `${(index * step).toFixed(2)},${(height - 2 - (value / max) * (height - 4)).toFixed(2)}`);
  const last = points[points.length - 1].split(",");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={`h-6 w-full ${className}`} aria-hidden="true" focusable="false">
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity="0.85" />
      <circle cx={last[0]} cy={last[1]} r="2.2" fill={color} />
    </svg>
  );
}

type DeltaProps = {
  current: number;
  previous: number | null;
};

/** فرق نسبي عن نفس الفترة من الشهر اللي فات. مفيش عرض لو مفيش بيانات سابقة. */
export function DeltaChip({ current, previous }: DeltaProps) {
  if (previous === null || previous <= 0) return null;
  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(change);
  if (!Number.isFinite(rounded)) return null;
  const up = rounded > 0;
  const flat = rounded === 0;
  const tone = flat ? "text-[var(--color-text-secondary)]" : up ? "text-emerald-700" : "text-red-600";
  const arrow = flat ? "•" : up ? "▲" : "▼";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold ${tone}`} dir="ltr" title="مقارنة بنفس الفترة من الشهر اللي فات">
      <span aria-hidden="true">{arrow}</span>
      {Math.abs(rounded)}%
    </span>
  );
}
