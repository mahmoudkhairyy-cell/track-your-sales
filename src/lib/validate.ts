import { ISO_DATE_RE, KPI_KEYS, YEAR_MONTH_RE, type KpiKey } from "@/lib/constants";
import { HttpError } from "@/lib/http";
import { validateQuantity } from "@/lib/quantity";
import type { WorkingDays } from "@/db/schema";

export function requireYearMonth(value: unknown): string {
  if (typeof value !== "string" || !YEAR_MONTH_RE.test(value)) {
    throw new HttpError(400, "اختار شهر بصيغة صحيحة زي 2026-03");
  }
  return value;
}

export function requireKpiKey(value: unknown): KpiKey {
  if (typeof value !== "string" || !KPI_KEYS.includes(value as KpiKey)) {
    throw new HttpError(400, "المؤشر المختار مش معروف");
  }
  return value as KpiKey;
}

export function requireIsoDate(value: unknown, label = "التاريخ"): string {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) {
    throw new HttpError(400, `${label} مش تاريخ صالح`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new HttpError(400, `${label} مش تاريخ موجود في التقويم`);
  }
  if (year < 2020 || year > 2040) {
    throw new HttpError(400, `${label} خارج المدى المسموح`);
  }
  return value;
}

export function requireQuantity(kpiKey: KpiKey, value: unknown): number {
  // القاعدة الموحدة في src/lib/quantity.ts (كسور لـ Quality بس، أعداد صحيحة للباقي).
  const result = validateQuantity(kpiKey, value);
  if (!result.ok) {
    throw new HttpError(400, result.message);
  }
  return result.value;
}

export function requireWorkingDays(value: unknown): WorkingDays {
  if (!value || typeof value !== "object") {
    throw new HttpError(400, "أيام العمل ناقصة");
  }
  const record = value as Record<string, unknown>;
  const keys: (keyof WorkingDays)[] = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"];
  const result = {} as WorkingDays;
  for (const key of keys) {
    if (typeof record[key] !== "boolean") {
      throw new HttpError(400, "أيام العمل مش مكتملة");
    }
    result[key] = record[key];
  }
  return result;
}

export function trimText(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string") {
    throw new HttpError(400, `${field} مطلوب`);
  }
  const text = value.trim();
  if (text.length < min) {
    throw new HttpError(400, `${field} قصير جدًا`);
  }
  if (text.length > max) {
    throw new HttpError(400, `${field} أطول من المسموح`);
  }
  return text;
}

export function optionalNote(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new HttpError(400, "الملاحظة لازم تكون نص");
  }
  const text = value.trim();
  if (text.length > 500) {
    throw new HttpError(400, "الملاحظة أطول من 500 حرف");
  }
  return text || null;
}
