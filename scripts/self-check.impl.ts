#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  achievementPercent,
  applyCompanyRules,
  estimatedCommission,
  kpiContribution,
  managerKpiContribution,
} from "../src/lib/calculations";
import { kpiWeight, managerKpiWeight, MANAGER_FIXED_SALARY, MANAGER_FULL_COMMISSION, KPI_CATALOG, KPI_REPORT_NAMES } from "../src/lib/constants";
import { parseBackup, planEntryRestore, type BackupEntry } from "../src/lib/backup";
import { applyBackupToState, checkRestoreRequest, type RestoreState } from "../src/lib/restore";
import { validateQuantity } from "../src/lib/quantity";
import { QUICK_SRS } from "../src/lib/quick-srs";
import { MASCOT_LINES, pickMascotLine } from "../src/lib/mascot-lines";

function check(name: string, run: () => void) {
  run();
  console.log(`✓ ${name}`);
}

check("الموظف والتيم ليدر لهما نفس الأوزان، وأدوار الإدارة بلا تارجت", () => {
  const keys = ["new_lines", "new_orange_cash", "existing_wallets", "points", "postpaid_lines", "dsl", "productivity", "quality"] as const;
  for (const key of keys) {
    assert.equal(kpiWeight(key, "team_leader"), kpiWeight(key, "agent"));
    assert.equal(kpiWeight(key, "area_manager"), 0);
  }
});

check("أوزان مدير الفرع مستقلة وإجماليها 100% مع مرتب وعمولة 10 آلاف", () => {
  const keys = ["new_lines", "new_orange_cash", "existing_wallets", "points", "postpaid_lines", "dsl", "productivity", "quality"] as const;
  assert.equal(keys.reduce((sum, key) => sum + managerKpiWeight(key), 0), 100);
  assert.deepEqual(keys.map((key) => managerKpiWeight(key)), [30, 0, 10, 10, 10, 10, 15, 15]);
  assert.equal(MANAGER_FIXED_SALARY, 10_000);
  assert.equal(MANAGER_FULL_COMMISSION, 10_000);
});

check("بوابة مدير الفرع: أقل من 90% صفر، و90% يبدأ الاحتساب بلا سقف فردي", () => {
  assert.equal(managerKpiContribution("existing_wallets", 89, 100), 0);
  assert.equal(managerKpiContribution("existing_wallets", 90, 100), 9);
  assert.equal(managerKpiContribution("existing_wallets", 100, 100), 10);
  assert.equal(managerKpiContribution("existing_wallets", 150, 100), 15);
  assert.equal(managerKpiContribution("productivity", 150, 100), 22.5);
  assert.equal(managerKpiContribution("new_orange_cash", 100, 100), 0);
});

check("نسبة الإنجاز والتارجت الصفري", () => {
  assert.equal(achievementPercent(90, 100), 90);
  assert.equal(achievementPercent(10, 0), 0);
});

check("المؤشر الفردي لا يتوقف عند 200%", () => {
  assert.equal(kpiContribution(300, 100, 40), 120);
});

check("المحافظ الجديدة شرط مستقل بنسبة 100% من تارجتها", () => {
  const base = [
    { kpiKey: "new_lines" as const, target: 175, achieved: 100, weight: 40, unitAr: "خط" },
    { kpiKey: "new_orange_cash" as const, target: 158, achieved: 158, weight: 0, unitAr: "محفظة" },
  ];
  assert.equal(applyCompanyRules(base).walletDone, true);
  assert.equal(applyCompanyRules(base).commissionEligible, false);
  const shortWallets = applyCompanyRules(base.map((item) => item.kpiKey === "new_orange_cash" ? { ...item, achieved: 157 } : item));
  assert.equal(shortWallets.walletDone, false);
  assert.equal(shortWallets.commissionEligible, false);
});

check("شرط المحافظ يمنع الكوميشن والخطوط الجديدة حتى مع اكتمال باقي المؤشرات", () => {
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
  assert.equal(blocked.total, 60);
  assert.equal(blocked.walletDone, false);
  assert.equal(blocked.commissionEligible, false);
  const eligible = applyCompanyRules(completeWeightedTargets.map((item) =>
    item.kpiKey === "new_orange_cash" ? { ...item, achieved: 90 } : item,
  ));
  assert.equal(eligible.walletDone, true);
  assert.equal(eligible.commissionEligible, true);
});

