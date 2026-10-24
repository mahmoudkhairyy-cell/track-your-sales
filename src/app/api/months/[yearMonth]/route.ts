import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { holidays, kpiSettings, monthSettings } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { KPI_CATALOG, type KpiKey } from "@/lib/constants";
import { handleRouteError, jsonOk, readJson, HttpError } from "@/lib/http";
import { loadMonthBundle } from "@/lib/settings";
import { optionalNote, requireIsoDate, requireWorkingDays, requireYearMonth } from "@/lib/validate";
import { monthDateRange } from "@/lib/dates";
import { sumWeights } from "@/lib/calculations";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ yearMonth: string }> },
) {
  try {
    const user = await requireUser();
    const { yearMonth } = await context.params;
    const month = requireYearMonth(yearMonth);
    const bundle = await loadMonthBundle(user.id, month);
    return jsonOk({
      settings: bundle,
      weightSum: sumWeights(bundle.kpis),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ yearMonth: string }> },
) {
  try {
    const user = await requireUser();
    const { yearMonth } = await context.params;
    const month = requireYearMonth(yearMonth);
    const body = await readJson(request);
    const data = (body ?? {}) as Record<string, unknown>;

    const fullCommission = Number(data.fullCommission);
    if (!Number.isFinite(fullCommission) || fullCommission < 0) {
      throw new HttpError(400, "الكوميشن الكامل لازم يكون رقم صفر أو أكبر");
    }
    const allowCommissionOver100 = Boolean(data.allowCommissionOver100);
    const workingDays = requireWorkingDays(data.workingDays);
    if (!Array.isArray(data.kpis)) {
      throw new HttpError(400, "الإيتمز ناقصة");
    }
    if (!Array.isArray(data.holidays)) {
      throw new HttpError(400, "قائمة الإجازات ناقصة");
    }

    const kpis = data.kpis.map((item, index) => {
      if (!item || typeof item !== "object") {
        throw new HttpError(400, `مؤشر رقم ${index + 1} شكله غلط`);
      }
      const row = item as Record<string, unknown>;
      const kpiKey = row.kpiKey;
      if (typeof kpiKey !== "string" || !KPI_CATALOG.some((kpi) => kpi.key === kpiKey)) {
        throw new HttpError(400, "فيه إيتم مش معروف");
      }
      const target = Number(row.target);
      const weight = Number(row.weight);
      if (!Number.isFinite(target) || target < 0) {
        throw new HttpError(400, `تارجت ${kpiKey} غير صالح`);
      }
      if (!Number.isFinite(weight) || weight < 0) {
        throw new HttpError(400, `وزن ${kpiKey} غير صالح`);
      }
      const catalog = KPI_CATALOG.find((kpi) => kpi.key === kpiKey)!;
      return {
        kpiKey: kpiKey as KpiKey,
        target,
        weight,
        unitAr: typeof row.unitAr === "string" && row.unitAr.trim() ? row.unitAr.trim() : catalog.unitAr,
        sortOrder: index,
      };
    });

    if (kpis.length !== KPI_CATALOG.length) {
      throw new HttpError(400, "لازم تحفظ كل الإيتمز");
    }

    const { start, end } = monthDateRange(month);
    const holidayRows = data.holidays.map((item, index) => {
      if (!item || typeof item !== "object") {
        throw new HttpError(400, `إجازة رقم ${index + 1} شكلها غلط`);
      }
      const row = item as Record<string, unknown>;
      const date = requireIsoDate(row.date, "تاريخ الإجازة");
      if (date < start || date > end) {
        throw new HttpError(400, `الإجازة ${date} مش في الشهر المختار`);
      }
      return { date, note: optionalNote(row.note) };
    });
    const uniqueDates = new Set(holidayRows.map((item) => item.date));
    if (uniqueDates.size !== holidayRows.length) {
      throw new HttpError(400, "فيه تاريخ إجازة متكرر");
    }

    const saved = await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(monthSettings)
        .where(and(eq(monthSettings.userId, user.id), eq(monthSettings.yearMonth, month)))
        .limit(1);

      let monthId = existing[0]?.id;
      if (monthId) {
        await tx
          .update(monthSettings)
          .set({
            fullCommission,
            allowCommissionOver100,
            workingDays,
            updatedAt: new Date(),
          })
          .where(eq(monthSettings.id, monthId));
        await tx.delete(kpiSettings).where(eq(kpiSettings.monthSettingsId, monthId));
        await tx.delete(holidays).where(eq(holidays.monthSettingsId, monthId));
      } else {
        const [created] = await tx
          .insert(monthSettings)
          .values({
            userId: user.id,
            yearMonth: month,
            fullCommission,
            allowCommissionOver100,
            workingDays,
          })
          .returning({ id: monthSettings.id });
        monthId = created.id;
      }

      if (kpis.length > 0) {
        await tx.insert(kpiSettings).values(
          kpis.map((kpi) => ({
            monthSettingsId: monthId!,
            kpiKey: kpi.kpiKey,
            target: kpi.target,
            weight: kpi.weight,
            unitAr: kpi.unitAr,
            sortOrder: kpi.sortOrder,
          })),
        );
      }
      if (holidayRows.length > 0) {
        await tx.insert(holidays).values(
          holidayRows.map((item) => ({
            monthSettingsId: monthId!,
            date: item.date,
            note: item.note,
          })),
        );
      }
      return monthId;
    });

    const bundle = await loadMonthBundle(user.id, month);
    return jsonOk({
      message: "✅ إعدادات الشهر اتحفظت",
      settings: bundle,
      weightSum: sumWeights(bundle.kpis),
      id: saved,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
