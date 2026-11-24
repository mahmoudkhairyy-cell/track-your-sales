
const PATHS: Record<string, string> = {
  // هاتف
  new_lines: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-2a7 7 0 0 1 14 0v2M18 5h5M20.5 2.5v5",
  // محفظة
  new_orange_cash: "M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h14V9H5a2 2 0 0 1-2-2zm14 6h.01",
  // بطاقة
  existing_wallets: "M2 7h20v10H2zM2 11h20M6 15h4",
  // نجمة
  points: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  // موبايل بإشارة (بوستبيد)
  postpaid_lines: "M5 3h4l2 5-3 2a14 14 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2C10 21 3 14 3 5a2 2 0 0 1 2-2",
  // شبكة (DSL)
  dsl: "M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8 16a6 6 0 0 1 8 0M12 20h.01",
  // علامة صح (جودة)
  quality: "M9 12l2 2 4-4M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
};

export function KpiIcon({ kpiKey, className = "h-5 w-5" }: { kpiKey: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[kpiKey] ?? "M12 12h.01"} />
    </svg>
  );
}
