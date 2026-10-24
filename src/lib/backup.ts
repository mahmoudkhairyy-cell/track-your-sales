import { DEFAULT_WORKING_DAYS, ISO_DATE_RE, KPI_KEYS, SCHEMA_VERSION, YEAR_MONTH_RE } from "@/lib/constants";
import type { KpiKey } from "@/lib/constants";
import { validateQuantity } from "@/lib/quantity";
import type { WorkingDays } from "@/db/schema";

export type BackupKpi = {
  kpiKey: KpiKey;
  target: number;
  weight: number;
  unitAr: string;
  sortOrder: number;
};

export type BackupHoliday = {
  date: string;
  note: string | null;
};

export type BackupMonth = {
  yearMonth: string;
  fullCommission: number;
  allowCommissionOver100: boolean;
  workingDays: WorkingDays;
  kpis: BackupKpi[];
  holidays: BackupHoliday[];
};

export type BackupEntry = {
  id?: string;
  kpiKey: KpiKey;
  quantity: number;
  entryDate: string;
  note: string | null;
  createdAt?: string;
};

export type BackupArticle = {
  id?: string;
  title: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
};

export type BackupFile = {
  schemaVersion: number;
  exportedAt: string;
  isEmpty: boolean;
  emptyReason: string | null;
  profile: { name: string; branch: string };
  months: BackupMonth[];
  entries: BackupEntry[];
  articles: BackupArticle[];
};

const WEEK_KEYS: (keyof WorkingDays)[] = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"];
const FORBIDDEN = [
  "apiKey",
  "api_key",
  "gemini",
  "geminiApiKey",
  "gemini_api_key",
  "password",
  "passwordHash",
  "token",
  "secret",
  "credentials",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`حقل ${field} ناقص أو مش نص صالح`);
  }
  return value.trim();
}

function asOptionalString(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error(`حقل ${field} لازم يكون نص`);
  }
  return value;
}

function asNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`حقل ${field} لازم يكون رقم`);
  }
  return value;
}

function asBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`حقل ${field} لازم يكون true أو false`);
  }
  return value;
}

function assertNoSecrets(record: Record<string, unknown>, path: string) {
  for (const key of Object.keys(record)) {
    if (FORBIDDEN.includes(key)) {
      throw new Error(`الملف فيه حقل ممنوع (${path}.${key})`);
    }
  }
}

function parseWorkingDays(value: unknown): WorkingDays {
  if (!isRecord(value)) {
    throw new Error("أيام العمل ناقصة أو شكلها غلط");
  }
  const result = { ...DEFAULT_WORKING_DAYS };
  for (const key of WEEK_KEYS) {
    if (typeof value[key] !== "boolean") {
      throw new Error(`يوم العمل ${key} لازم يكون true أو false`);
    }
    result[key] = value[key] as boolean;
  }
  return result;
}

function parseKpi(value: unknown, index: number): BackupKpi {
  if (!isRecord(value)) throw new Error(`مؤشر رقم ${index + 1} شكله غلط`);
  const kpiKey = asString(value.kpiKey, `kpis[${index}].kpiKey`);
  if (!KPI_KEYS.includes(kpiKey as KpiKey)) {
    throw new Error(`مؤشر غير معروف: ${kpiKey}`);
  }
  return {
    kpiKey: kpiKey as KpiKey,
    target: asNumber(value.target, `kpis[${index}].target`),
    weight: asNumber(value.weight, `kpis[${index}].weight`),
    unitAr: asString(value.unitAr, `kpis[${index}].unitAr`),
    sortOrder: asNumber(value.sortOrder, `kpis[${index}].sortOrder`),
  };
}

function parseHoliday(value: unknown, index: number): BackupHoliday {
  if (!isRecord(value)) throw new Error(`إجازة رقم ${index + 1} شكلها غلط`);
  const date = asString(value.date, `holidays[${index}].date`);
  if (!ISO_DATE_RE.test(date)) {
    throw new Error(`تاريخ إجازة غلط: ${date}`);
  }
  return { date, note: asOptionalString(value.note, `holidays[${index}].note`) };
}

