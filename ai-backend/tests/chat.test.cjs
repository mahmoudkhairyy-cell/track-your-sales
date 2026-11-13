const test = require("node:test");
const assert = require("node:assert/strict");
const {
  findBusinessKnowledge,
  computePostpaidTermination,
  applyCalcMarker,
} = require("../.test-build/chat.js");

const validInput = {
  phone: "غير مطلوب",
  billed: 100,
  monthly: 300,
  daysPassed: 15,
  unbilledUsage: 50,
  unbilledOCC: 20,
};

function marker(input) {
  return `<<CALC>>${JSON.stringify(input)}<<END>>`;
}

test("Postpaid calculator returns the expected total for a known example", () => {
  const result = computePostpaidTermination({
    billed: 100,
    monthly: 300,
    daysPassed: 15,
    unbilledUsage: 50,
    unbilledOCC: 20,
    tariffDays: 30,
    sdf: 10,
  });
  assert.equal(result.total, 383.176);
  assert.equal(result.daily, 10);
  assert.equal(result.subscriptionTillDay, 150);
});

test("valid calculator marker is replaced by a formatted result", () => {
  const answer = applyCalcMarker(marker(validInput));
  assert.match(answer, /383\.18/);
  assert.match(answer, /نتيجة الحسبة التقديرية/);
  assert.doesNotMatch(answer, /<<CALC>>|<<END>>/);
});

test("missing, null, boolean, negative and invalid day values are rejected", () => {
  for (const input of [
    { ...validInput, billed: null },
    { ...validInput, billed: "" },
    { ...validInput, billed: true },
    { ...validInput, billed: -1 },
    { ...validInput, daysPassed: 32 },
    { ...validInput, daysPassed: 15.5 },
    { ...validInput, unbilledOCC: undefined },
  ]) {
    const answer = applyCalcMarker(marker(input));
    assert.match(answer, /تعذر إجراء الحسبة/);
    assert.doesNotMatch(answer, /المبلغ المستحق/);
  }
});

test("non-finite calculation results are rejected", () => {
  const answer = applyCalcMarker(marker({
    ...validInput,
    billed: Number.MAX_VALUE,
    monthly: Number.MAX_VALUE,
    daysPassed: 31,
  }));
  assert.match(answer, /تعذر إجراء الحسبة/);
});

test("Postpaid bill cancellation routes to the Postpaid-to-Prepaid knowledge topic", () => {
  const records = [
    { source: "knowledge-base.json", text: "id: postpaid-migration | title: Postpaid to Prepaid migration | تحويل الفاتورة إلى كارت" },
    { source: "knowledge-base.json", text: "id: dsl-cancellation | title: DSL cancellation | إلغاء DSL" },
  ];
  const matches = findBusinessKnowledge(records, "عاوز ألغي الفاتورة");
  assert.equal(matches[0].text.includes("postpaid-migration"), true);
});

test("DSL cancellation is not routed to the Postpaid calculator topic", () => {
  const records = [
    { source: "knowledge-base.json", text: "id: postpaid-migration | title: Postpaid invoice migration | إلغاء الفاتورة وتحويل إلى كارت" },
    { source: "knowledge-base.json", text: "id: dsl-cancellation | title: DSL cancellation | إلغاء DSL الأرضي" },
  ];
  const matches = findBusinessKnowledge(records, "إلغاء DSL");
  assert.equal(matches.some((item) => item.text.includes("postpaid-migration")), false);
  assert.equal(matches.some((item) => item.text.includes("dsl-cancellation")), true);
});

test("English Postpaid cancellation routes to the migration topic", () => {
  const records = [
    { source: "knowledge-base.json", text: "id: postpaid-migration | title: Postpaid to Prepaid migration | cancel postpaid bill" },
  ];
  const matches = findBusinessKnowledge(records, "cancel postpaid bill");
  assert.equal(matches.length, 1);
  assert.match(matches[0].text, /postpaid-migration/);
});

test("answers without a calculator marker remain unchanged", () => {
  const answer = "الخطوات التفصيلية غير متاحة في المرجع الحالي.";
  assert.equal(applyCalcMarker(answer), answer);
});
