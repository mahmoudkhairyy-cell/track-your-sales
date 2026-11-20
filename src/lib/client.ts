import { runLocalApi } from "@/lib/local-api";

export type ApiResult<T> = T & { ok: true };
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

/** Local compatibility layer: no network requests, no HTTP endpoints, localStorage only. */
export async function api<T>(url: string, options?: RequestInit): Promise<ApiResult<T>> {
  if (!url.startsWith("/api/")) throw new ApiError("المسار المحلي غير مدعوم", 404);
  let body: unknown;
  try { body = options?.body ? JSON.parse(String(options.body)) : undefined; }
  catch { throw new ApiError("البيانات المرسلة غير صالحة", 400); }
  const result = runLocalApi(url, options?.method ?? "GET", body);
  if (!result.ok) throw new ApiError(result.message, result.status);
  return result.data as ApiResult<T>;
}
export function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}
