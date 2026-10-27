import { api } from "@/lib/client";
import { cloudRpc } from "@/lib/cloud";
import { cairoYearMonth } from "@/lib/dates";
import { readProfile } from "@/lib/local-api";

const BRANCH_KEY = "tys.branchId";

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
  kpis: { nameEn: string; achieved: number; target: number; percent: number; weight: number }[];
  todaySummary: { kpiKey: string; quantity: number; count: number }[];
};

/** معرّف ثابت للجهاز/الفرع، بيتولّد مرة واحدة ويتخزن. */
function branchId(): string {
  try {
    let id = localStorage.getItem(BRANCH_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(BRANCH_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

let running = false;

/** بيبعت ملخص الشهر الحالي للسيرفر. بيرجّع false لو ماتبعتش (مفيش نت أو خطأ). */
export async function pushReport(): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  const id = branchId();
  const profile = readProfile();
  if (!id || !profile.name.trim() || running) return false;

  running = true;
  try {
    const month = cairoYearMonth();
    const [data, settings, entriesResult] = await Promise.all([
      api<DashboardSnapshot>(`/api/dashboard?month=${month}`),
      api<{ settings: SettingsSnapshot }>(`/api/months/${month}`),
      api<{ entries: EntrySnapshot[] }>(`/api/entries?month=${month}`),
    ]);
    await cloudRpc("submit_report", {
      p_branch_id: id,
      p_employee: profile.name,
      p_branch: profile.branch,
      p_payload: {
        monthLabel: data.monthLabel,
        overall: data.overall,
        estimatedCommission: data.estimatedCommission,
        fullCommission: data.fullCommission,
        kpis: data.kpis.map((k) => ({ name: k.nameEn, achieved: k.achieved, target: k.target, percent: k.percent, weight: k.weight })),
        todaySummary: data.todaySummary.map((t) => ({ kpi: t.kpiKey, quantity: t.quantity, count: t.count })),
        settings: {
          fullCommission: settings.settings.fullCommission,
          kpis: settings.settings.kpis,
          holidays: settings.settings.holidays,
          workingDays: settings.settings.workingDays,
        },
        entries: entriesResult.entries.map((e) => ({
          date: e.entryDate,
          kpi: e.nameEn,
          quantity: e.quantity,
          unit: e.unitAr,
          note: e.note ?? "",
          at: e.id,
        })),
        syncedAt: new Date().toISOString(),
      },
    });
    return true;
  } catch {
    return false;
  } finally {
    running = false;
  }
}
