import { NextResponse } from "next/server";

export class HttpError extends Error {
  status: number;
  log?: unknown;

  constructor(status: number, message: string, log?: unknown) {
    super(message);
    this.status = status;
    this.log = log;
  }
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status, headers: { "Cache-Control": "no-store" } });
}

export function jsonError(message: string, status = 400, log?: unknown) {
  if (log !== undefined) {
    console.error("[targetx]", message, sanitizeLog(log));
  }
  return NextResponse.json(
    { ok: false, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function sanitizeLog(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/key=[^&\s]+/gi, "key=***").replace(/AIza[0-9A-Za-z_-]+/g, "[redacted]");
  }
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  return value;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "صيغة البيانات مش JSON صالح");
  }
}

export function handleRouteError(error: unknown) {
  if (error instanceof HttpError) {
    return jsonError(error.message, error.status, error.log);
  }
  console.error("[targetx] unhandled", sanitizeLog(error));
  return jsonError("حصل خطأ غير متوقع في السيرفر", 500, error);
}
