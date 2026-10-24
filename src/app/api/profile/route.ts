import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleRouteError, jsonOk, readJson, HttpError } from "@/lib/http";
import { trimText } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const data = (body ?? {}) as Record<string, unknown>;
    const name = trimText(data.name, "اسم الموظف", 2, 80);
    const branch = trimText(data.branch, "الفرع", 2, 80);

    if (name !== user.name) {
      const clash = await db.select({ id: users.id }).from(users).where(eq(users.name, name)).limit(1);
      if (clash[0] && clash[0].id !== user.id) {
        throw new HttpError(409, "الاسم ده مستخدم لحساب تاني");
      }
    }

    const [updated] = await db
      .update(users)
      .set({ name, branch })
      .where(eq(users.id, user.id))
      .returning({ id: users.id, name: users.name, branch: users.branch, role: users.role });

    return jsonOk({ user: updated, message: "✅ بياناتك اتحدثت" });
  } catch (error) {
    return handleRouteError(error);
  }
}
