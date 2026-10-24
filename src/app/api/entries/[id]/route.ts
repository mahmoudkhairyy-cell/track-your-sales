import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { entries } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { catalogByKey } from "@/lib/calculations";
import { handleRouteError, jsonOk, readJson, HttpError } from "@/lib/http";
import { optionalNote, requireIsoDate, requireKpiKey, requireQuantity } from "@/lib/validate";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function withCatalog(row: typeof entries.$inferSelect) {
  const catalog = catalogByKey(row.kpiKey);
  return {
    ...row,
    nameEn: catalog?.nameEn ?? row.kpiKey,
    nameAr: catalog?.nameAr ?? row.kpiKey,
    unitAr: catalog?.unitAr ?? "",
  };
}

/**
 * تعديل سجل موجود. الحقول كلها اختيارية؛ اللي مش مبعوت بيفضل زي ما هو.
 * الكمية بتتحقق بنفس قاعدة الإنشاء (src/lib/quantity.ts) على المؤشر النهائي بعد التعديل.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    if (!id) {
      throw new HttpError(400, "رقم السجل ناقص");
    }

    const current = await db
      .select()
      .from(entries)
      .where(and(eq(entries.id, id), eq(entries.userId, user.id)))
      .limit(1);
    if (!current[0]) {
      throw new HttpError(404, "السجل مش موجود أو مش من حسابك");
    }

    const body = await readJson(request);
    const data = (body ?? {}) as Record<string, unknown>;

    const kpiKey = data.kpiKey === undefined ? requireKpiKey(current[0].kpiKey) : requireKpiKey(data.kpiKey);
    const quantity = requireQuantity(kpiKey, data.quantity === undefined ? current[0].quantity : data.quantity);
    const entryDate =
      data.entryDate === undefined ? current[0].entryDate : requireIsoDate(data.entryDate, "تاريخ الإنجاز");
    const note = data.note === undefined ? current[0].note : optionalNote(data.note);

    const [updated] = await db
      .update(entries)
      .set({ kpiKey, quantity, entryDate, note })
      .where(and(eq(entries.id, id), eq(entries.userId, user.id)))
      .returning();

    if (!updated) {
      throw new HttpError(404, "السجل مش موجود أو مش من حسابك");
    }

    return jsonOk({ message: "✏️ السجل اتعدل", entry: withCatalog(updated) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    if (!id) {
      throw new HttpError(400, "رقم السجل ناقص");
    }

    const deleted = await db
      .delete(entries)
      .where(and(eq(entries.id, id), eq(entries.userId, user.id)))
      .returning({ id: entries.id });

    if (!deleted[0]) {
      throw new HttpError(404, "السجل مش موجود أو مش من حسابك");
    }

    return jsonOk({ message: "🗑️ السجل اتشال", id: deleted[0].id });
  } catch (error) {
    return handleRouteError(error);
  }
}
