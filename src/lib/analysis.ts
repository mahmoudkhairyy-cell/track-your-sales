// تحليل الأداء: قراءة بس من النسب الموجودة. مايغيّرش أي حساب.
import { OVERALL_MIN_PERCENT, KPI_MIN_PERCENT } from "@/lib/calculations";

export type AnalysisKpi = { kpiKey: string; nameEn: string; weight: number; target: number; percent: number };

export type PerformanceAnalysis = {
  hasData: boolean;
  strongest: { kpiKey: string; nameEn: string; percent: number } | null;
  weakest: { kpiKey: string; nameEn: string; percent: number } | null;
  ranking: { kpiKey: string; nameEn: string; percent: number }[];
  needsIntervention: { kpiKey: string; nameEn: string; percent: number }[];
  overallLevel: "below-min" | "eligible" | "strong" | "exceptional";
  overallText: string;
};

/** بيحسب ترتيب المؤشرات وأقوى/أضعف مؤشر وإيه اللي محتاج تدخل، من الأوزان والتارجت الحاليين. */
export function analyzePerformance(kpis: AnalysisKpi[], overall: number): PerformanceAnalysis {
  // المؤشرات اللي ليها تارجت ووزن بس هي اللي بتتقارن
  const ranked = kpis
    .filter((k) => k.weight > 0 && k.target > 0)
    .map((k) => ({ kpiKey: k.kpiKey, nameEn: k.nameEn, percent: k.percent }))
    .sort((a, b) => b.percent - a.percent);

  const hasData = ranked.length > 0;
  const needsIntervention = ranked.filter((k) => k.percent < KPI_MIN_PERCENT);

  let overallLevel: PerformanceAnalysis["overallLevel"];
  let overallText: string;
  if (overall < OVERALL_MIN_PERCENT) {
    overallLevel = "below-min";
    overallText = `إجمالي الأداء ${Math.round(overall)}% ، لسه تحت حد ${OVERALL_MIN_PERCENT}% اللي بيفتح الحافز.`;
  } else if (overall < 100) {
    overallLevel = "eligible";
    overallText = `إجمالي الأداء ${Math.round(overall)}% ، إنت فوق حد الحافز. فاضل تقفل التارجت.`;
  } else if (overall < 120) {
    overallLevel = "strong";
    overallText = `إجمالي الأداء ${Math.round(overall)}% ، التارجت اتقفل، وده أداء قوي.`;
  } else {
    overallLevel = "exceptional";
    overallText = `إجمالي الأداء ${Math.round(overall)}% ، أداء استثنائي.`;
  }

  return {
    hasData,
    strongest: ranked[0] ?? null,
    weakest: ranked.length ? ranked[ranked.length - 1] : null,
    ranking: ranked,
    needsIntervention,
    overallLevel,
    overallText,
  };
}
