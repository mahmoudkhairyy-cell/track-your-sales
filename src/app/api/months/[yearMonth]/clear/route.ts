import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { entries } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { monthDateRange, monthLabelAr } from "@/lib/dates";
import { handleRouteError, jsonOk, readJson, HttpError } from "@/lib/http";
import { requireYearMonth } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ yearMonth: string }> },
) {
  try {
    const user = await requireUser();
    const { yearMonth } = await context.params;
    const month = requireYearMonth(yearMonth);
    const body = await readJson(request);
    const data = (body ?? {}) as Record<string, unknown>;
    const confirmMonth = typeof data.confirmMonth === "string" ? data.confirmMonth : "";
    if (confirmMonth !== month) {
      throw new HttpError(400, `للتأكيد اكتب رمز الشهر ${month}`);
    }

    const { start, end } = monthDateRange(month);
    const existing = await db
      .select({ id: entries.id })
      .from(entries)
      .where(and(eq(entries.userId, user.id), gte(entries.entryDate, start), lte(entries.entryDate, end)));

    const deleted = await db
      .delete(entries)
      .where(and(eq(entries.userId, user.id), gte(entries.entryDate, start), lte(entries.entryDate, end)))
      .returning({ id: entries.id });

    return jsonOk({
      message: `تم مسح ${deleted.length} سجل من ${monthLabelAr(month)}`,
      deleted: deleted.length,
      expected: existing.length,
      yearMonth: month,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