function parseMonth(value: unknown, index: number): BackupMonth {
  if (!isRecord(value)) throw new Error(`إعداد شهر رقم ${index + 1} شكله غلط`);
  const yearMonth = asString(value.yearMonth, `months[${index}].yearMonth`);
  if (!YEAR_MONTH_RE.test(yearMonth)) {
    throw new Error(`شهر غير صالح: ${yearMonth}`);
  }
  if (!Array.isArray(value.kpis)) {
    throw new Error(`مؤشرات شهر ${yearMonth} ناقصة`);
  }
  if (!Array.isArray(value.holidays)) {
    throw new Error(`إجازات شهر ${yearMonth} ناقصة`);
  }
  return {
    yearMonth,
    fullCommission: asNumber(value.fullCommission, `months[${index}].fullCommission`),
    allowCommissionOver100: asBoolean(
      value.allowCommissionOver100,
      `months[${index}].allowCommissionOver100`,
    ),
    workingDays: parseWorkingDays(value.workingDays),
    kpis: value.kpis.map((item, kpiIndex) => parseKpi(item, kpiIndex)),
    holidays: value.holidays.map((item, holidayIndex) => parseHoliday(item, holidayIndex)),
  };
}

function parseEntry(value: unknown, index: number): BackupEntry {
  if (!isRecord(value)) throw new Error(`سجل رقم ${index + 1} شكله غلط`);
  const kpiKey = asString(value.kpiKey, `entries[${index}].kpiKey`);
  if (!KPI_KEYS.includes(kpiKey as KpiKey)) {
    throw new Error(`سجل بمؤشر غير معروف: ${kpiKey}`);
  }
  const entryDate = asString(value.entryDate, `entries[${index}].entryDate`);
  if (!ISO_DATE_RE.test(entryDate)) {
    throw new Error(`تاريخ سجل غلط: ${entryDate}`);
  }
  const rawQuantity = asNumber(value.quantity, `entries[${index}].quantity`);
  const quantityCheck = validateQuantity(kpiKey as KpiKey, rawQuantity);
  if (!quantityCheck.ok) {
    throw new Error(`سجل رقم ${index + 1} (${kpiKey}): ${quantityCheck.message}`);
  }
  const quantity = quantityCheck.value;
  const id = value.id === undefined ? undefined : asString(value.id, `entries[${index}].id`);
  const createdAt =
    value.createdAt === undefined ? undefined : asString(value.createdAt, `entries[${index}].createdAt`);
  return {
    id,
    kpiKey: kpiKey as KpiKey,
    quantity,
    entryDate,
    note: asOptionalString(value.note, `entries[${index}].note`),
    createdAt,
  };
}

function parseArticle(value: unknown, index: number): BackupArticle {
  if (!isRecord(value)) throw new Error(`مقال رقم ${index + 1} شكله غلط`);
  return {
    id: value.id === undefined ? undefined : asString(value.id, `articles[${index}].id`),
    title: asString(value.title, `articles[${index}].title`),
    content: asString(value.content, `articles[${index}].content`),
    createdAt:
      value.createdAt === undefined ? undefined : asString(value.createdAt, `articles[${index}].createdAt`),
    updatedAt:
      value.updatedAt === undefined ? undefined : asString(value.updatedAt, `articles[${index}].updatedAt`),
  };
}

export function parseBackup(raw: unknown): BackupFile {
  if (!isRecord(raw)) {
    throw new Error("ملف الاستعادة مش كائن JSON صحيح");
  }
  assertNoSecrets(raw, "root");
  const schemaVersion = asNumber(raw.schemaVersion, "schemaVersion");
  if (schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`إصدار الملف غير مدعوم (${schemaVersion})`);
  }
  if (!isRecord(raw.profile)) {
    throw new Error("الملف الشخصي ناقص");
  }
  if (!Array.isArray(raw.months) || !Array.isArray(raw.entries) || !Array.isArray(raw.articles)) {
    throw new Error("المخطط ناقص: لازم يحتوي على months و entries و articles");
  }
  const months = raw.months.map((item, index) => parseMonth(item, index));
  const monthKeys = new Set(months.map((item) => item.yearMonth));
  if (monthKeys.size !== months.length) {
    throw new Error("فيه إعدادات شهر مكررة في الملف");
  }
  const entries = raw.entries.map((item, index) => parseEntry(item, index));
  const articles = raw.articles.map((item, index) => parseArticle(item, index));
  const isEmptyFlag = typeof raw.isEmpty === "boolean" ? raw.isEmpty : months.length === 0 && entries.length === 0 && articles.length === 0;
  return {
    schemaVersion,
    exportedAt: asString(raw.exportedAt, "exportedAt"),
    isEmpty: isEmptyFlag,
    emptyReason: asOptionalString(raw.emptyReason, "emptyReason"),
    profile: {
      name: asString(raw.profile.name, "profile.name"),
      branch: asString(raw.profile.branch, "profile.branch"),
    },
    months,
    entries,
    articles,
  };
}

