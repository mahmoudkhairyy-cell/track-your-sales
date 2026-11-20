import { runLocalApi, buildManagerSnapshot } from "@/lib/local-api";

export type ApiResult<T> = T & { ok: true };
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

const MANAGER_SYNC_URL = "https://fjhjqrgolqqtaokrlezd.supabase.co/functions/v1/manager-api";
const SUPABASE_PUBLIC_KEY = "sb_publishable_6cLV7KQHG3RNeAenIUcKFg_qpWHumZq";
const SYNC_ID_KEY = "trackYourSales.syncId.v1";
const LAST_SYNC_KEY = "trackYourSales.lastManagerReport.v1";
let syncRunning = false;
let syncAgain = false;

function stableBranchId(): string {
  let id = localStorage.getItem(SYNC_ID_KEY);
  if (!id) {
    id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `tys-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(SYNC_ID_KEY, id);
  }
  return id;
}

/** Best-effort background sync: local save remains authoritative while offline. */
async function syncManagerReport(): Promise<void> {
  if (typeof window === "undefined") return;
  if (syncRunning) { syncAgain = true; return; }
  syncRunning = true;
  try {
    do {
      syncAgain = false;
      const snapshot = buildManagerSnapshot();
      if (!snapshot) break;
      const signature = JSON.stringify({ ...snapshot, payload: { ...snapshot.payload, syncedAt: null } });
      if (localStorage.getItem(LAST_SYNC_KEY) === signature) break;

      const response = await fetch(MANAGER_SYNC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_PUBLIC_KEY },
        body: JSON.stringify({
          action: "submit_report",
          branchId: stableBranchId(),
          employee: snapshot.employee,
          branch: snapshot.branch,
          payload: snapshot.payload,
        }),
      });
      if (!response.ok) break;
      localStorage.setItem(LAST_SYNC_KEY, signature);
    } while (syncAgain);
  } catch {
    // يفضل التقرير محليًا، والمحاولة التالية تحصل عند أي فتح/تفاعل لاحق.
  } finally {
    syncRunning = false;
  }
}

/** Local-first compatibility layer with automatic cloud report sync. */
export async function api<T>(url: string, options?: RequestInit): Promise<ApiResult<T>> {
  if (!url.startsWith("/api/")) throw new ApiError("المسار المحلي غير مدعوم", 404);
  let body: unknown;
  try { body = options?.body ? JSON.parse(String(options.body)) : undefined; }
  catch { throw new ApiError("البيانات المرسلة غير صالحة", 400); }
  const result = runLocalApi(url, options?.method ?? "GET", body);
  if (!result.ok) throw new ApiError(result.message, result.status);
  void syncManagerReport();
  return result.data as ApiResult<T>;
}
export function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}
