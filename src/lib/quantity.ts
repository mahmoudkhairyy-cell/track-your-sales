import type { KpiKey } from "@/lib/constants";

/**
 * القاعدة الموحدة للكميات في كل التطبيق (API + الفورم + الاستعادة):
 * - Quality: كسور مسموحة، والقيمة من 0 لـ 100.
 * - باقي المؤشرات: أعداد صحيحة موجبة فقط (مفيش نص خط ولا نص محفظة).
 *
 * الدالة بترجع { ok: true, value } أو { ok: false, message } من غير ما ترمي
 * HttpError عشان تنفع في المتصفح وفي السيرفر وفي سكريبت الفحص الذاتي.
 */

export const MAX_QUANTITY = 1_000_000;

export type QuantityResult = { ok: true; value: number } | { ok: false; message: string };

export function allowsFraction(kpiKey: KpiKey): boolean {
  return kpiKey === "quality";
}

export function quantityStep(kpiKey: KpiKey): string {
  return allowsFraction(kpiKey) ? "0.01" : "1";
}

export function quantityMin(kpiKey: KpiKey): number {
  return allowsFraction(kpiKey) ? 0 : 1;
}

export function quantityMax(kpiKey: KpiKey): number {
  return allowsFraction(kpiKey) ? 100 : MAX_QUANTITY;
}

export function quantityHint(kpiKey: KpiKey): string {
  return allowsFraction(kpiKey)
    ? "Quality من 0 لـ 100، وينفع كسور زي 97.5."
    : "عدد صحيح أكبر من صفر. ينفع تسجّل نفس المؤشر أكتر من مرة في اليوم.";
}

export function validateQuantity(kpiKey: KpiKey, raw: unknown): QuantityResult {
  const quantity =
    typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;

  if (!Number.isFinite(quantity)) {
    return { ok: false, message: "الكمية لازم تكون رقم" };
  }

  if (allowsFraction(kpiKey)) {
    if (quantity < 0 || quantity > 100) {
      return { ok: false, message: "Quality لازم تكون بين 0 و 100" };
    }
    return { ok: true, value: Math.round(quantity * 100) / 100 };
  }

  if (!Number.isInteger(quantity)) {
    return { ok: false, message: "الكمية لازم تكون عدد صحيح (من غير كسور) للمؤشر ده" };
  }
  if (quantity <= 0) {
    return { ok: false, message: "الكمية لازم تكون عدد صحيح أكبر من صفر" };
  }
  if (quantity > MAX_QUANTITY) {
    return { ok: false, message: "الكمية أكبر من المسموح" };
  }
  return { ok: true, value: quantity };
}
