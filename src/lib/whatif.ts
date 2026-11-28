// أسئلة «لو عملت N كمان هبقى كام؟» و«محتاج كام عشان أوصل P%؟» — إجابة حتمية
// من نفس بيانات وقواعد الداشبورد (applyCompanyRules + estimatedCommission)،
// من غير أي نداء للموديل: نفس أرقام الصفحة الرئيسية بالظبط.

import {
  OVERALL_MAX_PERCENT,
  applyCompanyRules,
  estimatedCommission,
  formatMoney,
  formatPercent,
  formatQty,
  type RulesKpi,
} from "@/lib/calculations";

export interface WhatIfKpiRow {
  kpiKey: string;
  nameEn: string;
  unitAr: string;
  target: number;
  weight: number;
  achieved: number;
}

export interface WhatIfDashboard {
  kpis: WhatIfKpiRow[];
  overall: number;
  estimatedCommission: number;
  fullCommission: number;
  entriesCount: number;
}

export interface WhatIfIntent {
  kpiKey: string | null; // null = نختار أنسب مؤشر تلقائيًا
  addQty: number | null; // وضع «زيادة N»
  targetPercent: number | null; // وضع «عايز أوصل P%»
}

function norm(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/چ/g, "ج")
    .replace(/\s+/g, " ")
    .trim();
}

const FRANCO: Record<string, string> = {
  law: "لو",
  lo: "لو",
  "3amel": "اعمل",
  a3mel: "اعمل",
  agib: "اجيب",
  ageb: "اجيب",
  zawed: "زود",
  zawwad: "زود",
  kaman: "كمان",
  kman: "كمان",
  awsal: "اوصل",
  owsal: "اوصل",
  "3ayez": "عايز",
  ayez: "عايز",
  "3awez": "عايز",
  kam: "كام",
  fee: "في",
  elmiya: "الميه",
  gas: "gas",
  wallets: "wallets",
  excite: "excite",
  points: "نقاط",
  no2at: "نقاط",
  postpaid: "بوستبيد",
  bostbed: "بوستبيد",
  adsl: "adsl",
  dsl: "adsl",
  target: "التارجت",
  commission: "كوميشن",
  komishon: "كوميشن",
  nسبه: "نسبه",
};

const KPI_ALIASES: [string, string[]][] = [
  ["new_lines", ["gas", "جاس", "جي ايه", "خطوط جديده", "خط جديد", "لاينز", "لاين", "new lines", "lines"]],
  ["new_orange_cash", ["محافظ كاش", "محافظ جديده", "محافظ", "محفظه", "وولتس", "wallets", "wallet", "اورنچ كاش", "اورنج كاش", "كاش"]],
  ["existing_wallets", ["excite", "اكسايت", "اكسيت", "إكسايت", "محافظ قديمه", "محافظ موجوده", "existing"]],
  ["points", ["نقاط", "نقطه", "points", "بريمير", "premier"]],
  ["postpaid_lines", ["بوستبيد", "بوست بيد", "بوس بيد", "postpaid", "فواتير", "خط فاتوره", "خطوط فاتوره"]],
  ["dsl", ["adsl", "dsl", "راوتر", "نت ارضي", "انترنت منزلي", "هوم"]],
];

function detectKpi(text: string): string | null {
  for (const [key, aliases] of KPI_ALIASES) {
    for (const alias of aliases) {
      if (text.includes(alias)) return key;
    }
  }
  return null;
}

