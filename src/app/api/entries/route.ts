import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { entries } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { cairoYearMonth, monthDateRange } from "@/lib/dates";
import { handleRouteError, jsonOk, readJson } from "@/lib/http";
import { catalogByKey } from "@/lib/calculations";
import { optionalNote, requireIsoDate, requireKpiKey, requireQuantity, requireYearMonth } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const yearMonth = requireYearMonth(url.searchParams.get("month") || cairoYearMonth());
    const { start, end } = monthDateRange(yearMonth);
    const rows = await db
      .select()
      .from(entries)
      .where(and(eq(entries.userId, user.id), gte(entries.entryDate, start), lte(entries.entryDate, end)))
      .orderBy(desc(entries.entryDate), desc(entries.createdAt));

    return jsonOk({
      yearMonth,
      entries: rows.map((row) => {
        const catalog = catalogByKey(row.kpiKey);
        return {
          ...row,
          nameEn: catalog?.nameEn ?? row.kpiKey,
          nameAr: catalog?.nameAr ?? row.kpiKey,
          unitAr: catalog?.unitAr ?? "",
        };
      }),
      count: rows.length,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const data = (body ?? {}) as Record<string, unknown>;
    const kpiKey = requireKpiKey(data.kpiKey);
    const quantity = requireQuantity(kpiKey, data.quantity);
    const entryDate = requireIsoDate(data.entryDate, "تاريخ الإنجاز");
    const note = optionalNote(data.note);

    const [created] = await db
      .insert(entries)
      .values({
        userId: user.id,
        kpiKey,
        quantity,
        entryDate,
        note,
      })
      .returning();

    const catalog = catalogByKey(created.kpiKey);
    return jsonOk(
      {
        message: "✅ اتسجل! عاش يا بطل",
        entry: {
          ...created,
          nameEn: catalog?.nameEn ?? created.kpiKey,
          nameAr: catalog?.nameAr ?? created.kpiKey,
          unitAr: catalog?.unitAr ?? "",
        },
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
