import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * اختبارات أسئلة التضييق في المساعد: الأسئلة الغامضة أو العامة أو المكتوبة
 * بفرانكو/أخطاء إملائية لازم تنتهي بسؤال تضييق واحد (مع اختيارات) أو بكود SR،
 * وممنوع تنتهي بـ«المعلومة مش موجودة» (طريق مسدود).
 *
 * حالات الاختبار في scripts/test-assistant-narrowing.cases.json (ملف محلي، gitignored).
 * انسخ scripts/test-assistant-narrowing.cases.example.json وعدّل عليه.
 *
 * الوضع الافتراضي (offline): بيتأكد إن قالب السؤال-والاختيارات بتاع
 * splitNarrowingOptions بيتفسر صح (الاختيارات بتتفصل عن جسم الرسالة).
 *
 * الوضع الحي (بعد تشغيل الـ endpoint):
 *   ASSISTANT_URL="https://<deployment>/track-your-sales/api/assistant/" node scripts/test-assistant-narrowing.mjs --live
 * لكل سؤال بيتأكد إن الإجابة فيها علامة استفهام أو كود SR، وإنها مش رد «مش موجودة».
 */

const casesPath = path.join(process.cwd(), "scripts", "test-assistant-narrowing.cases.json");
if (!existsSync(casesPath)) {
  console.error("ملف الحالات مش موجود: scripts/test-assistant-narrowing.cases.json");
  console.error("انسخ scripts/test-assistant-narrowing.cases.example.json وعدّل عليه (الملف خاص وgitignored).");
  process.exit(1);
}
const CASES = JSON.parse(readFileSync(casesPath, "utf8"));

const live = process.argv.includes("--live");

if (!live) {
  const { createJiti } = await import("jiti");
  const jiti = createJiti(import.meta.url);
  const { splitNarrowingOptions } = jiti("../src/lib/narrowing.ts");

  const sample = "محتاج أوضح حاجة واحدة: المشكلة في إيه بالظبط؟\n- خصم رصيد\n- الشبكة ضعيفة\n- الفاتورة\n- المحفظة";
  const parsed = splitNarrowingOptions(sample);
  if (parsed.options.length !== 4 || parsed.options[0] !== "خصم رصيد" || !parsed.body.includes("بالظبط؟")) {
    console.error("✗ قالب السؤال-والاختيارات مش بيتفسر صح:", JSON.stringify(parsed));
    process.exit(1);
  }
  // قائمة عادية من غير سؤال قبلها متتحولش لأزرار
  const plain = "الإجابة المختصرة\n- تفصيلة أولى\n- تفصيلة تانية";
  const plainParsed = splitNarrowingOptions(plain);
  if (plainParsed.options.length !== 0) {
    console.error("✗ قائمة عادية اتفسرّت غلط كاختيارات تضييق:", JSON.stringify(plainParsed));
    process.exit(1);
  }
  console.log("✓ قالب السؤال-والاختيارات (splitNarrowingOptions) شغال صح.");
  console.log("للاختبار الحي بعد التشغيل: ASSISTANT_URL=<رابط الـ endpoint> node scripts/test-assistant-narrowing.mjs --live");
  process.exit(0);
}

const url = process.env.ASSISTANT_URL;
if (!url) {
  console.error("لازم ASSISTANT_URL في الوضع الحي.");
  process.exit(1);
}

const DEAD_END = /مش موجودة|مش لاقي|مش متاحة/;
const QUESTION = /[؟?]/;
const CODE = /SR\s*#?\s*\d{3,6}/;

let failed = 0;
for (const c of CASES) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: c.question }),
    });
    const data = await res.json();
    const answer = String(data.answer ?? "");
    const deadEnd = DEAD_END.test(answer) && !QUESTION.test(answer);
    const lands = QUESTION.test(answer) || CODE.test(answer);
    if (!res.ok || deadEnd || !lands) {
      failed += 1;
      console.error(`✗ سؤال: ${c.question}\n  طريق مسدود: ${deadEnd} | فيه سؤال/كود: ${lands} | حالة: ${res.status}\n  إجابة: ${answer.slice(0, 200)}`);
    } else {
      console.log(`✓ ${c.question} → ${QUESTION.test(answer) ? "سؤال تضييق" : "كود"}`);
    }
  } catch (err) {
    failed += 1;
    console.error(`✗ سؤال: ${c.question} — خطأ اتصال: ${err}`);
  }
}
console.log(failed ? `\n${failed} من ${CASES.length} سؤال غامض انتهى بطريق مسدود.` : `\nكل الأسئلة الغامضة (${CASES.length}) انتهت بسؤال تضييق أو كود، مفيش طريق مسدود.`);
process.exit(failed ? 1 : 0);