/**
 * توقيع السجل المستخدم في كشف التكرار أثناء الاستعادة بالدمج.
 * بنعتمد على (المؤشر + الكمية + التاريخ + الملاحظة) لأن الـ id بيتغير بين قواعد البيانات،
 * و createdAt ممكن يكون ناقص في ملفات قديمة.
 */
export function entrySignature(entry: {
  kpiKey: string;
  quantity: number;
  entryDate: string;
  note: string | null | undefined;
}): string {
  const note = (entry.note ?? "").trim();
  return `${entry.kpiKey}|${entry.quantity}|${entry.entryDate}|${note}`;
}

export type ExistingEntryLike = {
  id: string;
  kpiKey: string;
  quantity: number;
  entryDate: string;
  note: string | null;
};

export type EntryRestorePlan = {
  toInsert: BackupEntry[];
  skipped: BackupEntry[];
  entriesInserted: number;
  entriesSkipped: number;
};

/**
 * بيحدد أنهي سجلات من ملف النسخة هتتضاف فعلاً وأنهي هتتعدّى لأنها موجودة.
 *
 * القاعدة: لو السجل نفسه (بالـ id أو بالتوقيع) موجود في قاعدة البيانات، بيتعدّى.
 * التكرار المشروع (نفس المؤشر والكمية في نفس اليوم مرتين) محفوظ: لو الملف فيه
 * السجل مرتين والقاعدة فيها مرة واحدة، هيتضاف مرة واحدة بس عشان يبقوا اتنين.
 *
 * في وضع replace الجدول بيتمسح الأول، فمفيش سجلات موجودة والكل بيتضاف.
 */
export function planEntryRestore(
  incoming: BackupEntry[],
  existing: ExistingEntryLike[],
  mode: "merge" | "replace",
): EntryRestorePlan {
  if (mode === "replace" || existing.length === 0) {
    return {
      toInsert: [...incoming],
      skipped: [],
      entriesInserted: incoming.length,
      entriesSkipped: 0,
    };
  }

  const existingIds = new Set(existing.map((row) => row.id));
  const availableBySignature = new Map<string, number>();
  for (const row of existing) {
    const key = entrySignature(row);
    availableBySignature.set(key, (availableBySignature.get(key) ?? 0) + 1);
  }

  const toInsert: BackupEntry[] = [];
  const skipped: BackupEntry[] = [];

  for (const entry of incoming) {
    if (entry.id && existingIds.has(entry.id)) {
      skipped.push(entry);
      existingIds.delete(entry.id);
      const key = entrySignature(entry);
      const left = availableBySignature.get(key) ?? 0;
      if (left > 0) availableBySignature.set(key, left - 1);
      continue;
    }

    const key = entrySignature(entry);
    const left = availableBySignature.get(key) ?? 0;
    if (left > 0) {
      availableBySignature.set(key, left - 1);
      skipped.push(entry);
      continue;
    }

    toInsert.push(entry);
  }

  return {
    toInsert,
    skipped,
    entriesInserted: toInsert.length,
    entriesSkipped: skipped.length,
  };
}

export function backupSummary(backup: BackupFile) {
  return {
    profile: backup.profile,
    months: backup.months.length,
    kpis: backup.months.reduce((sum, month) => sum + month.kpis.length, 0),
    holidays: backup.months.reduce((sum, month) => sum + month.holidays.length, 0),
    entries: backup.entries.length,
    articles: backup.articles.length,
    isEmpty: backup.isEmpty,
    emptyReason: backup.emptyReason,
    exportedAt: backup.exportedAt,
    schemaVersion: backup.schemaVersion,
  };
}
