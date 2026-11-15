import { planEntryRestore, type BackupFile } from "@/lib/backup";
import type { WorkingDays } from "@/lib/types";

/**
 * منطق الاستعادة بدون تخزين: بياخد الحالة ويعدّلها في الذاكرة.
 * ده عشان نقدر نختبره من غير localStorage. التخزين نفسه بيتعمل في local-api.
 */

export type RestoreMode = "merge" | "replace";

export type RestoreEntry = {
  id: string;
  kpiKey: string;
  quantity: number;
  entryDate: string;
  note: string | null;
  createdAt: string;
};

export type RestoreArticle = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type RestoreMonth = {
  fullCommission: number;
  workingDays: WorkingDays;
  kpis: unknown[];
  holidays: unknown[];
  quality?: unknown;
};

export type RestoreState = {
  profile: { name: string; branch: string };
  entries: RestoreEntry[];
  months: Record<string, RestoreMonth>;
  articles: RestoreArticle[];
};

export type RestoreOptions = {
  newId: () => string;
  now: () => string;
  qualityFromChecks: (checks: unknown) => unknown;
  /** بيتنادى قبل أي مسح في وضع الاستبدال، ومعاه نسخة من الحالة القديمة. */
  beforeReplace?: (snapshot: string) => void;
};

export type RestoreResult = {
  entriesInserted: number;
  entriesSkipped: number;
  monthsSkipped: number;
  articlesSkipped: number;
};

/** بيتحقق من طلب الاستعادة (نوع الوضع والتأكيد) قبل أي تعديل. */
export function checkRestoreRequest(data: { mode?: unknown; confirmReplace?: unknown }):
  | { ok: true; mode: RestoreMode }
  | { ok: false; message: string } {
  const mode = data.mode === "replace" ? "replace" : data.mode === "merge" ? "merge" : null;
  if (!mode) return { ok: false, message: "اختار نوع الاستعادة: دمج أو استبدال" };
  if (mode === "replace" && data.confirmReplace !== true) {
    return { ok: false, message: "الاستبدال محتاج تأكيد صريح بعد تحميل نسخة احتياطية" };
  }
  return { ok: true, mode };
}

export function applyBackupToState(
  state: RestoreState,
  backup: BackupFile,
  mode: RestoreMode,
  options: RestoreOptions,
): RestoreResult {
  if (mode === "replace") {
    options.beforeReplace?.(JSON.stringify(state));
  }

  state.profile = { ...state.profile, name: backup.profile.name, branch: backup.profile.branch };
  if (mode === "replace") {
    state.entries = [];
    state.articles = [];
    state.months = {};
  }

  let monthsSkipped = 0;
  for (const month of backup.months) {
    // في الدمج ما نكتبش فوق شهر موجود: إعدادات الشهر الحالي أولى، والتعارض بيتعرض للمستخدم.
    if (mode === "merge" && state.months[month.yearMonth]) {
      monthsSkipped += 1;
      continue;
    }
    state.months[month.yearMonth] = {
      fullCommission: month.fullCommission,
      workingDays: month.workingDays,
      kpis: month.kpis.map((kpi, index) => ({ ...kpi, sortOrder: kpi.sortOrder ?? index })),
      holidays: month.holidays.map((item) => ({ date: item.date, note: item.note })),
      quality: month.quality
        ? options.qualityFromChecks(month.quality.checks)
        : state.months[month.yearMonth]?.quality,
    };
  }

  const existing = mode === "merge"
    ? state.entries.map((item) => ({
        id: item.id,
        kpiKey: item.kpiKey,
        quantity: item.quantity,
        entryDate: item.entryDate,
        note: item.note,
      }))
    : [];
  const plan = planEntryRestore(backup.entries, existing as never, mode);
  // نحافظ على معرّف السجل من النسخة لو مش مستخدم، عشان الاستعادة المتكررة تتعدّى بالـ id.
  const usedEntryIds = new Set(state.entries.map((row) => row.id));
  for (const entry of plan.toInsert) {
    const item = entry as unknown as {
      id?: string;
      kpiKey: string;
      quantity: number;
      entryDate: string;
      note: string | null;
      createdAt?: string;
    };
    const keepId = typeof item.id === "string" && item.id.length > 0 && !usedEntryIds.has(item.id);
    const id = keepId ? (item.id as string) : options.newId();
    usedEntryIds.add(id);
    state.entries.push({
      id,
      kpiKey: item.kpiKey,
      quantity: item.quantity,
      entryDate: item.entryDate,
      note: item.note ?? null,
      createdAt: item.createdAt ?? options.now(),
    });
  }

  let articlesSkipped = 0;
  for (const article of backup.articles) {
    const item = article as unknown as { title: string; content: string; createdAt?: string; updatedAt?: string };
    const now = options.now();
    // مقالة بنفس العنوان والمحتوى موجودة بالفعل: ما نكرروهاش.
    if (state.articles.some((row) => row.title === item.title && row.content === item.content)) {
      articlesSkipped += 1;
      continue;
    }
    state.articles.push({
      id: options.newId(),
      title: item.title,
      content: item.content,
      createdAt: item.createdAt ?? now,
      updatedAt: item.updatedAt ?? now,
    });
  }

  return {
    entriesInserted: plan.entriesInserted,
    entriesSkipped: plan.entriesSkipped,
    monthsSkipped,
    articlesSkipped,
  };
}
