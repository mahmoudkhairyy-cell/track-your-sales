import { eq } from "drizzle-orm";
import { db } from "@/db";
import { articles, entries, holidays, kpiSettings, monthSettings, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { backupSummary, parseBackup, planEntryRestore } from "@/lib/backup";
import { handleRouteError, jsonOk, readJson, HttpError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const data = (body ?? {}) as Record<string, unknown>;

    let backup;
    try {
      backup = parseBackup(data.backup);
    } catch (error) {
      const message = error instanceof Error ? error.message : "ملف الاستعادة غير صالح";
      throw new HttpError(400, message);
    }

    const summary = backupSummary(backup);
    const dryRun = Boolean(data.dryRun);
    if (dryRun) {
      return jsonOk({
        summary,
        message: "الملف مطابق للمخطط. مفيش أي تعديل اتعمل لسه.",
      });
    }

    const mode = data.mode === "replace" ? "replace" : data.mode === "merge" ? "merge" : null;
    if (!mode) {
      throw new HttpError(400, "اختار نوع الاستعادة: دمج أو استبدال");
    }
    if (mode === "replace" && data.confirmReplace !== true) {
      throw new HttpError(400, "الاستبدال محتاج تأكيد صريح بعد تحميل نسخة احتياطية");
    }

    let entriesInserted = 0;
    let entriesSkipped = 0;

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ name: backup.profile.name, branch: backup.profile.branch })
        .where(eq(users.id, user.id));

      if (mode === "replace") {
        await tx.delete(entries).where(eq(entries.userId, user.id));
        await tx.delete(articles).where(eq(articles.userId, user.id));
        await tx.delete(monthSettings).where(eq(monthSettings.userId, user.id));
      }

      for (const month of backup.months) {
        const existing = await tx
          .select()
          .from(monthSettings)
          .where(eq(monthSettings.userId, user.id));
        const found = existing.find((row) => row.yearMonth === month.yearMonth);
        let monthId = found?.id;
        if (found) {
          await tx
            .update(monthSettings)
            .set({
              fullCommission: month.fullCommission,
              allowCommissionOver100: month.allowCommissionOver100,
              workingDays: month.workingDays,
              updatedAt: new Date(),
            })
            .where(eq(monthSettings.id, found.id));
          await tx.delete(kpiSettings).where(eq(kpiSettings.monthSettingsId, found.id));
          await tx.delete(holidays).where(eq(holidays.monthSettingsId, found.id));
          monthId = found.id;
        } else {
          const [created] = await tx
            .insert(monthSettings)
            .values({
              userId: user.id,
              yearMonth: month.yearMonth,
              fullCommission: month.fullCommission,
              allowCommissionOver100: month.allowCommissionOver100,
              workingDays: month.workingDays,
            })
            .returning({ id: monthSettings.id });
          monthId = created.id;
        }

        if (month.kpis.length > 0) {
          await tx.insert(kpiSettings).values(
            month.kpis.map((kpi) => ({
              monthSettingsId: monthId!,
              kpiKey: kpi.kpiKey,
              target: kpi.target,
              weight: kpi.weight,
              unitAr: kpi.unitAr,
              sortOrder: kpi.sortOrder,
            })),
          );
        }
        if (month.holidays.length > 0) {
          await tx.insert(holidays).values(
            month.holidays.map((item) => ({
              monthSettingsId: monthId!,
              date: item.date,
              note: item.note,
            })),
          );
        }
      }

      // منع التكرار عند الدمج: السجلات الموجودة فعلاً بتتعدّى بدل ما تتضاف تاني.
      const existingEntries =
        mode === "merge"
          ? await tx
              .select({
                id: entries.id,
                kpiKey: entries.kpiKey,
                quantity: entries.quantity,
                entryDate: entries.entryDate,
                note: entries.note,
              })
              .from(entries)
              .where(eq(entries.userId, user.id))
          : [];
      const plan = planEntryRestore(backup.entries, existingEntries, mode);
      entriesInserted = plan.entriesInserted;
      entriesSkipped = plan.entriesSkipped;

      if (plan.toInsert.length > 0) {
        await tx.insert(entries).values(
          plan.toInsert.map((entry) => ({
            userId: user.id,
            kpiKey: entry.kpiKey,
            quantity: entry.quantity,
            entryDate: entry.entryDate,
            note: entry.note,
            createdAt: entry.createdAt ? new Date(entry.createdAt) : undefined,
          })),
        );
      }

      if (backup.articles.length > 0) {
        await tx.insert(articles).values(
          backup.articles.map((article) => ({
            userId: user.id,
            title: article.title,
            content: article.content,
            createdAt: article.createdAt ? new Date(article.createdAt) : undefined,
            updatedAt: article.updatedAt ? new Date(article.updatedAt) : undefined,
          })),
        );
      }
    });

    const skippedNote = entriesSkipped > 0 ? ` (اتعدّى ${entriesSkipped} سجل موجود قبل كده)` : "";
    return jsonOk({
      message:
        mode === "replace"
          ? `تم استبدال البيانات بالنسخة المستوردة — ${entriesInserted} سجل`
          : `تم دمج البيانات المستوردة — اتضاف ${entriesInserted} سجل${skippedNote}`,
      summary,
      mode,
      entriesInserted,
      entriesSkipped,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
