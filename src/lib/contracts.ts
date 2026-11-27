import { managerApi } from "@/lib/cloud";
import { readProfile } from "@/lib/local-api";
import { AREA_MANAGERS, OUTSIDE_BRANCHES } from "@/lib/constants";

// التعاقدات: الموظف يسجّل كل تعاقد محليًا على جهازه، والمزامنة ترفعه
// للسحابة عشان مدير الفرع ومدير المنطقة يتابعوا الحالات.

export type ContractStatus = "sent" | "missing" | "rejected";

export type ContractItem = {
  id: string;
  client: string;
  status: ContractStatus;
  contractDate: string; // YYYY-MM-DD
  sentDate: string | null; // YYYY-MM-DD
  note: string;
  updatedAt: number;
};

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  sent: "اتبعت للشركة",
  missing: "ناقص",
  rejected: "مرفوض",
};

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch { /* التخزين غير متاح. */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function createContractId(): string {
  return newId();
}

function listKey(branchId: string): string {
  return `tys.contracts.${branchId}`;
}

function deletedKey(branchId: string): string {
  return `tys.contracts.deleted.${branchId}`;
}

export function readContracts(branchId: string): ContractItem[] {
  try {
    const raw = localStorage.getItem(listKey(branchId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ContractItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.id === "string" && typeof item.client === "string");
  } catch {
    return [];
  }
}

export function writeContracts(branchId: string, items: ContractItem[]) {
  try {
    localStorage.setItem(listKey(branchId), JSON.stringify(items));
  } catch { /* التخزين غير متاح. */ }
}

export function readDeletedContracts(branchId: string): string[] {
  try {
    const raw = localStorage.getItem(deletedKey(branchId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function markContractDeleted(branchId: string, id: string) {
  const current = readDeletedContracts(branchId);
  if (!current.includes(id)) {
    try { localStorage.setItem(deletedKey(branchId), JSON.stringify([...current, id])); } catch { /* التخزين غير متاح. */ }
  }
}

function clearDeletedContracts(branchId: string) {
  try { localStorage.removeItem(deletedKey(branchId)); } catch { /* التخزين غير متاح. */ }
}

/* ---------- حالة مزامنة التعاقدات (تظهر للمستخدم بدل ما الفشل يعدي في صمت) ---------- */

export type ContractsSyncStatus = { ok: boolean; at: string; error?: string };
export const CONTRACTS_SYNC_STATUS_KEY = "tys.lastContractsSync";

function saveContractsSyncStatus(status: ContractsSyncStatus) {
  try {
    localStorage.setItem(CONTRACTS_SYNC_STATUS_KEY, JSON.stringify(status));
    window.dispatchEvent(new Event("tys-contracts-sync-status"));
  } catch {
    // التخزين مش متاح، مفيش أكتر من كده.
  }
}

export function readContractsSyncStatus(): ContractsSyncStatus | null {
  try {
    const raw = localStorage.getItem(CONTRACTS_SYNC_STATUS_KEY);
    return raw ? (JSON.parse(raw) as ContractsSyncStatus) : null;
  } catch {
    return null;
  }
}

/** هوية الجهاز/الملف — نفس معرّف تقرير الفرع عشان الملكية تطابق submit_report. */
export function contractsBranchId(): string {
  // المعرّف بيتولّد ويتخزن في sync.ts؛ بنعيد استخدامه هنا عشان التعاقد
  // يتنسب لنفس هوية التقرير.
  try {
    const profile = readProfile();
    const identity = [profile.name.trim().toLocaleLowerCase(), profile.branch.trim(), profile.areaManager.trim(), profile.role].join("|");
    const key = `tys.branchId:${encodeURIComponent(identity)}`;
    let id = localStorage.getItem(key);
    if (!id) {
      id = newId();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return "";
  }
}

/** يرفع تعاقدات الجهاز للسحابة. بيرجع true لو الرفع نجح. */
export async function pushContracts(): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    saveContractsSyncStatus({ ok: false, at: new Date().toISOString(), error: "مفيش نت" });
    return false;
  }
  const profile = readProfile();
  // مدير الفرع مش بيسجّل تعاقدات بنفسه من التطبيق.
  if (profile.role === "manager") return false;
  if (profile.branch === OUTSIDE_BRANCHES) return false;
  if (!profile.areaManager || !AREA_MANAGERS.includes(profile.areaManager as (typeof AREA_MANAGERS)[number])) {
    saveContractsSyncStatus({ ok: false, at: new Date().toISOString(), error: "اختار مدير المنطقة من صفحة بياناتك قبل المزامنة" });
    return false;
  }
  const id = contractsBranchId();
  if (!id || !profile.name.trim() || !profile.branch.trim()) {
    saveContractsSyncStatus({ ok: false, at: new Date().toISOString(), error: "بيانات الموظف أو الفرع غير مكتملة" });
    return false;
  }

  const items = readContracts(id);
  const deletedIds = readDeletedContracts(id);
  try {
    await managerApi("submit_contracts", {
      branchId: id,
      employee: profile.name,
      branch: profile.branch,
      areaManager: profile.areaManager,
      contracts: items.map((item) => ({
        id: item.id,
        client: item.client,
        status: item.status,
        contractDate: item.contractDate,
        sentDate: item.sentDate,
        note: item.note,
      })),
      deletedIds,
    });
    clearDeletedContracts(id);
    saveContractsSyncStatus({ ok: true, at: new Date().toISOString() });
    return true;
  } catch (err) {
    saveContractsSyncStatus({ ok: false, at: new Date().toISOString(), error: err instanceof Error ? err.message.slice(0, 160) : "خطأ" });
    return false;
  }
}
