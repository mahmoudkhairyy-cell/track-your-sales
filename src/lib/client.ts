export type ApiResult<T> = T & { ok: true };

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(url: string, options?: RequestInit): Promise<ApiResult<T>> {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    cache: "no-store",
    headers: {
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...(options?.headers ?? {}),
    },
  });

  let data: { ok?: boolean; message?: string } | null = null;
  try {
    data = (await response.json()) as { ok?: boolean; message?: string };
  } catch {
    throw new ApiError("السيرفر مرجعش رد مفهوم", response.status);
  }

  if (!response.ok || data?.ok === false) {
    throw new ApiError(data?.message || "حصل خطأ في السيرفر", response.status);
  }

  return data as ApiResult<T>;
}

export function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