export function detectWhatIfIntent(question: string): WhatIfIntent | null {
  let text = norm(question);
  if (!text) return null;
  const words = text.split(" ").map((w) => FRANCO[w] ?? w);
  text = words.join(" ");
  if (text.split(" ").length > 16) return null;

  const asksWhatIf = /(لو |لوزود|لو زود|لو اعمل|لو اجيب|لو اشتغلت|زودت|زوّدت|azwd|احسبلي|هيبقي|هتبقي|هتوصل|نسبتي|كوميشني|كوميشن)/.test(text);
  const asksReach = /(اوصل|اوصّل|عايز|محتاج|need|reach|عشان)/.test(text) && /(%|في الميه|فالميه|بالميه|الميه|التارجت)/.test(text);
  if (!asksWhatIf && !asksReach) return null;

  const kpiKey = detectKpi(text);
  const numbers = (text.match(/\d+/g) ?? []).map(Number).filter((n) => Number.isFinite(n));

  // وضع «عايز أوصل P%»
  const percentMatch = text.match(/(\d{1,3})\s*(%|في الميه|فالميه|بالميه)/);
  if (asksReach && (percentMatch || /الميه|التارجت/.test(text))) {
    const targetPercent = percentMatch ? Number(percentMatch[1]) : 100;
    if (targetPercent >= 1 && targetPercent <= OVERALL_MAX_PERCENT) {
      return { kpiKey, addQty: null, targetPercent };
    }
  }

  // وضع «زيادة N»
  const asksPercentOnly = /^(نسبتي|كوميشني|كوميشن)/.test(text) && numbers.length === 0;
  if (asksPercentOnly) return null; // سؤال عن الوضع الحالي — يروح للمساعد العادي
  const qty = numbers.find((n) => n > 0 && n <= 100000) ?? null;
  if (qty === null) return null;
  if (!asksWhatIf && !kpiKey) return null;
  return { kpiKey, addQty: qty, targetPercent: null };
}

function toRules(rows: WhatIfKpiRow[]): RulesKpi[] {
  return rows.map((row) => ({
    kpiKey: row.kpiKey as RulesKpi["kpiKey"],
    unitAr: row.unitAr,
    target: row.target,
    weight: row.weight,
    achieved: row.achieved,
  }));
}

function simulate(data: WhatIfDashboard, kpiKey: string, add: number) {
  let rows = data.kpis.map((row) =>
    row.kpiKey === kpiKey ? { ...row, achieved: row.achieved + add } : row,
  );
  // المحافظ الجديدة سقفها 100%، والزيادة بتروح Excite.
  const w = rows.find((row) => row.kpiKey === "new_orange_cash");
  if (w && w.target > 0 && w.achieved > w.target) {
    const excess = w.achieved - w.target;
    rows = rows.map((row) =>
      row.kpiKey === "new_orange_cash" ? { ...row, achieved: w.target }
        : row.kpiKey === "existing_wallets" ? { ...row, achieved: row.achieved + excess } : row);
  }
  const rules = applyCompanyRules(toRules(rows));
  const overall = rules.total;
  const commission = estimatedCommission(data.fullCommission, overall);
  return { rows, rules, overall, commission };
}

function pickBestKpi(data: WhatIfDashboard): WhatIfKpiRow | null {
  // أنسب مؤشر للزيادة: أعلى وزن لسه مكمّلش 100%
  const candidates = data.kpis.filter((k) => k.weight > 0 && k.target > 0 && k.achieved < k.target);
  candidates.sort((a, b) => b.weight - a.weight);
  return candidates[0] ?? null;
}

