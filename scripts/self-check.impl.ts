#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  achievementPercent,
  applyCompanyRules,
  estimatedCommission,
  kpiContribution,
} from "../src/lib/calculations";
import { parseBackup, planEntryRestore, type BackupEntry } from "../src/lib/backup";
import { validateQuantity } from "../src/lib/quantity";

function check(name: string, run: () => void) {
  run();
  console.log(`✓ ${name}`);
}

check("نسبة الإنجاز والتارجت الصفري", () => {
  assert.equal(achievementPercent(90, 100), 90);
  assert.equal(achievementPercent(10, 0), 0);
});

check("المؤشر الفردي لا يتوقف عند 200%", () => {
  assert.equal(kpiContribution(300, 100, 40), 120);
});

check("المحافظ الجديدة شرط مستقل بنسبة 90% من New Lines", () => {
  const base = [
    { kpiKey: "new_lines" as const, target: 175, achieved: 100, weight: 40, unitAr: "خط" },
    { kpiKey: "new_orange_cash" as const, target: 158, achieved: 90, weight: 0, unitAr: "محفظة" },
  ];
  assert.equal(applyCompanyRules(base).walletDone, true);
  assert.equal(applyCompanyRules(base).commissionEligible, false);
  const shortWallets = applyCompanyRules(base.map((item) => item.kpiKey === "new_orange_cash" ? { ...item, achieved: 89 } : item));
  assert.equal(shortWallets.walletDone, false);
  assert.equal(shortWallets.commissionEligible, false);
});

check("شرط المحافظ يمنع الكوميشن حتى مع اكتمال المؤشرات الموزونة", () => {
  const completeWeightedTargets = [
    { kpiKey: "new_lines" as const, target: 100, achieved: 100, weight: 40, unitAr: "خط" },
    { kpiKey: "new_orange_cash" as const, target: 90, achieved: 89, weight: 0, unitAr: "محفظة" },
    { kpiKey: "existing_wallets" as const, target: 100, achieved: 100, weight: 15, unitAr: "محفظة" },
    { kpiKey: "points" as const, target: 100, achieved: 100, weight: 10, unitAr: "نقطة" },
    { kpiKey: "postpaid_lines" as const, target: 100, achieved: 100, weight: 10, unitAr: "خط" },
    { kpiKey: "dsl" as const, target: 100, achieved: 100, weight: 10, unitAr: "خط" },
    { kpiKey: "quality" as const, target: 100, achieved: 100, weight: 15, unitAr: "%" },
  ];
  const blocked = applyCompanyRules(completeWeightedTargets);
  assert.equal(blocked.total, 100);
  assert.equal(blocked.walletDone, false);
  assert.equal(blocked.commissionEligible, false);
  const eligible = applyCompanyRules(completeWeightedTargets.map((item) =>
    item.kpiKey === "new_orange_cash" ? { ...item, achieved: 90 } : item,
  ));
  assert.equal(eligible.walletDone, true);
  assert.equal(eligible.commissionEligible, true);
});

check("المحافظ لا تضيف وزنًا إلى إجمالي الإنجاز", () => {
  const result = applyCompanyRules([
    { kpiKey: "new_lines", target: 100, achieved: 100, weight: 40, unitAr: "خط" },
    { kpiKey: "new_orange_cash", target: 90, achieved: 90, weight: 0, unitAr: "محفظة" },
  ]);
  assert.equal(result.total, 40);
  assert.equal(result.walletDone, true);
  assert.equal(result.commissionEligible, false);
});

check("بوابة 90% للمؤشرات الموزونة", () => {
  const below = applyCompanyRules([
    { kpiKey: "new_lines", target: 100, achieved: 89, weight: 40, unitAr: "خط" },
  ]);
  const atThreshold = applyCompanyRules([
    { kpiKey: "new_lines", target: 100, achieved: 90, weight: 40, unitAr: "خط" },
  ]);
  assert.deepEqual(below.belowKpis, ["new_lines"]);
  assert.deepEqual(atThreshold.belowKpis, []);
});

