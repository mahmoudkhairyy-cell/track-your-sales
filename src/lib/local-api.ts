/**
 * طبقة الحفظ المحلية: كل البيانات بتتحفظ في متصفح الموبايل (localStorage).
 * الصفحات بتكلم "/api/..." زي ما كانت، وهنا بنرد عليها محلياً بنفس الشكل.
 */
import {
  DEFAULT_COMMISSION,
  DEFAULT_WORKING_DAYS,
  ISO_DATE_RE,
  KPI_CATALOG,
  KPI_KEYS,
  SCHEMA_VERSION,
  YEAR_MONTH_RE,
  type KpiKey,
} from "@/lib/constants";
import {
  achievementPercent,
  buildWorkdayStats,
  catalogByKey,
  computeOverall,
  estimatedCommission,
  expectedToDate,
  formatPercent,
  kpiContribution,
  newLinesDailyNeed,
  sumWeights,
} from "@/lib/calculations";
import { cairoISODate, cairoYearMonth, monthDateRange, monthLabelAr } from "@/lib/dates";
import { validateQuantity } from "@/lib/quantity";
import { backupSummary, parseBackup, planEntryRestore, type BackupFile } from "@/lib/backup";
import type { WorkingDays } from "@/lib/types";

const STORAGE_KEY = "trackYourSales.local.v1";

type Entry = {
  id: string;
  kpiKey: string;
  quantity: number;
  entryDate: string;
  note: string | null;
  createdAt: string;
};

type Article = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type KpiRow = {
  kpiKey: KpiKey;
  target: number;
  weight: number;
  unitAr: string;
  sortOrder: number;
};

type Holiday = { date: string; note: string | null };

type MonthRow = {
  fullCommission: number;
  allowCommissionOver100: boolean;
  workingDays: WorkingDays;
  kpis: KpiRow[];
  holidays: Holiday[];
};

type Profile = { name: string; branch: string; role: string };

type State = {
  profile: Profile;
  entries: Entry[];
  months: Record<string, MonthRow>;
  articles: Article[];
};

type Bundle = {
  saved: boolean;
  yearMonth: string;
  fullCommission: number;
  allowCommissionOver100: boolean;
  workingDays: WorkingDays;
  kpis: KpiRow[];
  holidays: Holiday[];
  monthSettingsId: null;
};

class LocalError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function fail(status: number, message: string): never {
  throw new LocalError(status, message);
}

function emptyState(): State {
  return {
    profile: { name: "", branch: "", role: "user" },
    entries: [],
    months: {},
    articles: [],
  };
}

function loadState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<State>;
    return { ...emptyState(), ...parsed };
  } catch {
    return emptyState();
  }
}

function saveState(state: State) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // لو المتصفح منعنا من الحفظ، نبلغ المستخدم عشان ما يفتكرش إن الإنجاز اتحفظ.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("tys-storage-error"));
    }
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ---------- قراءة الملف الشخصي (بيستخدمه الشريط الجانبي) ---------- */

export function readProfile(): { name: string; branch: string } {
  const state = loadState();
  return { name: state.profile.name, branch: state.profile.branch };
}

/* ---------- تحقق من المدخلات ---------- */

function requireYearMonth(value: unknown): string {
  if (typeof value !== "string" || !YEAR_MONTH_RE.test(value)) {
    fail(400, "اختار شهر بصيغة صحيحة زي 2026-03");
  }
  return value as string;
}

function requireKpiKey(value: unknown): KpiKey {
  if (typeof value !== "string" || !KPI_KEYS.includes(value as KpiKey)) {
    fail(400, "المؤشر المختار مش معروف");
  }
  return value as KpiKey;
}

function requireIsoDate(value: unknown, label = "التاريخ"): string {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) {
    fail(400, `${label} مش تاريخ صالح`);
  }
  const text = value as string;
  const [year, month, day] = text.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    fail(400, `${label} مش تاريخ موجود في التقويم`);
  }
  if (year < 2020 || year > 2040) {
    fail(400, `${label} خارج المدى المسموح`);
  }
  return text;
}

function requireQuantity(kpiKey: KpiKey, value: unknown): number {
  const result = validateQuantity(kpiKey, value);
  if (!result.ok) fail(400, result.message);
  return result.value;
}

