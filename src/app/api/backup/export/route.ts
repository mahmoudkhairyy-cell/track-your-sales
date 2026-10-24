import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles, entries, holidays, kpiSettings, monthSettings } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { backupSummary, type BackupFile } from "@/lib/backup";
import { KPI_CATALOG, SCHEMA_VERSION, type KpiKey } from "@/lib/constants";
import { handleRouteError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();

    const [monthRows, entryRows, articleRows] = await Promise.all([
      db.select().from(monthSettings).where(eq(monthSettings.userId, user.id)),
      db.select().from(entries).where(eq(entries.userId, user.id)).orderBy(desc(entries.createdAt)),
      db.select().from(articles).where(eq(articles.userId, user.id)).orderBy(desc(articles.updatedAt)),
    ]);

    const months = [];
    for (const month of monthRows) {
      const [kpiRows, holidayRows] = await Promise.all([
        db.select().from(kpiSettings).where(eq(kpiSettings.monthSettingsId, month.id)),
        db.select().from(holidays).where(eq(holidays.monthSettingsId, month.id)),
      ]);
      const kpiMap = new Map(kpiRows.map((item) => [item.kpiKey, item]));
      months.push({
        yearMonth: month.yearMonth,
        fullCommission: month.fullCommission,
        allowCommissionOver100: month.allowCommissionOver100,
        workingDays: month.workingDays,
        kpis: KPI_CATALOG.map((kpi, index) => {
          const saved = kpiMap.get(kpi.key);
          return {
            kpiKey: kpi.key as KpiKey,
            target: saved?.target ?? kpi.defaultTarget,
            weight: saved?.weight ?? kpi.defaultWeight,
            unitAr: saved?.unitAr ?? kpi.unitAr,
            sortOrder: saved?.sortOrder ?? index,
          };
        }),
        holidays: holidayRows.map((item) => ({ date: item.date, note: item.note })),
      });
    }

    const isEmpty = months.length === 0 && entryRows.length === 0 && articleRows.length === 0;
    const backup: BackupFile = {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      isEmpty,
      emptyReason: isEmpty
        ? "لا توجد سجلات إنجاز ولا إعدادات شهور محفوظة ولا مقالات"
        : null,
      profile: { name: user.name, branch: user.branch },
      months,
      entries: entryRows.map((row) => ({
        id: row.id,
        kpiKey: row.kpiKey as KpiKey,
        quantity: row.quantity,
        entryDate: row.entryDate,
        note: row.note,
        createdAt: row.createdAt.toISOString(),
      })),
      articles: articleRows.map((row) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    };

    if (!Array.isArray(backup.months) || !Array.isArray(backup.entries) || !backup.profile) {
      throw new Error("export assembly failed");
    }

    return jsonOk({
      backup,
      summary: backupSummary(backup),
      message: isEmpty
        ? "الملف اتنزّل وفيه الملف الشخصي فقط من غير سجلات محفوظة"
        : "تم تجهيز النسخة الاحتياطية",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
