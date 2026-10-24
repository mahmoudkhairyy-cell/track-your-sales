import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleRouteError, jsonOk, readJson } from "@/lib/http";
import { trimText } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await db
      .select()
      .from(articles)
      .where(eq(articles.userId, user.id))
      .orderBy(desc(articles.updatedAt));
    return jsonOk({ articles: rows, count: rows.length, empty: rows.length === 0 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const data = (body ?? {}) as Record<string, unknown>;
    const title = trimText(data.title, "عنوان المقال", 2, 160);
    const content = trimText(data.content, "محتوى المقال", 2, 8000);

    const [created] = await db
      .insert(articles)
      .values({
        userId: user.id,
        title,
        content,
      })
      .returning();

    return jsonOk({ message: "✅ الملاحظة اتضافت", article: created }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
