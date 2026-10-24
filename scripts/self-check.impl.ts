/**
 * الفحص الذاتي الحقيقي — بيستورد كود المشروع نفسه (مش نسخ منه):
 *  1. الحسابات: النتيجة الموزونة، الوزن صفر، معدل New Lines اليومي.
 *  2. قاعدة الكميات الموحدة (كسور لـ Quality بس).
 *  3. التحقق من ملف النسخة الاحتياطية ورفض الأسرار.
 *  4. planEntryRestore: منع التكرار في الدمج مع الحفاظ على التكرار المشروع.
 *  5. CRUD فعلي على Postgres (مستخدم مؤقت بيتمسح في النهاية حتى لو الفحص فشل).
 *  6. فحص إن index entries_user_date_idx موجود بعد db:push.
 */
import "dotenv/config";
import pg from "pg";
import { computeOverall, kpiContribution, newLinesDailyNeed } from "@/lib/calculations";
import { KPI_CATALOG } from "@/lib/constants";
import { parseBackup, planEntryRestore, type BackupEntry } from "@/lib/backup";
import { validateQuantity } from "@/lib/quantity";
import { hashPassword, verifyPassword } from "@/lib/passwords";

type Step = { name: string; ok: boolean; detail?: string };
const steps: Step[] = [];

function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      steps.push({ name, ok: true });
    })
    .catch((error: unknown) => {
      steps.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
    });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function approx(a: number, b: number, eps = 1e-6) {
  return Math.abs(a - b) < eps;
}

async function pureChecks() {
  await check("calculations: full achievement = 100%", () => {
    const kpis = KPI_CATALOG.map((kpi) => ({
      kpiKey: kpi.key,
      target: kpi.defaultTarget,
      weight: kpi.defaultWeight,
      unitAr: kpi.unitAr,
    }));
    const achieved = Object.fromEntries(KPI_CATALOG.map((kpi) => [kpi.key, kpi.defaultTarget]));
    assert(approx(computeOverall(kpis, achieved), 100), "overall should be 100");
    assert(kpiContribution(1000, 158, 0) === 0, "zero-weight KPI must not lift overall");
    assert(approx(kpiContribution(87.5, 175, 40), 20), "half New Lines = 20 points");
  });

  await check("calculations: New Lines daily pace", () => {
    assert(newLinesDailyNeed(175, 175, 10).perDay === 0, "completed target → 0/day");
    assert(newLinesDailyNeed(175, 100, 0).perDay === null, "no remaining days → null (no division by zero)");
    assert(newLinesDailyNeed(175, 100, 5).perDay === 15, "75 remaining / 5 days = 15");
  });

  await check("quantity rule: integers vs Quality fractions", () => {
    assert(validateQuantity("new_lines", 3).ok, "integer ok");
    assert(!validateQuantity("new_lines", 2.5).ok, "fraction rejected for New Lines");
    assert(!validateQuantity("new_lines", 0).ok, "zero rejected");
    assert(!validateQuantity("points", "12.7").ok, "fraction string rejected for Points");
    assert(validateQuantity("points", "12").ok, "integer string ok");
    const q = validateQuantity("quality", 97.5);
    assert(q.ok && q.value === 97.5, "Quality fraction ok");
    assert(validateQuantity("quality", 0).ok, "Quality 0 ok");
    assert(!validateQuantity("quality", 100.1).ok, "Quality > 100 rejected");
    assert(!validateQuantity("dsl", "abc").ok, "non-number rejected");
  });

  await check("backup: schema validation + secrets rejected", () => {
    let rejected = false;
    try {
      parseBackup({ schemaVersion: 1, profile: { name: "x" } });
    } catch {
      rejected = true;
    }
    assert(rejected, "incomplete backup must be rejected");

    rejected = false;
    try {
      parseBackup({
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        apiKey: "secret",
        profile: { name: "x", branch: "y" },
        months: [],
        entries: [],
        articles: [],
      });
    } catch {
      rejected = true;
    }
    assert(rejected, "backup with secrets must be rejected");

    rejected = false;
    try {
      parseBackup({
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        profile: { name: "x", branch: "y" },
        months: [],
        entries: [{ kpiKey: "new_lines", quantity: 1.5, entryDate: "2026-01-02", note: null }],
        articles: [],
      });
    } catch {
      rejected = true;
    }
    assert(rejected, "fractional New Lines in backup must be rejected by the unified quantity rule");

    const ok = parseBackup({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      profile: { name: "x", branch: "y" },
      months: [],
      entries: [{ kpiKey: "quality", quantity: 95.5, entryDate: "2026-01-02", note: "" }],
      articles: [],
    });
    assert(ok.entries[0].quantity === 95.5 && ok.entries[0].note === null, "valid backup parsed");
  });

  await check("planEntryRestore: merge skips duplicates, keeps legit repeats", () => {
    const existing = [
      { id: "a", kpiKey: "new_lines", quantity: 3, entryDate: "2026-01-05", note: null },
      { id: "b", kpiKey: "new_lines", quantity: 3, entryDate: "2026-01-05", note: null },
      { id: "c", kpiKey: "points", quantity: 100, entryDate: "2026-01-06", note: "x" },
    ];
    const incoming: BackupEntry[] = [
      { id: "a", kpiKey: "new_lines", quantity: 3, entryDate: "2026-01-05", note: null }, // same id → skip
      { kpiKey: "new_lines", quantity: 3, entryDate: "2026-01-05", note: null }, // matches b → skip
      { kpiKey: "new_lines", quantity: 3, entryDate: "2026-01-05", note: null }, // third copy → insert
      { kpiKey: "points", quantity: 100, entryDate: "2026-01-06", note: "x" }, // matches c → skip
      { kpiKey: "dsl", quantity: 1, entryDate: "2026-01-07", note: null }, // new → insert
    ];
    const merge = planEntryRestore(incoming, existing, "merge");
    assert(merge.entriesInserted === 2, `merge should insert 2, got ${merge.entriesInserted}`);
    assert(merge.entriesSkipped === 3, `merge should skip 3, got ${merge.entriesSkipped}`);

    const again = planEntryRestore(incoming, [...existing, ...merge.toInsert.map((e, i) => ({ ...e, id: `n${i}`, note: e.note ?? null }))], "merge");
    assert(again.entriesInserted === 0, "re-merging the same file must insert nothing (idempotent)");

    const replace = planEntryRestore(incoming, existing, "replace");
    assert(replace.entriesInserted === incoming.length && replace.entriesSkipped === 0, "replace inserts everything");
  });

  await check("passwords scaffolding: hash + verify", () => {
    const hash = hashPassword("secret12");
    assert(verifyPassword("secret12", hash), "verify ok");
    assert(!verifyPassword("wrong", hash), "wrong password rejected");
  });
}

