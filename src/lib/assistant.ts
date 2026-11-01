// مساعد التارجت: قراءة بس من الأرقام الموجودة. مابيغيرش أي معادلة ولا Overall ولا العمولة.

export type AssistantKpi = {
  kpiKey: string;
  nameEn: string;
  target: number;
  weight: number;
  achieved: number;
  percent: number;
};

export type AssistantInput = {
  kpis: AssistantKpi[];
  overall: number;
  work: { total: number; elapsed: number; remaining: number };
  remainingDates: string[];
};

export type KpiStatus = "done" | "ahead" | "behind" | "no-target";

export type KpiAssistant = {
  kpiKey: string;
  nameEn: string;
  weight: number;
  achieved: number;
  target: number;
  percent: number;
  remaining: number;
  needPerDayTo90: number | null;
  needPerDayTo100: number | null;
  status: KpiStatus;
  /** المتوسط اليومي الفعلي (بالوحدة بتاعت المؤشر) */
  averagePerDay: number | null;
  /** متوقع الوصول لـ 90% بالمعدل الحالي (YYYY-MM-DD) أو null */
  reach90On: string | null;
  reach100On: string | null;
  /** النسبة المتوقعة في نهاية الشهر بالمعدل الحالي */
  projectedPercent: number | null;
  /** المتقدم/المتأخر عن المعدل المتوقع لحد النهارده (بالوحدة) */
  gapToExpected: number;
  note: string | null;
};

export type AssistantResult = {
  enoughData: boolean;
  dataMessage: string | null;
  overall: {
    percent: number;
    expectedPercent: number;
    status: "ahead" | "on" | "behind" | "done" | "no-days";
    gapPoints: number;
  };
  kpis: KpiAssistant[];
  recommendations: string[];
};

const QUALITY_KEY = "quality";

// توصيات عملية حسب المؤشر، بالعامية المصرية. مفيش فيها أرقام مخترعة.
const ADVICE: Record<string, string> = {
  new_lines: "ركّز على الخطوط الجديدة: زوّد عدد العملاء اللي بتعرض عليهم خط في اليوم.",
  new_orange_cash: "ركّز على المحافظ الجديدة: اعرض Orange Cash على كل عميل بيحتاج تحويل أو دفع.",
  existing_wallets: "ركّز على المحافظ القائمة: اعرض التفعيل على العملاء اللي عندهم خط مالوش محفظة.",
  points: "ركّز على النقاط: اسأل كل عميل عن نقاطه وحوّلها في نفس الزيارة.",
  postpaid_lines: "ركّز على البوست بيد: ركّز على العملاء اللي عندهم دخل ثابت ومحتاجين خط تقيل.",
  dsl: "ركّز على الـ DSL: اعرضه على أي عميل بيشتكي من الإنترنت أو بيدفع فاتورة نت عالية.",
  productivity: "راجع الإنتاجية: قلل الوقت الضايع بين العملاء وسجّل كل عملية في نفس اليوم.",
  [QUALITY_KEY]: "راجع بنود الكواليتي في صفحة إنجاز اليوم: كل بند بيتحسب بوزنه.",
};

const DAY_LOCALE = "ar-EG";