check("سقف الإجمالي الشهري 200% فقط", () => {
  const result = applyCompanyRules([
    { kpiKey: "new_lines", target: 100, achieved: 600, weight: 40, unitAr: "خط" },
    { kpiKey: "existing_wallets", target: 100, achieved: 600, weight: 15, unitAr: "محفظة" },
    { kpiKey: "points", target: 100, achieved: 600, weight: 10, unitAr: "نقطة" },
    { kpiKey: "postpaid_lines", target: 100, achieved: 600, weight: 10, unitAr: "خط" },
    { kpiKey: "dsl", target: 100, achieved: 600, weight: 10, unitAr: "خط" },
    { kpiKey: "quality", target: 100, achieved: 600, weight: 15, unitAr: "%" },
  ]);
  assert.equal(result.rawTotal, 600);
  assert.equal(result.total, 200);
});

check("الكوميشن لا يتجاوز 200% ولا يقل عن صفر", () => {
  assert.equal(estimatedCommission(6000, 250), 12000);
  assert.equal(estimatedCommission(6000, -10), 0);
  assert.equal(estimatedCommission(6000, 80), 4800);
});

check("النسخ الاحتياطي: قبول ملف سليم ورفض الحقول الحساسة", () => {
  const valid = {
    schemaVersion: 1,
    exportedAt: "2026-11-08T12:00:00.000Z",
    isEmpty: true,
    emptyReason: "no data",
    profile: { name: "Test User", branch: "Test Branch" },
    months: [],
    entries: [],
    articles: [],
  };
  assert.equal(parseBackup(valid).schemaVersion, 1);
  assert.throws(() => parseBackup({ ...valid, profile: { ...valid.profile, password: "should-not-be-here" } }));
});

check("النسخ الاحتياطي: رفض الشهر المكرر والتاريخ غير الحقيقي", () => {
  const month = {
    yearMonth: "2026-11",
    fullCommission: 6000,
    workingDays: { sat: true, sun: true, mon: true, tue: true, wed: true, thu: true, fri: true },
    kpis: [],
    holidays: [],
  };
  const base = {
    schemaVersion: 1,
    exportedAt: "2026-11-08T12:00:00.000Z",
    isEmpty: false,
    emptyReason: null,
    profile: { name: "Test User", branch: "Test Branch" },
    months: [month],
    entries: [],
    articles: [],
  };
  assert.throws(() => parseBackup({ ...base, months: [month, month] }));
  assert.throws(() => parseBackup({
    ...base,
    months: [{ ...month, holidays: [{ date: "2026-02-30", note: null }] }],
  }));
});

check("التحقق من الكميات: الكسور للـ Quality فقط", () => {
  assert.deepEqual(validateQuantity("quality", 97.5), { ok: true, value: 97.5 });
  assert.equal(validateQuantity("new_lines", 1.5).ok, false);
  assert.equal(validateQuantity("quality", 101).ok, false);
});

check("الاستعادة بالدمج: إزالة التكرار مع الحفاظ على التكرار المشروع", () => {
  const incoming: BackupEntry[] = [
    { kpiKey: "new_lines", quantity: 2, entryDate: "2026-11-08", note: "shift", },
    { kpiKey: "new_lines", quantity: 2, entryDate: "2026-11-08", note: "shift", },
  ];
  const existing = [
    { id: "saved-1", kpiKey: "new_lines", quantity: 2, entryDate: "2026-11-08", note: "shift" },
  ];
  const plan = planEntryRestore(incoming, existing, "merge");
  assert.equal(plan.entriesSkipped, 1);
  assert.equal(plan.entriesInserted, 1);
  assert.equal(plan.toInsert.length, 1);
  assert.equal(plan.skipped.length, 1);
  assert.equal(planEntryRestore(incoming, existing, "replace").entriesInserted, 2);
});

console.log("\nاكتملت اختبارات الحسابات والنسخ الاحتياطي والكميات بنجاح.");