function optionalNote(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") fail(400, "الملاحظة لازم تكون نص");
  const text = (value as string).trim();
  if (text.length > 500) fail(400, "الملاحظة أطول من 500 حرف");
  return text || null;
}

function trimText(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string") fail(400, `${field} مطلوب`);
  const text = (value as string).trim();
  if (text.length < min) fail(400, `${field} قصير جدًا`);
  if (text.length > max) fail(400, `${field} أطول من المسموح`);
  return text;
}

function requireWorkingDays(value: unknown): WorkingDays {
  if (!value || typeof value !== "object") fail(400, "أيام العمل ناقصة");
  const record = value as Record<string, unknown>;
  const keys: (keyof WorkingDays)[] = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"];
  const result = {} as WorkingDays;
  for (const key of keys) {
    if (typeof record[key] !== "boolean") fail(400, "أيام العمل مش مكتملة");
    result[key] = record[key] as boolean;
  }
  return result;
}

/* ---------- بناء الشهر والسجلات ---------- */

function defaultBundle(yearMonth: string): Bundle {
  return {
    saved: false,
    yearMonth,
    fullCommission: DEFAULT_COMMISSION,
    allowCommissionOver100: false,
    workingDays: { ...DEFAULT_WORKING_DAYS },
    kpis: KPI_CATALOG.map((kpi, index) => ({
      kpiKey: kpi.key,
      target: kpi.defaultTarget,
      weight: kpi.defaultWeight,
      unitAr: kpi.unitAr,
      sortOrder: index,
    })),
    holidays: [],
    monthSettingsId: null,
  };
}

