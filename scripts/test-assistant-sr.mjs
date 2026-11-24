import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * اختبارات دقة أكواد SR في المساعد.
 *
 * حالات الاختبار (أسئلة عربية + الأكواد المتوقعة) خاصة زي قاعدة المعرفة، فبتتقري من
 * scripts/test-assistant-sr.cases.json (ملف محلي، gitignored). انسخ
 * scripts/test-assistant-sr.cases.example.json وعدّل عليه.
 *
 * الوضع الافتراضي (offline): بيتأكد إن كل كود متوقع موجود حرفي في
 * src/server/assistant/knowledge-base.md (ملف محلي برضه).
 *
 * الوضع الحي (بعد تشغيل الـ endpoint):
 *   ASSISTANT_URL="https://<deployment>/track-your-sales/api/assistant/" node scripts/test-assistant-sr.mjs --live
 * بيبعت كل سؤال للمساعد وبيتحقق إن الإجابة فيها الكود المتوقع حرفي.
 */

const casesPath = path.join(process.cwd(), "scripts", "test-assistant-sr.cases.json");
if (!existsSync(casesPath)) {
  console.error("ملف الحالات مش موجود: scripts/test-assistant-sr.cases.json");
  console.error("انسخ scripts/test-assistant-sr.cases.example.json وعدّل الأكواد الحقيقية جواه (الملف خاص وgitignored).");
  process.exit(1);
}
const CASES = JSON.parse(readFileSync(casesPath, "utf8"));

const live = process.argv.includes("--live");

if (!live) {
  const kbPath = path.join(process.cwd(), "src", "server", "assistant", "knowledge-base.md");
  if (!existsSync(kbPath)) {
    console.error("قاعدة المعرفة المحلية مش موجودة: src/server/assistant/knowledge-base.md (ملف خاص، gitignored).");
    process.exit(1);
  }
  const kb = readFileSync(kbPath, "utf8");
  let failed = 0;
  for (const c of CASES) {
    for (const code of c.expect) {
      const ok = kb.includes(`SR ${code}`) || kb.includes(`SR# ${code}`) || kb.includes(`SR${code}`);
      if (!ok) {
        failed += 1;
        console.error(`✗ الكود ${code} مش موجود حرفي في قاعدة المعرفة (سؤال: ${c.question})`);
      }
    }
  }
  if (failed) {
    console.error(`\n${failed} كود ناقص من القاعدة.`);
    process.exit(1);
  }
  console.log(`✓ ${CASES.length} حالة اختبار صحيحة وكل الأكواد المتوقعة موجودة حرفي في قاعدة المعرفة.`);
  console.log("للاختبار الحي بعد التشغيل: ASSISTANT_URL=<رابط الـ endpoint> node scripts/test-assistant-sr.mjs --live");
  process.exit(0);
}

const url = process.env.ASSISTANT_URL;
if (!url) {
  console.error("لازم ASSISTANT_URL في الوضع الحي.");
  process.exit(1);
}

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
    const missing = c.expect.filter((code) => !answer.includes(code));
    if (!res.ok || missing.length) {
      failed += 1;
      console.error(`✗ سؤال: ${c.question}\n  ناقص: ${missing.join(", ") || "—"} | حالة: ${res.status}\n  إجابة: ${answer.slice(0, 200)}`);
    } else {
      console.log(`✓ ${c.question} → ${c.expect.join(" / ")}`);
    }
  } catch (err) {
    failed += 1;
    console.error(`✗ سؤال: ${c.question} — خطأ اتصال: ${err}`);
  }
}
console.log(failed ? `\n${failed} من ${CASES.length} حالة فشلت.` : `\nكل حالات الـ SR (${CASES.length}) نجحت: الأكواد راجعة حرفي.`);
process.exit(failed ? 1 : 0);
