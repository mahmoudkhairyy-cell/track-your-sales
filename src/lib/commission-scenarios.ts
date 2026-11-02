// سيناريوهات العمولة: بتستخدم نفس معادلة العمولة الحالية (estimatedCommission) بدون أي تعديل.
import { estimatedCommission, OVERALL_MIN_PERCENT } from "@/lib/calculations";

export type CommissionScenario = { label: string; overall: number; commission: number };

export type CommissionScenarios = {
  hasFullCommission: boolean;
  message: string | null;
  current: { overall: number; commission: number; belowMinimum: boolean };
  scenarios: CommissionScenario[];
  perOnePercent: number;
};

export function buildCommissionScenarios(input: {
  fullCommission: number;
  overall: number;
  allowCommissionOver100: boolean;
  belowOverall: boolean;
}): CommissionScenarios {
  const { fullCommission, overall, allowCommissionOver100, belowOverall } = input;
  const belowMinimum = belowOverall || overall < OVERALL_MIN_PERCENT;

  // الحسبة بتاعت التطبيق: لو الإجمالي تحت الحد الأدنى مفيش حافز (زي الداشبورد بالظبط).
  const pay = (percent: number) => (percent < OVERALL_MIN_PERCENT ? 0 : estimatedCommission(fullCommission, percent, allowCommissionOver100));

  if (!(fullCommission > 0)) {
    return {
      hasFullCommission: false,
      message: "الكوميشن الكامل مش متسجل في إعدادات الشهر، فمش هنقدر نحسب السيناريوهات. حطه في التارجت الأول.",
      current: { overall, commission: 0, belowMinimum },
      scenarios: [],
      perOnePercent: 0,
    };
  }

  const levels: { label: string; overall: number }[] = [
    { label: `الوصول لـ ${OVERALL_MIN_PERCENT}% (أقل حد للحافز)`, overall: OVERALL_MIN_PERCENT },
    { label: "الوصول لـ 90%", overall: 90 },
    { label: "الوصول لـ 100%", overall: 100 },
    { label: "تخطي 120%", overall: 120 },
    { label: "تخطي 150%", overall: 150 },
  ];

  return {
    hasFullCommission: true,
    message: null,
    current: { overall, commission: Math.round(pay(overall)), belowMinimum },
    scenarios: levels.map((level) => ({ label: level.label, overall: level.overall, commission: Math.round(pay(level.overall)) })),
    perOnePercent: Math.round(fullCommission / 100),
  };
}
