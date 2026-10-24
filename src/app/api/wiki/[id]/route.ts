import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleRouteError, jsonOk, readJson, HttpError } from "@/lib/http";
import { trimText } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await readJson(request);
    const data = (body ?? {}) as Record<string, unknown>;
    const title = trimText(data.title, "عنوان المقال", 2, 160);
    const content = trimText(data.content, "محتوى المقال", 2, 8000);

    const updated = await db
      .update(articles)
      .set({ title, content, updatedAt: new Date() })
      .where(and(eq(articles.id, id), eq(articles.userId, user.id)))
      .returning();

    if (!updated[0]) {
      throw new HttpError(404, "الملاحظة مش موجودة أو مش من حسابك");
    }
    return jsonOk({ message: "✅ الملاحظة اتعدلت", article: updated[0] });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const deleted = await db
      .delete(articles)
      .where(and(eq(articles.id, id), eq(articles.userId, user.id)))
      .returning({ id: articles.id });
    if (!deleted[0]) {
      throw new HttpError(404, "الملاحظة مش موجودة أو مش من حسابك");
    }
    return jsonOk({ message: "🗑️ الملاحظة اتشالت", id: deleted[0].id });
  } catch (error) {
    return handleRouteError(error);
  }
}
