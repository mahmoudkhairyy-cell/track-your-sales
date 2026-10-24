import { asc } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { HttpError } from "@/lib/http";
import { deploymentAccess, deploymentProtectionEnabled } from "@/lib/deployment-access";

/**
 * ⚠️ تحذير أمني — اقرأ قبل النشر على الإنترنت:
 * AUTH_MODE=single-workspace مش نظام حسابات منفصلة: صاحب كلمة حماية الرابط
 * بيتعامل كمالك مساحة العمل. من غير بوابة الحماية أي زائر يقدر يقرا ويعدّل ويمسح.
 * للاستخدام المحلي ممكن البوابة تبقى مقفولة. على Vercel الحماية إجبارية، وعلى
 * أي استضافة عامة تانية استخدم PUBLIC_DEPLOYMENT=true مع WORKSPACE_PASSWORD قوية.
 * متنشرش التطبيق على رابط عام من غير حماية، ومتشاركش كلمة السر أو ملفات .env.
 * بوابة HTTP Basic بتشتغل عبر HTTPS من المتصفح، من غير صفحة تسجيل حسابات.
 *
 * TODO(auth): الدخول متعدد المستخدمين لسه مش متوصّل:
 *  - توصيل src/lib/session.ts مع كوكي HttpOnly وendpoints للدخول والخروج.
 *  - تحديث requireUser/requireOwner لقراءة الجلسة بدل مساحة العمل الواحدة.
 * جدول sessions وsrc/lib/passwords.ts لسه scaffolding، AUTH_MODE=sessions بيرفض الطلب.
 */

export type AuthMode = "single-workspace" | "sessions";
export const AUTH_MODE: AuthMode = process.env.AUTH_MODE === "sessions" ? "sessions" : "single-workspace";

let warnedOnce = false;
function warnInsecureModeOnce() {
  if (warnedOnce || deploymentProtectionEnabled()) return;
  warnedOnce = true;
  if (process.env.NODE_ENV === "production") {
    console.warn("[track-your-sales][security] مساحة العمل مفتوحة من غير مصادقة. للاستخدام المحلي فقط؛ فعّل حماية النشر قبل مشاركة أي رابط عام.");
  }
}

export type SafeUser = {
  id: string;
  name: string;
  branch: string;
  role: string;
  createdAt: Date;
};

function toSafeUser(row: typeof users.$inferSelect): SafeUser {
  return { id: row.id, name: row.name, branch: row.branch, role: row.role, createdAt: row.createdAt };
}

/** Defense in depth: protect database access even if a proxy matcher is changed. */
async function requireDeploymentAccess() {
  if (!deploymentProtectionEnabled()) return;
  const requestHeaders = await headers();
  const access = deploymentAccess(requestHeaders.get("authorization"));
  if (!access.allowed) throw new HttpError(access.status, access.message);
}

export async function getWorkspaceUser(): Promise<SafeUser> {
  await requireDeploymentAccess();
  warnInsecureModeOnce();
  const existing = await db.select().from(users).orderBy(asc(users.createdAt)).limit(1);
  if (existing[0]) return toSafeUser(existing[0]);

  try {
    const [created] = await db
      .insert(users)
      .values({ name: "موظف المبيعات", branch: "الفرع", passwordHash: "local-workspace", role: "owner" })
      .returning();
    return toSafeUser(created);
  } catch {
    const retry = await db.select().from(users).orderBy(asc(users.createdAt)).limit(1);
    if (retry[0]) return toSafeUser(retry[0]);
    throw new HttpError(500, "تعذر تجهيز مساحة العمل");
  }
}

export async function getCurrentUser(): Promise<SafeUser> {
  if (AUTH_MODE === "sessions") {
    // TODO(auth): connect the sessions scaffolding before enabling this mode.
    throw new HttpError(501, "وضع الجلسات لسه مش متوصّل. استخدم مساحة العمل الواحدة مع كلمة حماية الرابط.");
  }
  return getWorkspaceUser();
}

export async function requireUser(): Promise<SafeUser> {
  return getCurrentUser();
}

export async function requireOwner(): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!isOwner(user)) throw new HttpError(403, "الإجراء ده للمالك بس");
  return user;
}

export function isOwner(user: SafeUser): boolean {
  return user.role === "owner";
}
