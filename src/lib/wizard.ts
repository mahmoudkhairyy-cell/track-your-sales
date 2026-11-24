// حاسبات إلغاء موجّهة (سؤال واحد في كل خطوة) — حساب حتمي من المعادلات الرسمية الموثقة
// في ملفات أورنچ: حاسبة إلغاء ADSL (file-07164345.xlsx) وحاسبة Postpaid (شيت
// "Line Mig & Ter Calculation"). ممنوع أي رقم مش من الملفات: الثوابت 227 و57 و8% و14%
// من نفس الملفين.

export type WizardFlowId = "dsl" | "invoice";

export interface WizardStep {
  key: string;
  question: string;
  parse: (input: string) => number | string | null; // null = إدخال غير صالح
  errorMessage: string;
}

export interface WizardState {
  flowId: WizardFlowId;
  stepIndex: number;
  answers: Record<string, number | string>;
}

const DATE_HINT = "اكتب التاريخ بالشكل ده: 2024-10-15 أو 15/10/2024";

function parseDateInput(raw: string): string | null {
  const text = raw.trim();
  if (/^(النهارده|النهاردة|اليوم|today|دلوقتي)$/i.test(text)) {
    return toIsoDate(new Date());
  }
  let match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) {
    const [, y, m, d] = match;
    return validIso(Number(y), Number(m), Number(d));
  }
  match = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return validIso(Number(y), Number(m), Number(d));
  }
  return null;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function validIso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / 86400000);
}

function parseNumberInput(raw: string, { integer = false, min = 0 }: { integer?: boolean; min?: number } = {}): number | null {
  const text = raw.trim().replace(/[,٬]/g, "").replace(/[٠-٩]/g, (ch) => String("٠١٢٣٤٥٦٧٨٩".indexOf(ch)));
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < min) return null;
  if (integer && !Number.isInteger(value)) return null;
  return value;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function money(value: number): string {
  return `${round2(value).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} جنيه`;
}

const numberError = "اكتب رقم صحيح (صفر أو أكتر)، من غير حروف.";
const dateError = `التاريخ مش مفهوم. ${DATE_HINT}`;

