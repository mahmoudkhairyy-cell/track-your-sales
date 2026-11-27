import { api } from "@/lib/client";
import { managerApi } from "@/lib/cloud";
import { pushContracts } from "@/lib/contracts";
import { cairoYearMonth } from "@/lib/dates";
import { readProfile } from "@/lib/local-api";
import { AREA_MANAGERS, KPI_REPORT_NAMES, OUTSIDE_BRANCHES } from "@/lib/constants";
import type { KpiKey } from "@/lib/constants";

// معرّف تقرير مستقل لكل ملف موظف على نفس الجهاز؛ يمنع مستخدمًا من الكتابة فوق تقرير مستخدم آخر.
function reportStorageKey(profile: { name: string; branch: string; areaManager: string; role: string }): string {
  const identity = [profile.name.trim().toLocaleLowerCase(), profile.branch.trim(), profile.areaManager.trim(), profile.role].join("|");
  return `tys.branchId:${encodeURIComponent(identity)}`;
}

type EntrySnapshot = {
  id: string;
  kpiKey: string;
  quantity: number;
  entryDate: string;
  note: string | null;
  nameEn: string;
  unitAr: string;
};

type SettingsSnapshot = {
  saved: boolean;
  fullCommission: number;
  kpis: { kpiKey: string; target: number; weight: number; unitAr: string }[];
  holidays: { date: string; note?: string | null }[];
  workingDays: Record<string, boolean>;
};

type DashboardSnapshot = {
  monthLabel: string;
  overall: number;
  estimatedCommission: number;
  fullCommission: number;
  kpis: { kpiKey: string; nameEn: string; achieved: number; target: number; percent: number; weight: number; expectedToDate: number }[];
  work: { total: number; elapsed: number; elapsedBeforeToday?: number; remaining: number };
  todaySummary: { kpiKey: string; quantity: number; count: number }[];
};

/** معرّف ثابت للجهاز/الفرع، بيتولّد مرة واحدة ويتخزن. */
function branchId(profile: { name: string; branch: string; areaManager: string; role: string }): string {
  try {
    const key = reportStorageKey(profile);
    let id = localStorage.getItem(key);
    if (!id) {
      id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return "";
  }
}

let activeSync: Promise<boolean> | null = null;
let syncRequestedAgain = false;

export type SyncStatus = { ok: boolean; at: string; error?: string };
export const SYNC_STATUS_KEY = "tys.lastSync";

function saveStatus(status: SyncStatus) {
  try {
    localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(status));
    window.dispatchEvent(new Event("tys-sync-status"));
  } catch {
    // التخزين مش متاح، مفيش أكتر من كده.
  }
}

export function readSyncStatus(): SyncStatus | null {
  try {
    const raw = localStorage.getItem(SYNC_STATUS_KEY);
    return raw ? (JSON.parse(raw) as SyncStatus) : null;
  } catch {
    return null;
  }
}

/** محاولة واحدة لرفع أحدث ملخص محفوظ. */
async function pushReportOnce(): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    saveStatus({ ok: false, at: new Date().toISOString(), error: "مفيش نت" });
    return false;
  }

  const profile = readProfile();
  // مدير الفرع لا يرفع تقرير مبيعات شخصي؛ بياناته تدخل من لوحة الفرع المستقلة.
  if (profile.role === "manager") return false;
  // الموظف "خارج الفروع" مش بيظهر في لوحة المدير، فمايبعتش ملخصه.
  if (profile.branch === OUTSIDE_BRANCHES) return false;
  if (!profile.areaManager || !AREA_MANAGERS.includes(profile.areaManager as (typeof AREA_MANAGERS)[number])) {
    saveStatus({ ok: false, at: new Date().toISOString(), error: "اختار مدير المنطقة من صفحة بياناتك قبل المزامنة" });
    return false;
  }
  const id = branchId(profile);
  if (!id || !profile.name.trim() || !profile.branch.trim()) {
    saveStatus({ ok: false, at: new Date().toISOString(), error: "بيانات الموظف أو الفرع غير مكتملة" });
    return false;
  }

  try {
    const month = cairoYearMonth();
    const [data, settings, entriesResult] = await Promise.all([
      api<DashboardSnapshot>(`/api/dashboard?month=${month}`),
      api<{ settings: SettingsSnapshot }>(`/api/months/${month}`),
      api<{ entries: EntrySnapshot[] }>(`/api/entries?month=${month}`),
    ]);
    await managerApi("submit_report", {
      branchId: id,
      employee: profile.name,
      branch: profile.branch,
      payload: {
        role: profile.role,
        areaManager: profile.areaManager,
        monthLabel: data.monthLabel,
        yearMonth: month,
        overall: data.overall,
        estimatedCommission: data.estimatedCommission,
        fullCommission: data.fullCommission,
        expectedPercent: data.work.total > 0 ? ((data.work.elapsedBeforeToday ?? data.work.elapsed) / data.work.total) * 100 : 0,
        kpis: data.kpis.map((k) => ({
          name: KPI_REPORT_NAMES[k.kpiKey as KpiKey] ?? k.nameEn,
          achieved: k.achieved,
          target: k.target,
          percent: k.percent,
          weight: k.weight,
          expectedPercent: k.target > 0 ? (k.expectedToDate / k.target) * 100 : 0,
        })),
        todaySummary: data.todaySummary.map((t) => ({ kpi: t.kpiKey, quantity: t.quantity, count: t.count })),
        settings: {
          fullCommission: settings.settings.fullCommission,
          kpis: settings.settings.kpis,
          holidays: settings.settings.holidays,
          workingDays: settings.settings.workingDays,
        },
        entries: entriesResult.entries.map((e) => ({
          date: e.entryDate,
          kpi: KPI_REPORT_NAMES[e.kpiKey as KpiKey] ?? e.nameEn,
          quantity: e.quantity,
          unit: e.unitAr,
          // الملاحظات الشخصية ما بتتبعتش للسيرفر (مفيش شاشة بتعرضها للمستخدم).
          note: "",
          at: e.id,
        })),
        syncedAt: new Date().toISOString(),
      },
    });
    saveStatus({ ok: true, at: new Date().toISOString() });
    // التعاقدات بترفع مع نفس نبضة المزامنة؛ فشلها ما يوقفش تقرير الأداء.
    void pushContracts();
    return true;
  } catch (err) {
    saveStatus({ ok: false, at: new Date().toISOString(), error: err instanceof Error ? err.message.slice(0, 160) : "خطأ" });
    return false;
  }
}

/**
 * لو حصل طلب مزامنة أثناء رفع سابق، بنعلّم إن فيه تحديث أحدث ونرفع لقطة جديدة بعد انتهاء الحالي.
 * كده الضغطات/الحفظات المتتابعة مش بتضيع بسبب تجاهل الطلب أثناء running.
 */
export function pushReport(): Promise<boolean> {
  if (activeSync) {
    syncRequestedAgain = true;
    return activeSync;
  }

  activeSync = (async () => {
    let result = false;
    do {
      syncRequestedAgain = false;
      result = await pushReportOnce();
    } while (syncRequestedAgain);
    return result;
  })().finally(() => {
    activeSync = null;
    // يغطي طلبًا وصل في آخر لحظة بعد انتهاء دورة العامل وقبل تنظيف الوعد.
    if (syncRequestedAgain) void pushReport();
  });

  return activeSync;
}
