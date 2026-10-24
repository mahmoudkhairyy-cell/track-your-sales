/**
 * Scaffolding لجلسات تسجيل الدخول — **مش متوصّل بالتطبيق حاليًا**.
 *
 * التطبيق دلوقتي شغال بوضع مساحة عمل واحدة (AUTH_MODE=single-workspace)
 * من غير شاشة دخول، بناءً على طلب المستخدم. الملف ده وجدول `sessions`
 * موجودين عشان لما نفعّل الدخول متعدد المستخدمين نلاقي الأساس جاهز.
 *
 * TODO(auth): لما يتفعل وضع الجلسات:
 *  1. أنشئ endpoint للدخول يتحقق من كلمة السر بـ verifyPassword ويستدعي createSession.
 *  2. خزّن التوكن في كوكي HttpOnly + Secure + SameSite=Lax.
 *  3. خلّي requireUser في src/lib/auth.ts يقرأ الكوكي ويستدعي getSessionUser.
 *  4. أضف endpoint للخروج يستدعي destroySession.
 */
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { hashToken, randomToken } from "@/lib/passwords";

export const SESSION_COOKIE = "targetx_session";
export const SESSION_TTL_DAYS = 30;

export type SessionUserRow = typeof users.$inferSelect;

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt };
}

export async function getSessionUser(token: string | undefined | null): Promise<SessionUserRow | null> {
  if (!token) return null;
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.user ?? null;
}

export async function destroySession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}