async function dbChecks() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    steps.push({ name: "db: DATABASE_URL", ok: false, detail: "DATABASE_URL مش موجود في البيئة" });
    return;
  }
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  let userId: string | null = null;
  try {
    await check("db: entries_user_date_idx exists", async () => {
      const idx = await client.query(
        `select 1 from pg_indexes where tablename = 'entries' and indexname = 'entries_user_date_idx'`,
      );
      assert(idx.rowCount === 1, "run `npm run db:push` first — index missing");
    });

    await check("db: create temp user", async () => {
      const hash = hashPassword("secret12");
      const res = await client.query(
        `insert into users (name, branch, password_hash, role) values ($1, $2, $3, 'user') returning id`,
        [`selfcheck_${Date.now()}`, "فرع اختبار", hash],
      );
      userId = res.rows[0].id as string;
      assert(userId, "user id");
    });

    let monthId: string | null = null;
    await check("db: month settings create/read/update", async () => {
      assert(userId, "no user");
      const month = await client.query(
        `insert into month_settings (user_id, year_month, full_commission, allow_commission_over_100, working_days)
         values ($1, '2099-01', 6000, false, $2::jsonb) returning id`,
        [userId, JSON.stringify({ sat: true, sun: true, mon: true, tue: true, wed: true, thu: true, fri: false })],
      );
      monthId = month.rows[0].id as string;
      await client.query(
        `insert into kpi_settings (month_settings_id, kpi_key, target, weight, unit_ar, sort_order) values ($1, 'new_lines', 175, 40, 'خط', 0)`,
        [monthId],
      );
      await client.query(`insert into holidays (month_settings_id, date, note) values ($1, '2099-01-07', 'إجازة')`, [monthId]);
      const read = await client.query(`select year_month, full_commission from month_settings where id = $1`, [monthId]);
      assert(read.rows[0].year_month === "2099-01" && Number(read.rows[0].full_commission) === 6000, "read back");
      await client.query(`update month_settings set full_commission = 7000 where id = $1`, [monthId]);
      const upd = await client.query(`select full_commission from month_settings where id = $1`, [monthId]);
      assert(Number(upd.rows[0].full_commission) === 7000, "update");
    });

    await check("db: entries create/update/delete", async () => {
      assert(userId, "no user");
      const ins = await client.query(
        `insert into entries (user_id, kpi_key, quantity, entry_date, note) values ($1, 'new_lines', 3, '2099-01-02', 'check') returning id`,
        [userId],
      );
      const id = ins.rows[0].id as string;
      await client.query(`update entries set quantity = 5, note = 'edited' where id = $1 and user_id = $2`, [id, userId]);
      const after = await client.query(`select quantity, note from entries where id = $1`, [id]);
      assert(Number(after.rows[0].quantity) === 5 && after.rows[0].note === "edited", "PATCH-equivalent update");
      await client.query(`delete from entries where id = $1`, [id]);
      const count = await client.query(`select count(*)::int as n from entries where user_id = $1`, [userId]);
      assert(count.rows[0].n === 0, "delete");
    });

    await check("db: sessions scaffolding cascades with user", async () => {
      assert(userId, "no user");
      await client.query(
        `insert into sessions (user_id, token_hash, expires_at) values ($1, $2, now() + interval '1 day')`,
        [userId, `selfcheck-${Date.now()}`],
      );
      const n = await client.query(`select count(*)::int as n from sessions where user_id = $1`, [userId]);
      assert(n.rows[0].n === 1, "session inserted");
    });
  } finally {
    if (userId) {
      await client.query(`delete from users where id = $1`, [userId]).catch(() => undefined);
      const leftover = await client.query(`select count(*)::int as n from sessions where user_id = $1`, [userId]);
      steps.push({
        name: "db: cleanup temp user (cascade sessions/entries/settings)",
        ok: leftover.rows[0].n === 0,
        detail: leftover.rows[0].n === 0 ? undefined : "sessions leftover after cascade",
      });
    }
    await client.end();
  }
}

async function main() {
  await pureChecks();
  await dbChecks();

  const failed = steps.filter((step) => !step.ok);
  for (const step of steps) {
    console.log(`${step.ok ? "✅" : "❌"} ${step.name}${step.detail ? ` — ${step.detail}` : ""}`);
  }
  console.log(JSON.stringify({ ok: failed.length === 0, passed: steps.length - failed.length, failed: failed.length }));
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error("self-check crashed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