check("المدير لا يخضع لشرط المحافظ الجديدة، والموظف يظل خاضعًا له", () => {
  const managerKpis = [
    { kpiKey: "new_lines" as const, target: 100, achieved: 90, weight: 30, unitAr: "خط" },
    { kpiKey: "new_orange_cash" as const, target: 0, achieved: 0, weight: 0, unitAr: "محفظة" },
    { kpiKey: "existing_wallets" as const, target: 100, achieved: 90, weight: 15, unitAr: "محفظة" },
    { kpiKey: "points" as const, target: 100, achieved: 90, weight: 5, unitAr: "نقطة" },
    { kpiKey: "postpaid_lines" as const, target: 100, achieved: 90, weight: 10, unitAr: "خط" },
    { kpiKey: "dsl" as const, target: 100, achieved: 90, weight: 10, unitAr: "خط" },
    { kpiKey: "productivity" as const, target: 100, achieved: 90, weight: 15, unitAr: "%" },
    { kpiKey: "quality" as const, target: 100, achieved: 90, weight: 15, unitAr: "%" },
  ];
  const manager = applyCompanyRules(managerKpis, { newLinesNeedWallets: false });
  assert.equal(manager.total, 90);
  assert.equal(manager.walletDone, true);
  assert.equal(manager.commissionEligible, true);
  const employee = applyCompanyRules([
    { kpiKey: "new_lines" as const, target: 100, achieved: 90, weight: 40, unitAr: "خط" },
    { kpiKey: "new_orange_cash" as const, target: 100, achieved: 0, weight: 0, unitAr: "محفظة" },
  ]);
  assert.equal(employee.total, 0);
  assert.equal(employee.walletDone, false);
  assert.equal(employee.commissionEligible, false);
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


// ---------- اختبارات الاستعادة والدمج (specs/001-restore-merge-tests) ----------

const WEEK_DAYS = { sat: true, sun: true, mon: true, tue: true, wed: true, thu: true, fri: true };

function rawBackup(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    exportedAt: "2026-11-08T12:00:00.000Z",
    isEmpty: false,
    emptyReason: null,
    profile: { name: "Test User", branch: "Test Branch" },
    months: [],
    entries: [],
    articles: [],
    ...overrides,
  };
}

function emptyRestoreState(): RestoreState {
  return { profile: { name: "Old", branch: "Old" }, entries: [], months: {}, articles: [] };
}

function restoreOptions() {
  let counter = 0;
  return {
    newId: () => `new-${++counter}`,
    now: () => "2026-11-15T00:00:00.000Z",
    qualityFromChecks: (checks: unknown) => ({ checks }),
  };
}

check("استعادة: استيراد نفس الملف مرتين بالدمج ما يكررش السجلات (US1)", () => {
  const entries = Array.from({ length: 10 }, (_, i) => ({
    id: `e-${i + 1}`,
    kpiKey: "new_lines",
    quantity: 1,
    entryDate: `2026-11-${String(i + 1).padStart(2, "0")}`,
    note: null,
  }));
  const backup = parseBackup(rawBackup({ entries }));
  const state = emptyRestoreState();
  assert.equal(applyBackupToState(state, backup, "merge", restoreOptions()).entriesInserted, 10);
  const second = applyBackupToState(state, backup, "merge", restoreOptions());
  assert.equal(second.entriesInserted, 0);
  assert.equal(second.entriesSkipped, 10);
  assert.equal(state.entries.length, 10);
});

check("استعادة: سجلين متطابقين في نفس اليوم يفضلوا اتنين (US1)", () => {
  const twin = { kpiKey: "new_lines", quantity: 2, entryDate: "2026-11-08", note: "shift" };
  const backup = parseBackup(rawBackup({ entries: [twin, twin] }));
  const state = emptyRestoreState();
  applyBackupToState(state, backup, "merge", restoreOptions());
  assert.equal(state.entries.length, 2);
  const again = applyBackupToState(state, backup, "merge", restoreOptions());
  assert.equal(again.entriesInserted, 0);
  assert.equal(state.entries.length, 2);
});

const monthFixture = { yearMonth: "2026-11", fullCommission: 5000, workingDays: WEEK_DAYS, kpis: [], holidays: [] };

check("استعادة بالدمج: الشهر الموجود ما يتكتبش فوقه (US2)", () => {
  const state = emptyRestoreState();
  state.months["2026-11"] = { fullCommission: 6000, workingDays: WEEK_DAYS, kpis: [], holidays: [] };
  const result = applyBackupToState(state, parseBackup(rawBackup({ months: [monthFixture] })), "merge", restoreOptions());
  assert.equal(result.monthsSkipped, 1);
  assert.equal(state.months["2026-11"].fullCommission, 6000);
});

check("استعادة بالدمج: الشهر غير الموجود يتضاف (US2)", () => {
  const state = emptyRestoreState();
  const result = applyBackupToState(state, parseBackup(rawBackup({ months: [monthFixture] })), "merge", restoreOptions());
  assert.equal(result.monthsSkipped, 0);
  assert.equal(state.months["2026-11"].fullCommission, 5000);
});

check("استعادة: القيم السالبة ترفض الملف، والوزن صفر مسموح (US4)", () => {
  assert.throws(() => parseBackup(rawBackup({ months: [{ ...monthFixture, fullCommission: -1 }] })), /صفر أو أكبر/);
  const negativeTarget = {
    ...monthFixture,
    kpis: [{ kpiKey: "new_lines", target: -5, weight: 10, unitAr: "خط", sortOrder: 0 }],
  };
  assert.throws(() => parseBackup(rawBackup({ months: [negativeTarget] })), /صفر أو أكبر/);
  const zeroWeight = {
    ...monthFixture,
    kpis: [{ kpiKey: "new_lines", target: 0, weight: 0, unitAr: "خط", sortOrder: 0 }],
  };
  assert.doesNotThrow(() => parseBackup(rawBackup({ months: [zeroWeight] })));
});

check("استعادة: مقالة بنفس العنوان والمحتوى ما تتضافش مرتين (US3)", () => {
  const backup = parseBackup(rawBackup({ articles: [{ title: "SR", content: "نص" }] }));
  const state = emptyRestoreState();
  applyBackupToState(state, backup, "merge", restoreOptions());
  const again = applyBackupToState(state, backup, "merge", restoreOptions());
  assert.equal(again.articlesSkipped, 1);
  assert.equal(state.articles.length, 1);
});

check("استعادة: مقالة بنفس العنوان ومحتوى مختلف تتضاف (US3)", () => {
  const state = emptyRestoreState();
  applyBackupToState(state, parseBackup(rawBackup({ articles: [{ title: "SR", content: "نص" }] })), "merge", restoreOptions());
  const result = applyBackupToState(
    state,
    parseBackup(rawBackup({ articles: [{ title: "SR", content: "نص مختلف" }] })),
    "merge",
    restoreOptions(),
  );
  assert.equal(result.articlesSkipped, 0);
  assert.equal(state.articles.length, 2);
});

check("استبدال: لازم تأكيد صريح قبل أي تنفيذ (US5)", () => {
  assert.equal(checkRestoreRequest({ mode: "replace" }).ok, false);
  assert.equal(checkRestoreRequest({ mode: "replace", confirmReplace: true }).ok, true);
  assert.equal(checkRestoreRequest({ mode: "merge" }).ok, true);
  assert.equal(checkRestoreRequest({}).ok, false);
});

check("استبدال: النسخة القديمة تتحفظ قبل المسح (US5)", () => {
  const state = emptyRestoreState();
  state.entries.push({
    id: "old-1",
    kpiKey: "new_lines",
    quantity: 3,
    entryDate: "2026-11-01",
    note: "قديم",
    createdAt: "2026-11-01T00:00:00.000Z",
  });
  let snapshot = "";
  const backup = parseBackup(rawBackup({ profile: { name: "New", branch: "New" } }));
  applyBackupToState(state, backup, "replace", {
    ...restoreOptions(),
    beforeReplace: (value) => {
      snapshot = value;
    },
  });
  assert.ok(snapshot.includes("old-1"));
  assert.equal(state.entries.length, 0);
});


check("استعادة: الملف التالف أو الناقص يترفض قبل أي كتابة (quickstart)", () => {
  assert.throws(() => parseBackup("not an object"), /مش كائن JSON/);
  assert.throws(() => parseBackup({ schemaVersion: 1, profile: { name: "A", branch: "B" } }), /المخطط ناقص/);
  assert.throws(() => parseBackup(rawBackup({ months: "oops" })), /المخطط ناقص|months/);
});

check("استعادة: نسخة بإصدار غير مدعوم أو أقدم تترفض بوضوح (quickstart)", () => {
  assert.throws(() => parseBackup(rawBackup({ schemaVersion: 0 })), /إصدار الملف غير مدعوم/);
  assert.throws(() => parseBackup(rawBackup({ schemaVersion: 99 })), /إصدار الملف غير مدعوم/);
});

console.log("\nاكتملت اختبارات الحسابات والنسخ الاحتياطي والكميات بنجاح.");


check("استعادة بالدمج لا تغيّر اسم الموظف أو فرعه", () => {
  const state = emptyRestoreState();
  const backup = parseBackup(rawBackup({ profile: { name: "Imported Name", branch: "Imported Branch" } }));
  applyBackupToState(state, backup, "merge", restoreOptions());
  assert.deepEqual(state.profile, { name: "Old", branch: "Old" });
});

check("استعادة بالاستبدال تستعيد الاسم والفرع من النسخة", () => {
  const state = emptyRestoreState();
  const backup = parseBackup(rawBackup({ profile: { name: "Imported Name", branch: "Imported Branch" } }));
  applyBackupToState(state, backup, "replace", restoreOptions());
  assert.deepEqual(state.profile, { name: "Imported Name", branch: "Imported Branch" });
});

check("أزرار الأكواد السريعة: قايمة غير مكررة وكل زرار فيه كوده في الإجابة", () => {
  const labels = QUICK_SRS.map((item) => item.label);
  assert.equal(new Set(labels).size, labels.length, "فيه زرار مكرر");
  const expectedCodes: Record<string, string[]> = {
    "رصيد بيتخصم": ["31319"],
    "إلغاء الفاتورة": ["10758"],
    "إلغاء الـ DSL": ["16058", "5009"],
    "انتظار المكالمات": ["11102", "11119", "31427"],
    "إلغاء الكول تون": ["11119", "31421"],
    "شبكة وحشة": ["31001", "31007"],
    "محفظة أورنچ كاش متوقفة": ["11306", "11189", "4124", "11314", "11311", "16777"],
    "حافز Max It": ["60619"],
  };
  assert.equal(QUICK_SRS.length, Object.keys(expectedCodes).length, "عدد الأزرار اتغير من غير تحديث الاختبار");
  for (const item of QUICK_SRS) {
    const codes = expectedCodes[item.label];
    assert.ok(codes, `زرار غير متوقع: ${item.label}`);
    for (const code of codes) {
      assert.ok(item.answer.includes(code), `الكود ${code} مش موجود في إجابة «${item.label}»`);
    }
    // إجابة الزرار مبيفضلش آخرها سؤال + اختيارات عشان منطق أزرار التضييق ميفسرهاش غلط
    assert.ok(!/[؟?]\s*$/.test(item.answer.trim()), `إجابة «${item.label}» منتهية بعلامة استفهام`);
  }
});

check("رسائل الماسكوت: قوايم مليانة والاختيار حسب الحالة", () => {
  assert.ok(MASCOT_LINES.behind.length >= 3 && MASCOT_LINES.onTrack.length >= 3 && MASCOT_LINES.done.length >= 3 && MASCOT_LINES.any.length >= 3);
  assert.ok(MASCOT_LINES.done.includes(pickMascotLine(100, () => 0.5)) || MASCOT_LINES.any.includes(pickMascotLine(100, () => 0.5)));
  assert.ok(MASCOT_LINES.behind.includes(pickMascotLine(10, () => 0.9)));
  assert.ok(MASCOT_LINES.any.includes(pickMascotLine(null, () => 0.5)));
  assert.ok(typeof pickMascotLine(75, () => 0.1) === "string");
});

check("اسم Line للعرض وGAs ثابت في تقارير المدير", () => {
  assert.equal(KPI_CATALOG.find((k) => k.key === "new_lines")?.nameEn, "Line");
  assert.equal(KPI_REPORT_NAMES.new_lines, "GAs");
});