export const WIZARD_FLOWS: Record<WizardFlowId, { title: string; intro: string; steps: WizardStep[]; finish: (a: Record<string, number | string>) => string }> = {
  dsl: {
    title: "حاسبة إلغاء خدمة ADSL",
    intro:
      "هسألك 5 أسئلة واحد ورا التاني، وبعدين أحسبلك مبلغ الإلغاء بالمعادلة الرسمية. اكتب «إلغاء» في أي وقت عشان توقف.",
    steps: [
      {
        key: "activationDate",
        question: `1/5: تاريخ تفعيل الخدمة؟ (هتلاقيه في صفحة الـ Service Account)\n${DATE_HINT}`,
        parse: (input) => parseDateInput(input),
        errorMessage: dateError,
      },
      {
        key: "actionDate",
        question: `2/5: تاريخ الإلغاء؟ اكتب «النهارده» لو الإلغاء النهارده، أو تاريخ تاني.\n${DATE_HINT}`,
        parse: (input) => parseDateInput(input),
        errorMessage: dateError,
      },
      {
        key: "routerOccs",
        question:
          "3/5: عدد أقساط الراوتر المتبقية (OCCs)؟\nمن Parent Account > Billing Details > OCCs (سطر High End Router Installments).",
        parse: (input) => parseNumberInput(input, { integer: true }),
        errorMessage: "اكتب عدد صحيح (صفر أو أكتر).",
      },
      {
        key: "unpaidBills",
        question: "4/5: إجمالي الفواتير غير المدفوعة (Open Amount)؟\nTotal Open Amount من Customer Info في SMC Tool.",
        parse: (input) => parseNumberInput(input),
        errorMessage: numberError,
      },
      {
        key: "unbilledOcc",
        question: "5/5: قيمة الـ Unbilled OCC قبل الضريبة؟\nمن Customer Info في SMC Tool.",
        parse: (input) => parseNumberInput(input),
        errorMessage: numberError,
      },
    ],
    finish: (a) => {
      const activation = String(a.activationDate);
      const action = String(a.actionDate);
      const billsCount = daysBetween(activation, action) / 30;
      const penalty = billsCount <= 12 ? 227 : 0;
      const router = Number(a.routerOccs) * 57;
      const unpaid = Number(a.unpaidBills);
      const unbilledWithTax = Number(a.unbilledOcc) * 1.14;
      const total = penalty + router + unpaid + unbilledWithTax;
      return [
        "نتيجة حاسبة إلغاء ADSL:",
        "",
        `عدد الفواتير الصادرة: ${round2(billsCount)} ((تاريخ الإلغاء − التفعيل) ÷ 30)`,
        `غرامة الإلغاء المبكر: ${money(penalty)}${penalty > 0 ? " (الفواتير ≤ 12)" : " (الفواتير > 12 فمفيش غرامة)"}`,
        `المتبقي من أقساط الراوتر: ${money(router)} (${Number(a.routerOccs)} قسط × 57)`,
        `الفواتير غير المدفوعة: ${money(unpaid)}`,
        `الـUnbilled OCC شامل ضريبة 14%: ${money(unbilledWithTax)}`,
        "",
        `إجمالي مبلغ الإلغاء: ${money(total)}`,
        "",
        "المعادلة والثوابت (227 و57 و14%) من ملف حاسبة الإلغاء الرسمي. راجع القيم من SMC وSiebel قبل ما تقول رقم نهائي للعميل.",
      ].join("\n");
    },
  },
  invoice: {
    title: "حاسبة إلغاء الفاتورة (إنهاء/تحويل خط) — SR 10758",
    intro:
      "هسألك 7 أسئلة واحد ورا التاني، وبعدين أحسبلك المبلغ المستحق على العميل بالمعادلة الرسمية. اكتب «إلغاء» في أي وقت عشان توقف.",
    steps: [
      {
        key: "billed",
        question: "1/7: إجمالي الفواتير الصادرة غير المسددة (Billed)؟",
        parse: (input) => parseNumberInput(input),
        errorMessage: numberError,
      },
      {
        key: "monthlySub",
        question: "2/7: قيمة الاشتراك الشهري؟",
        parse: (input) => parseNumberInput(input),
        errorMessage: numberError,
      },
      {
        key: "tariffDays",
        question: "3/7: عدد أيام دورة الاشتراك (Tariff Days)؟ غالبًا 30.",
        parse: (input) => parseNumberInput(input, { integer: true, min: 1 }),
        errorMessage: "اكتب عدد صحيح أكبر من صفر.",
      },
      {
        key: "daysPassed",
        question:
          "4/7: عدد الأيام من تاريخ إصدار الفاتورة حتى تاريخ التحويل/الإلغاء + يوم زيادة لإجراءات التحويل في خلال 24 ساعة؟\n(نفس خانة Days passed في الملف بالظبط)",
        parse: (input) => parseNumberInput(input, { integer: true }),
        errorMessage: "اكتب عدد صحيح (صفر أو أكتر).",
      },
      {
        key: "unbilledUsage",
        question: "5/7: الـUnbilled Usage (الاستخدام غير المفوتر)؟",
        parse: (input) => parseNumberInput(input),
        errorMessage: numberError,
      },
      {
        key: "unbilledOcc",
        question: "6/7: الـUnbilled OCC (الرسوم الدورية غير المفوترة)؟",
        parse: (input) => parseNumberInput(input),
        errorMessage: numberError,
      },
      {
        key: "sdf",
        question: "7/7: رسوم التنمية (SDF)؟ (في مثال الملف الرسمي: 10)",
        parse: (input) => parseNumberInput(input),
        errorMessage: numberError,
      },
    ],
    finish: (a) => {
      const daily = Number(a.monthlySub) / Number(a.tariffDays);
      const daysEffective = Number(a.daysPassed); // المدخل شامل يوم إجراءات التحويل زي ما الملف معرّف الخانة
      const subToDate = daily * daysEffective;
      const preTax = subToDate + Number(a.unbilledUsage) + Number(a.unbilledOcc) + Number(a.sdf);
      const scheduleTax = preTax * 0.08;
      const afterSchedule = preTax + scheduleTax;
      const vat = afterSchedule * 0.14;
      const unbilledAfterTax = afterSchedule + vat;
      const total = Number(a.billed) + unbilledAfterTax;
      return [
        "نتيجة حاسبة إلغاء الفاتورة (SR 10758):",
        "",
        `الاشتراك باليوم: ${money(daily)} (${Number(a.monthlySub)} ÷ ${Number(a.tariffDays)} يوم)`,
        `الأيام المحسوبة: ${daysEffective} (شاملة يوم إجراءات التحويل)`,
        `الاشتراك حتى تاريخ الإنهاء/التحويل: ${money(subToDate)}`,
        `إجمالي الـUnbilled قبل الضريبة: ${money(preTax)} (اشتراك + usage ${a.unbilledUsage} + OCC ${a.unbilledOcc} + SDF ${a.sdf})`,
        `ضريبة الجدول 8%: ${money(scheduleTax)}`,
        `ضريبة القيمة المضافة 14%: ${money(vat)}`,
        `إجمالي الـUnbilled بعد الضريبة: ${money(unbilledAfterTax)}`,
        `الفواتير الصادرة: ${money(Number(a.billed))}`,
        "",
        `إجمالي المبلغ المستحق على العميل: ${money(total)}`,
        "",
        "الخطوات البعدها (SR 10758): (1) العميل يسدد المبلغ. (2) استكمل الـSR. (3) املأ عقدًا فاضيًا واكتب نوع الـMigration (مثال: من X إلى FREEmax 115).",
        "متنساش: راجع الـTariff Lock على Siebel، وسوّي أقساط Wincash، واسترد نقاط الولاء قبل الإنهاء.",
      ].join("\n");
    },
  },
};

export function startWizard(flowId: WizardFlowId): { state: WizardState; messages: string[] } {
  const flow = WIZARD_FLOWS[flowId];
  return {
    state: { flowId, stepIndex: 0, answers: {} },
    messages: [flow.intro, flow.steps[0].question],
  };
}

// بيرجع الرسائل الجديدة، أو null لو المدخل مش صالح (مع رسالة الخطأ أولها)
export function advanceWizard(state: WizardState, input: string): { state: WizardState; messages: string[]; done: boolean } {
  const flow = WIZARD_FLOWS[state.flowId];
  const step = flow.steps[state.stepIndex];
  const value = step.parse(input);
  if (value === null) {
    return { state, messages: [step.errorMessage, step.question], done: false };
  }
  const answers = { ...state.answers, [step.key]: value };
  const nextIndex = state.stepIndex + 1;
  if (nextIndex >= flow.steps.length) {
    return { state: { ...state, stepIndex: nextIndex, answers }, messages: [flow.finish(answers)], done: true };
  }
  return { state: { ...state, stepIndex: nextIndex, answers }, messages: [flow.steps[nextIndex].question], done: false };
}
