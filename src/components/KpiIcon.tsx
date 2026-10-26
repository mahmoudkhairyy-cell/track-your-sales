import type { KpiKey } from "@/lib/constants";

const PATHS: Record<KpiKey, string> = {
  // هاتف
  new_lines: "M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm5 17h.01",
  // محفظة
  new_orange_cash: "M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h14V9H5a2 2 0 0 1-2-2zm14 6h.01",
  // بطاقة
  existing_wallets: "M2 7h20v10H2zM2 11h20M6 15h4",
  // نجمة
  points: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  // موبايل بإشارة (بوستبيد)
  postpaid_lines: "M4 4h16v16H4zM8 9h8M8 13h5",
  // شبكة (DSL)
  dsl: "M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20M12 2v20",
  // علامة صح (جودة)
  quality: "M9 12l2 2 4-4M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
};

export function KpiIcon({ kpiKey, className = "h-5 w-5" }: { kpiKey: KpiKey; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[kpiKey]} />
    </svg>
  );
}
