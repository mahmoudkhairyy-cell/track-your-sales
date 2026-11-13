const test = require("node:test");
const assert = require("node:assert/strict");
const chatModule = require("../.test-build/chat.js");
const {
  findBusinessKnowledge,
  computePostpaidTermination,
  applyCalcMarker,
  sanitizePostpaidMigrationAnswer,
} = chatModule;
const handler = chatModule.default;

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


test("generic Arabic Postpaid-to-card questions get a deterministic grounded answer", () => {
  for (const query of [
    "عاوز أغير من فاتورة لكارت، أعملها إزاي؟",
    "إلغاء الفاتورة",
    "عايز احول خط بوستبيد لكارت",
    "How do I change my postpaid bill to prepaid?",
  ]) {
    const answer = sanitizePostpaidMigrationAnswer(
      "راجع Tariff Lock على Siebel ثم سوّي الأقساط على Wincash واسترد نقاط الولاء.",
      query,
    );
    assert.match(answer, /خطوات التنفيذ داخل Siebel.*غير موثقة/);
    assert.match(answer, /Postpaid Calculator/);
    assert.doesNotMatch(answer, /Tariff Lock|Wincash|Loyalty Points|نقاط الولاء/);
  }
});

test("explicit questions about calculator notes retain the model answer for qualification", () => {
  const answer = "الملف يذكر Tariff Lock وWincash وLoyalty Points كملاحظات.";
  assert.equal(sanitizePostpaidMigrationAnswer(answer, "هل Tariff Lock وWincash مطلوبين؟"), answer);
});

test("financial calculation requests are not replaced by the generic migration answer", () => {
  const answer = "من فضلك ابعت قيم الحاسبة الخمسة.";
  assert.equal(sanitizePostpaidMigrationAnswer(answer, "احسب مستحقات تحويل فاتورة لكارت"), answer);
});

test("answers without a calculator marker remain unchanged", () => {
  const answer = "الخطوات التفصيلية غير متاحة في المرجع الحالي.";
  assert.equal(applyCalcMarker(answer), answer);
});


function makeResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    ended: false,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    json(value) { this.body = value; },
    end() { this.ended = true; },
  };
}

test("HTTP handler blocks requests from unapproved origins", async () => {
  const res = makeResponse();
  await handler({ method: "POST", headers: { origin: "https://example.com" }, body: { message: "hello" } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.ok, false);
  assert.match(res.body.error, /المصدر غير مسموح/);
});

test("HTTP handler answers CORS preflight for the approved app origin", async () => {
  const res = makeResponse();
  await handler({ method: "OPTIONS", headers: { origin: "https://mahmoudkhairyy-cell.github.io" } }, res);
  assert.equal(res.statusCode, 204);
  assert.equal(res.ended, true);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "https://mahmoudkhairyy-cell.github.io");
});

test("HTTP handler rejects unsupported methods", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const res = makeResponse();
    await handler({ method: "GET", headers: { origin: "https://mahmoudkhairyy-cell.github.io" } }, res);
    assert.equal(res.statusCode, 405);
    assert.equal(res.body.ok, false);
  } finally {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test("HTTP handler reports missing Gemini configuration without exposing secrets", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const res = makeResponse();
    await handler({ method: "POST", headers: { origin: "https://mahmoudkhairyy-cell.github.io" }, body: { message: "اختبار" } }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.ok, false);
    assert.match(res.body.error, /مفتاح Gemini/);
  } finally {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});