export function buildWhatIfAnswer(data: WhatIfDashboard, intent: WhatIfIntent): string {
  if (!data.kpis.length || data.entriesCount === 0) {
    return "لسه مفيش بيانات مسجلة الشهر ده. سجّل أول بيعة من صفحة تسجيل، وبعدين اسألني تاني.";
  }

  if (intent.addQty !== null) {
    const kpiKey = intent.kpiKey ?? pickBestKpi(data)?.kpiKey ?? null;
    const row = data.kpis.find((k) => k.kpiKey === kpiKey);
    if (!row) {
      return "المؤشر ده مش موجود في التارجت بتاعك الشهر ده. المؤشرات الموجودة: " +
        data.kpis.filter((k) => k.target > 0).map((k) => k.nameEn).join("، ") + ".";
    }
    const { rules, overall, commission } = simulate(data, row.kpiKey, intent.addQty);
    const newPercent = row.target > 0 ? Math.min(((row.achieved + intent.addQty) / row.target) * 100, row.kpiKey === "new_orange_cash" ? 100 : Infinity) : 0;
    const oldPercent = row.target > 0 ? (row.achieved / row.target) * 100 : 0;
    const lines = [
      `لو زوّدت ${formatQty(intent.addQty)} ${row.unitAr} على ${row.nameEn}:`,
      `- نسبتك في ${row.nameEn}: من ${formatPercent(oldPercent)}% لـ ${formatPercent(newPercent)}%`,
      `- إجمالي التارجت: من ${formatPercent(data.overall)}% لـ ${formatPercent(overall)}%`,
      `- الكوميشن المتوقع: من ${formatMoney(data.estimatedCommission)} لـ ${formatMoney(commission)} جنيه`,
    ];
    const countedAfter = rules.counted.find((c) => c.kpiKey === row.kpiKey);
    if (countedAfter?.gated && row.target > 0) {
      const unlockAt = Math.ceil(row.target * 0.9);
      const stillNeed = Math.max(0, unlockAt - (row.achieved + intent.addQty));
      lines.push(
        stillNeed > 0
          ? `- لسه تحت حد الـ90% في ${row.nameEn}، فمش بيتحسب في الإجمالي — فاضل ${formatQty(stillNeed)} ${row.unitAr} عشان يتفتح`
          : `- كده ${row.nameEn} عدّى حد الـ90% وبقى بيتحسب في الإجمالي ✓`,
      );
    }
    if (row.kpiKey === "new_lines" && !rules.walletDone) {
      const wallets = data.kpis.find((k) => k.kpiKey === "new_orange_cash");
      const need = wallets ? Math.max(0, wallets.target - wallets.achieved) : 0;
      lines.push(`- خد بالك: الـ Line مش بتتحسب غير بعد ما تقفل المحافظ — فاضل ${formatQty(need)} محفظة`);
    }
    if (overall >= OVERALL_MAX_PERCENT && data.overall < OVERALL_MAX_PERCENT) {
      lines.push(`- الإجمالي بيتسقف عند ${OVERALL_MAX_PERCENT}%، فالزيادة بعد كده مش هتظهر في النسبة`);
    }
    return lines.join("\n");
  }

  if (intent.targetPercent !== null) {
    const kpi = intent.kpiKey
      ? data.kpis.find((k) => k.kpiKey === intent.kpiKey)
      : pickBestKpi(data);
    if (!kpi) return "كل مؤشراتك مكتملة، مفيش حاجة ناقصة. عاش يا بطل 👏";
    const target = intent.targetPercent;
    if (data.overall >= target) {
      return `إجماليك دلوقتي ${formatPercent(data.overall)}% — أنت أصلاً عدّيت ${formatPercent(target)}%. عاش!`;
    }
    // دور على أقل N من المؤشر ده يوصّل الإجمالي للنسبة المطلوبة
    let need = -1;
    const cap = Math.max(kpi.target * 3, 5000);
    for (let n = 1; n <= cap; n++) {
      if (simulate(data, kpi.kpiKey, n).overall >= target) {
        need = n;
        break;
      }
    }
    if (need < 0) {
      return `حتى لو زوّدت ${kpi.nameEn} للحد الأقصى، الإجمالي مش هيوصل ${formatPercent(target)}% من المؤشر ده لوحده. جرّب تكمّل مؤشر تاني أو اسألني «لو زوّدت N ${kpi.nameEn}» برقم معين.`;
    }
    const after = simulate(data, kpi.kpiKey, need);
    const lines = [
      `عشان توصل لـ ${formatPercent(target)}%: محتاج تزوّد ${formatQty(need)} ${kpi.unitAr} على ${kpi.nameEn}`,
      `- إجمالي التارجت هيبقى: ${formatPercent(after.overall)}%`,
      `- الكوميشن المتوقع: ${formatMoney(after.commission)} جنيه`,
    ];
    if (kpi.kpiKey === "new_lines" && !after.rules.walletDone) {
      const wallets = data.kpis.find((k) => k.kpiKey === "new_orange_cash");
      const wNeed = wallets ? Math.max(0, wallets.target - wallets.achieved) : 0;
      lines.push(`- تنبيه: الـ Line مش بتتحسب غير بعد قفل المحافظ — فاضل ${formatQty(wNeed)} محفظة`);
    }
    return lines.join("\n");
  }

  return "مش فاهم الحسبة المطلوبة بالظبط. جرّب تقول مثلاً: «لو عملت 10 Line كمان» أو «محتاج كام محفظة عشان أوصل 100%».";
}