function loadBundle(state: State, yearMonth: string): Bundle {
  const row = state.months[yearMonth];
  if (!row) return defaultBundle(yearMonth);

  const savedMap = new Map(row.kpis.map((item) => [item.kpiKey, item]));
  const kpis = KPI_CATALOG.map((kpi, index) => {
    const saved = savedMap.get(kpi.key);
    return {
      kpiKey: kpi.key,
      target: saved?.target ?? kpi.defaultTarget,
      weight: saved?.weight ?? kpi.defaultWeight,
      unitAr: saved?.unitAr ?? kpi.unitAr,
      sortOrder: saved?.sortOrder ?? index,
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    saved: true,
    yearMonth,
    fullCommission: row.fullCommission,
    allowCommissionOver100: row.allowCommissionOver100,
    workingDays: row.workingDays,
    kpis,
    holidays: [...row.holidays].sort((a, b) => a.date.localeCompare(b.date)),
    monthSettingsId: null,
  };
}

function enrichEntry(entry: Entry) {
  const catalog = catalogByKey(entry.kpiKey);
  return {
    ...entry,
    nameEn: catalog?.nameEn ?? entry.kpiKey,
    nameAr: catalog?.nameAr ?? entry.kpiKey,
    unitAr: catalog?.unitAr ?? "",
  };
}

function entriesInMonth(state: State, yearMonth: string): Entry[] {
  const { start, end } = monthDateRange(yearMonth);
  return state.entries
    .filter((entry) => entry.entryDate >= start && entry.entryDate <= end)
    .sort((a, b) => {
      if (a.entryDate !== b.entryDate) return a.entryDate < b.entryDate ? 1 : -1;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
}

/* ---------- المسارات ---------- */

function getEntries(state: State, params: URLSearchParams) {
  const raw = params.get("month");
  const yearMonth = requireYearMonth(raw || cairoYearMonth());
  const rows = entriesInMonth(state, yearMonth);
  return {
    yearMonth,
    entries: rows.map(enrichEntry),
    count: rows.length,
  };
}

function createEntry(state: State, data: Record<string, unknown>) {
  const kpiKey = requireKpiKey(data.kpiKey);
  const quantity = requireQuantity(kpiKey, data.quantity);
  const entryDate = requireIsoDate(data.entryDate, "تاريخ الإنجاز");
  const note = optionalNote(data.note);
  const entry: Entry = {
    id: newId(),
    kpiKey,
    quantity,
    entryDate,
    note,
    createdAt: new Date().toISOString(),
  };
  state.entries.push(entry);
  return { message: "✅ اتسجل! عاش يا بطل", entry: enrichEntry(entry) };
}

function updateEntry(state: State, id: string, data: Record<string, unknown>) {
  const index = state.entries.findIndex((item) => item.id === id);
  if (index === -1) fail(404, "السجل مش موجود أو مش من حسابك");
  const current = state.entries[index];

  const kpiKey = data.kpiKey === undefined ? requireKpiKey(current.kpiKey) : requireKpiKey(data.kpiKey);
  const quantity = requireQuantity(kpiKey, data.quantity === undefined ? current.quantity : data.quantity);
  const entryDate =
    data.entryDate === undefined ? current.entryDate : requireIsoDate(data.entryDate, "تاريخ الإنجاز");
  const note = data.note === undefined ? current.note : optionalNote(data.note);

  const updated: Entry = { ...current, kpiKey, quantity, entryDate, note };
  state.entries[index] = updated;
  return { message: "✏️ السجل اتعدل", entry: enrichEntry(updated) };
}

function deleteEntry(state: State, id: string) {
  const before = state.entries.length;
  state.entries = state.entries.filter((item) => item.id !== id);
  if (state.entries.length === before) fail(404, "السجل مش موجود أو مش من حسابك");
  return { message: "🗑️ السجل اتشال", id };
}

function getMonth(state: State, yearMonth: string) {
  const bundle = loadBundle(state, yearMonth);
  return { settings: bundle, weightSum: sumWeights(bundle.kpis) };
}

function putMonth(state: State, yearMonth: string, data: Record<string, unknown>) {
  const fullCommission = Number(data.fullCommission);
  if (!Number.isFinite(fullCommission) || fullCommission < 0) {
    fail(400, "الكوميشن الكامل لازم يكون رقم صفر أو أكبر");
  }
  const allowCommissionOver100 = Boolean(data.allowCommissionOver100);
  const workingDays = requireWorkingDays(data.workingDays);
  if (!Array.isArray(data.kpis)) fail(400, "الإيتمز ناقصة");
  if (!Array.isArray(data.holidays)) fail(400, "قائمة الإجازات ناقصة");

  const kpis: KpiRow[] = (data.kpis as unknown[]).map((item, index) => {
    if (!item || typeof item !== "object") fail(400, `مؤشر رقم ${index + 1} شكله غلط`);
    const row = item as Record<string, unknown>;
    const kpiKey = row.kpiKey;
    if (typeof kpiKey !== "string" || !KPI_CATALOG.some((kpi) => kpi.key === kpiKey)) {
      fail(400, "فيه إيتم مش معروف");
    }
    const target = Number(row.target);
    const weight = Number(row.weight);
    if (!Number.isFinite(target) || target < 0) fail(400, `تارجت ${kpiKey} غير صالح`);
    if (!Number.isFinite(weight) || weight < 0) fail(400, `وزن ${kpiKey} غير صالح`);
    const catalog = KPI_CATALOG.find((kpi) => kpi.key === kpiKey)!;
    return {
      kpiKey: kpiKey as KpiKey,
      target,
      weight,
      unitAr: typeof row.unitAr === "string" && row.unitAr.trim() ? row.unitAr.trim() : catalog.unitAr,
      sortOrder: index,
    };
  });
  if (kpis.length !== KPI_CATALOG.length) fail(400, "لازم تحفظ كل الإيتمز");

  const { start, end } = monthDateRange(yearMonth);
  const holidays: Holiday[] = (data.holidays as unknown[]).map((item, index) => {
    if (!item || typeof item !== "object") fail(400, `إجازة رقم ${index + 1} شكلها غلط`);
    const row = item as Record<string, unknown>;
    const date = requireIsoDate(row.date, "تاريخ الإجازة");
    if (date < start || date > end) fail(400, `الإجازة ${date} مش في الشهر المختار`);
    return { date, note: optionalNote(row.note) };
  });
  if (new Set(holidays.map((item) => item.date)).size !== holidays.length) {
    fail(400, "فيه تاريخ إجازة متكرر");
  }

  state.months[yearMonth] = { fullCommission, allowCommissionOver100, workingDays, kpis, holidays };
  const bundle = loadBundle(state, yearMonth);
  return {
    message: "✅ إعدادات الشهر اتحفظت",
    settings: bundle,
    weightSum: sumWeights(bundle.kpis),
    id: yearMonth,
  };
}

function clearMonth(state: State, yearMonth: string, data: Record<string, unknown>) {
  const confirmMonth = typeof data.confirmMonth === "string" ? data.confirmMonth : "";
  if (confirmMonth !== yearMonth) fail(400, `للتأكيد اكتب رمز الشهر ${yearMonth}`);
  const inMonth = entriesInMonth(state, yearMonth);
  const ids = new Set(inMonth.map((item) => item.id));
  state.entries = state.entries.filter((item) => !ids.has(item.id));
  return {
    message: `تم مسح ${ids.size} سجل من ${monthLabelAr(yearMonth)}`,
    deleted: ids.size,
    expected: inMonth.length,
    yearMonth,
  };
}

function listArticles(state: State) {
  const rows = [...state.articles].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return { articles: rows, count: rows.length, empty: rows.length === 0 };
}

function createArticle(state: State, data: Record<string, unknown>) {
  const title = trimText(data.title, "عنوان المقال", 2, 160);
  const content = trimText(data.content, "محتوى المقال", 2, 8000);
  const now = new Date().toISOString();
  const article: Article = { id: newId(), title, content, createdAt: now, updatedAt: now };
  state.articles.push(article);
  return { message: "✅ الملاحظة اتضافت", article };
}

function updateArticle(state: State, id: string, data: Record<string, unknown>) {
  const index = state.articles.findIndex((item) => item.id === id);
  if (index === -1) fail(404, "الملاحظة مش موجودة أو مش من حسابك");
  const title = trimText(data.title, "عنوان المقال", 2, 160);
  const content = trimText(data.content, "محتوى المقال", 2, 8000);
  const updated: Article = { ...state.articles[index], title, content, updatedAt: new Date().toISOString() };
  state.articles[index] = updated;
  return { message: "✅ الملاحظة اتعدلت", article: updated };
}

function deleteArticle(state: State, id: string) {
  const before = state.articles.length;
  state.articles = state.articles.filter((item) => item.id !== id);
  if (state.articles.length === before) fail(404, "الملاحظة مش موجودة أو مش من حسابك");
  return { message: "🗑️ الملاحظة اتشالت", id };
}

function updateProfile(state: State, data: Record<string, unknown>) {
  const name = trimText(data.name, "اسم الموظف", 2, 80);
  const branch = trimText(data.branch, "الفرع", 2, 80);
  state.profile = { ...state.profile, name, branch };
  return { user: { id: "local", name, branch, role: state.profile.role }, message: "✅ بياناتك اتحدثت" };
}

function getDashboard(state: State, params: URLSearchParams) {
  const raw = params.get("month");
  const yearMonth = raw ? requireYearMonth(raw) : cairoYearMonth();
  const today = cairoISODate();
  const bundle = loadBundle(state, yearMonth);
  const monthEntries = entriesInMonth(state, yearMonth);

  const achieved: Record<string, number> = {};
  for (const kpi of KPI_CATALOG) achieved[kpi.key] = 0;
  for (const entry of monthEntries) {
    achieved[entry.kpiKey] = (achieved[entry.kpiKey] ?? 0) + entry.quantity;
  }
  const achievedTyped = achieved as Record<KpiKey, number>;

  const holidayDates = bundle.holidays.map((item) => item.date);
  const work = buildWorkdayStats(yearMonth, bundle.workingDays, holidayDates, today);
  const overall = computeOverall(bundle.kpis, achievedTyped);
  const commission = estimatedCommission(bundle.fullCommission, overall, bundle.allowCommissionOver100);
  const weightSum = sumWeights(bundle.kpis);
  const newLines = bundle.kpis.find((kpi) => kpi.kpiKey === "new_lines");
  const pace = newLinesDailyNeed(newLines?.target ?? 175, achieved.new_lines ?? 0, work.remaining);

  const todayEntries = monthEntries.filter((entry) => entry.entryDate === today);
  const todaySummary = KPI_CATALOG.map((kpi) => {
    const rows = todayEntries.filter((entry) => entry.kpiKey === kpi.key);
    return {
      kpiKey: kpi.key,
      nameEn: kpi.nameEn,
      nameAr: kpi.nameAr,
      unitAr: kpi.unitAr,
      quantity: rows.reduce((sum, entry) => sum + entry.quantity, 0),
      count: rows.length,
    };
  });

  const kpis = bundle.kpis.map((kpi) => {
    const catalog = KPI_CATALOG.find((item) => item.key === kpi.kpiKey)!;
    const value = achieved[kpi.kpiKey] ?? 0;
    return {
      ...kpi,
      nameEn: catalog.nameEn,
      nameAr: catalog.nameAr,
      achieved: value,
      percent: achievementPercent(value, kpi.target),
      contribution: kpiContribution(value, kpi.target, kpi.weight),
      expectedToDate: expectedToDate(kpi.target, work.elapsed, work.total),
      remaining: Math.max(0, kpi.target - value),
      overTarget: value > kpi.target,
    };
  });

  return {
    profile: { name: state.profile.name, branch: state.profile.branch, role: state.profile.role },
    yearMonth,
    monthLabel: monthLabelAr(yearMonth),
    today,
    settingsSaved: bundle.saved,
    fullCommission: bundle.fullCommission,
    allowCommissionOver100: bundle.allowCommissionOver100,
    workingDays: bundle.workingDays,
    holidays: bundle.holidays,
    work,
    kpis,
    overall,
    overallLabel: formatPercent(overall),
    estimatedCommission: commission,
    weightSum,
    weightWarning: Math.abs(weightSum - 100) > 0.01,
    pace,
    todaySummary,
    entriesCount: monthEntries.length,
    empty: monthEntries.length === 0,
    hasAnySavedData: bundle.saved || monthEntries.length > 0,
  };
}

function exportBackup(state: State) {
  const months = Object.entries(state.months).map(([yearMonth, row]) => ({
    yearMonth,
    fullCommission: row.fullCommission,
    allowCommissionOver100: row.allowCommissionOver100,
    workingDays: row.workingDays,
    kpis: loadBundle(state, yearMonth).kpis,
    holidays: row.holidays.map((item) => ({ date: item.date, note: item.note })),
  }));
  const isEmpty = months.length === 0 && state.entries.length === 0 && state.articles.length === 0;
  const backup = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    isEmpty,
    emptyReason: isEmpty ? "لا توجد سجلات إنجاز ولا إعدادات شهور محفوظة ولا مقالات" : null,
    profile: { name: state.profile.name, branch: state.profile.branch },
    months,
    entries: state.entries.map((row) => ({
      id: row.id,
      kpiKey: row.kpiKey as KpiKey,
      quantity: row.quantity,
      entryDate: row.entryDate,
      note: row.note,
      createdAt: row.createdAt,
    })),
    articles: state.articles.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
  } as unknown as BackupFile;

  return {
    backup,
    summary: backupSummary(backup),
    message: isEmpty
      ? "الملف اتنزّل وفيه الملف الشخصي فقط من غير سجلات محفوظة"
      : "تم تجهيز النسخة الاحتياطية",
  };
}

function restoreBackup(state: State, data: Record<string, unknown>) {
  let backup: BackupFile;
  try {
    backup = parseBackup(data.backup);
  } catch (error) {
    fail(400, error instanceof Error ? error.message : "ملف الاستعادة غير صالح");
  }
  const summary = backupSummary(backup);
  if (Boolean(data.dryRun)) {
    return { summary, message: "الملف مطابق للمخطط. مفيش أي تعديل اتعمل لسه." };
  }

  const mode = data.mode === "replace" ? "replace" : data.mode === "merge" ? "merge" : null;
  if (!mode) fail(400, "اختار نوع الاستعادة: دمج أو استبدال");
  if (mode === "replace" && data.confirmReplace !== true) {
    fail(400, "الاستبدال محتاج تأكيد صريح بعد تحميل نسخة احتياطية");
  }

  state.profile = { ...state.profile, name: backup.profile.name, branch: backup.profile.branch };
  if (mode === "replace") {
    state.entries = [];
    state.articles = [];
    state.months = {};
  }

  for (const month of backup.months) {
    state.months[month.yearMonth] = {
      fullCommission: month.fullCommission,
      allowCommissionOver100: month.allowCommissionOver100,
      workingDays: month.workingDays,
      kpis: month.kpis.map((kpi, index) => ({ ...kpi, sortOrder: kpi.sortOrder ?? index })),
      holidays: month.holidays.map((item) => ({ date: item.date, note: item.note })),
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
  for (const entry of plan.toInsert) {
    const item = entry as unknown as {
      kpiKey: string;
      quantity: number;
      entryDate: string;
      note: string | null;
      createdAt?: string;
    };
    state.entries.push({
      id: newId(),
      kpiKey: item.kpiKey,
      quantity: item.quantity,
      entryDate: item.entryDate,
      note: item.note ?? null,
      createdAt: item.createdAt ?? new Date().toISOString(),
    });
  }

  for (const article of backup.articles) {
    const item = article as unknown as { title: string; content: string; createdAt?: string; updatedAt?: string };
    const now = new Date().toISOString();
    state.articles.push({
      id: newId(),
      title: item.title,
      content: item.content,
      createdAt: item.createdAt ?? now,
      updatedAt: item.updatedAt ?? now,
    });
  }

  return {
    summary,
    entriesInserted: plan.entriesInserted,
    entriesSkipped: plan.entriesSkipped,
    message: `✅ تمت الاستعادة. سجلات مضافة: ${plan.entriesInserted}، متخطاة: ${plan.entriesSkipped}`,
  };
}

/* ---------- نقطة الدخول ---------- */

export type LocalResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: number; message: string };

export function runLocalApi(url: string, method: string, body: unknown): LocalResult {
  const [pathname, query = ""] = url.split("?");
  const params = new URLSearchParams(query);
  const data = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const verb = method.toUpperCase();
  const state = loadState();

  try {
    let result: Record<string, unknown>;
    let changed = false;

    if (pathname === "/api/health") {
      result = { ok: true };
    } else if (pathname === "/api/entries") {
      if (verb === "GET") {
        result = getEntries(state, params);
      } else if (verb === "POST") {
        result = createEntry(state, data);
        changed = true;
      } else fail(405, "الطريقة دي مش مدعومة");
    } else if (pathname.startsWith("/api/entries/")) {
      const id = pathname.slice("/api/entries/".length);
      if (verb === "PATCH") {
        result = updateEntry(state, id, data);
        changed = true;
      } else if (verb === "DELETE") {
        result = deleteEntry(state, id);
        changed = true;
      } else fail(405, "الطريقة دي مش مدعومة");
    } else if (pathname.startsWith("/api/months/")) {
      const rest = pathname.slice("/api/months/".length).split("/");
      const yearMonth = requireYearMonth(rest[0]);
      if (rest[1] === "clear") {
        result = clearMonth(state, yearMonth, data);
        changed = true;
      } else if (verb === "GET") {
        result = getMonth(state, yearMonth);
      } else if (verb === "PUT") {
        result = putMonth(state, yearMonth, data);
        changed = true;
      } else fail(405, "الطريقة دي مش مدعومة");
    } else if (pathname === "/api/wiki") {
      if (verb === "GET") {
        result = listArticles(state);
      } else if (verb === "POST") {
        result = createArticle(state, data);
        changed = true;
      } else fail(405, "الطريقة دي مش مدعومة");
    } else if (pathname.startsWith("/api/wiki/")) {
      const id = pathname.slice("/api/wiki/".length);
      if (verb === "PATCH") {
        result = updateArticle(state, id, data);
        changed = true;
      } else if (verb === "DELETE") {
        result = deleteArticle(state, id);
        changed = true;
      } else fail(405, "الطريقة دي مش مدعومة");
    } else if (pathname === "/api/profile") {
      if (verb !== "PATCH") fail(405, "الطريقة دي مش مدعومة");
      result = updateProfile(state, data);
      changed = true;
    } else if (pathname === "/api/dashboard") {
      result = getDashboard(state, params);
    } else if (pathname === "/api/backup/export") {
      result = exportBackup(state);
    } else if (pathname === "/api/backup/restore") {
      result = restoreBackup(state, data);
      changed = true;
    } else {
      fail(404, "المسار ده مش موجود");
    }

    if (changed) saveState(state);
    return { ok: true, data: { ok: true, ...result } };
  } catch (error) {
    if (error instanceof LocalError) {
      return { ok: false, status: error.status, message: error.message };
    }
    return { ok: false, status: 500, message: "حصل خطأ غير متوقع" };
  }
}