export function formatAssistantDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00+02:00`);
  return new Intl.DateTimeFormat(DAY_LOCALE, { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Cairo" }).format(date);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** اللي يلزم في اليوم عشان توصل لنسبة معينة من التارجت، بالأيام المتبقية. */
function perDayNeed(target: number, achieved: number, percentGoal: number, remainingDays: number): number | null {
  const goal = (target * percentGoal) / 100;
  const missing = Math.max(0, goal - achieved);
  if (missing <= 0) return 0;
  if (remainingDays <= 0) return null;
  return round(missing / remainingDays);
}

/** تاريخ الوصول لنسبة معينة بالمعدل الفعلي الحالي، من أيام الشغل المتبقية. */
function reachDate(target: number, achieved: number, percentGoal: number, avgPerDay: number, remainingDates: string[]): string | null {
  const goal = (target * percentGoal) / 100;
  const missing = goal - achieved;
  if (missing <= 0) return null;
  if (avgPerDay <= 0) return null;
  const daysNeeded = Math.ceil(missing / avgPerDay);
  if (daysNeeded < 1 || daysNeeded > remainingDates.length) return null;
  return remainingDates[daysNeeded - 1];
}

export function buildAssistant(input: AssistantInput): AssistantResult {
  const { work, remainingDates } = input;
  const enoughDataBase = work.total > 0;
  const expectedPercent = work.total > 0 ? (work.elapsed / work.total) * 100 : 0;
  const overallStatus: AssistantResult["overall"]["status"] =
    input.overall >= 100 ? "done" : work.remaining <= 0 ? "no-days" : input.overall >= expectedPercent + 5 ? "ahead" : input.overall >= expectedPercent - 5 ? "on" : "behind";

  if (!enoughDataBase) {
    return {
      enoughData: false,
      dataMessage: "مفيش أيام شغل في الشهر ده، راجع أيام العمل في إعدادات التارجت.",
      overall: { percent: input.overall, expectedPercent: 0, status: overallStatus, gapPoints: 0 },
      kpis: [],
      recommendations: [],
    };
  }

  // ما فيش بيانات كفاية لأي توقع قبل أول يوم شغل اتقفل بعدد أيام كفاية
  const enoughData = work.elapsed >= 1;
  const dataMessage = enoughData
    ? null
    : "لسه مفيش أيام شغل خلصت الشهر ده، التوقعات هتظهر بعد أول يوم.";

  const kpis: KpiAssistant[] = input.kpis.map((kpi) => {
    const isQuality = kpi.kpiKey === QUALITY_KEY;
    const hasTarget = kpi.target > 0;
    const remaining = Math.max(0, kpi.target - kpi.achieved);
    const expectedSoFar = hasTarget ? (kpi.target * work.elapsed) / work.total : 0;
    const gap = round(kpi.achieved - expectedSoFar);

    let status: KpiStatus;
    if (!hasTarget) status = "no-target";
    else if (kpi.percent >= 100) status = "done";
    else status = gap >= 0 ? "ahead" : "behind";

    // الكواليتي نسبة مش تراكمي، فمابنحسبش عليه معدل يومي أو توقع
    if (isQuality || !hasTarget) {
      return {
        kpiKey: kpi.kpiKey,
        nameEn: kpi.nameEn,
        weight: kpi.weight,
        achieved: kpi.achieved,
        target: kpi.target,
        percent: kpi.percent,
        remaining,
        needPerDayTo90: null,
        needPerDayTo100: null,
        status,
        averagePerDay: null,
        reach90On: null,
        reach100On: null,
        projectedPercent: null,
        gapToExpected: 0,
        note: isQuality ? "الكواليتي نسبة بنود، مش إنتاج يومي، فمفيش توقع ليه." : !hasTarget ? "المؤشر ده من غير تارجت." : null,
      };
    }

    const remainingDays = work.remaining;
    const avgPerDay = work.elapsed > 0 ? kpi.achieved / work.elapsed : 0;
    const projected = avgPerDay * work.total;
    const projectedPercent = enoughData ? round((projected / kpi.target) * 100) : null;
    const note = !enoughData
      ? null
      : kpi.achieved === 0
        ? "لسه مفيش إنجاز في المؤشر ده، ومفيش توقع ليه بعد."
        : null;

    return {
      kpiKey: kpi.kpiKey,
      nameEn: kpi.nameEn,
      weight: kpi.weight,
      achieved: kpi.achieved,
      target: kpi.target,
      percent: kpi.percent,
      remaining,
      needPerDayTo90: perDayNeed(kpi.target, kpi.achieved, 90, remainingDays),
      needPerDayTo100: perDayNeed(kpi.target, kpi.achieved, 100, remainingDays),
      status,
      averagePerDay: enoughData ? round(avgPerDay) : null,
      reach90On: enoughData ? reachDate(kpi.target, kpi.achieved, 90, avgPerDay, remainingDates) : null,
      reach100On: enoughData ? reachDate(kpi.target, kpi.achieved, 100, avgPerDay, remainingDates) : null,
      projectedPercent,
      gapToExpected: gap,
      note,
    };
  });

  // أضعف المؤشرات (بوزن) تتحط في التوصيات
  const weakest = kpis
    .filter((kpi) => kpi.weight > 0 && kpi.status !== "no-target" && kpi.status !== "done")
    .sort((a, b) => a.percent - b.percent)
    .slice(0, 2);
  const recommendations = weakest.map((kpi) => {
    const advice = ADVICE[kpi.kpiKey] ?? "ركّز على المؤشر ده أكتر.";
    if (kpi.kpiKey === QUALITY_KEY || kpi.needPerDayTo90 === null) return `${kpi.nameEn}: ${advice}`;
    return `${kpi.nameEn}: ${advice} محتاج تقريبًا ${kpi.needPerDayTo90} في اليوم عشان توصل لـ 90%.`;
  });
  if (recommendations.length === 0 && input.overall < 100) {
    recommendations.push("كمّل بنفس الإيقاع، وراقب أقل مؤشر كل يوم.");
  }

  return {
    enoughData,
    dataMessage,
    overall: {
      percent: input.overall,
      expectedPercent: round(expectedPercent),
      status: overallStatus,
      gapPoints: round(input.overall - expectedPercent),
    },
    kpis,
    recommendations,
  };
}
