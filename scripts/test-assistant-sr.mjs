import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * اختبارات دقة أكواد SR في المساعد.
 *
 * الوضع الافتراضي (offline): بيتأكد إن كل كود متوقع موجود حرفي في قاعدة المعرفة،
 * يعني حالات الاختبار نفسها صح.
 *
 * الوضع الحي (بعد ما الـ endpoint يشتغل على Vercel):
 *   ASSISTANT_URL="https://<deployment>/track-your-sales/api/assistant/" node scripts/test-assistant-sr.mjs --live
 * بيبعت كل سؤال للمساعد وبيتحقق إن الإجابة فيها الكود المتوقع بالظبط.
 */

const CASES = [
  { question: "عميلة من أسر الشهداء عايزة خصم على الـ DSL، أنهي كود SR؟", expect: ["33203"], section: "الأكواد المختصرة" },
  { question: "محفظة أورنچ كاش واقفة بطلب من الجهاز القومي لتنظيم الاتصالات، أنهي SR؟", expect: ["11306"], section: "الأكواد المختصرة" },
  { question: "عميل من ذوي الهمم عايز يعمل خط جديد بالخصم، أكواد الـ SR إيه؟", expect: ["11527", "11528"], section: "الأكواد المختصرة" },
  { question: "حافز تنزيل وتفعيل تطبيق Max It بيتحسب على أنهي كود SR؟", expect: ["60619"], section: "الأكواد المختصرة" },
  { question: "جالي إيقاف بسبب بيانات ناقصة من البنك المركزي، أنهي كود؟", expect: ["11189"], section: "الأكواد المختصرة" },
  { question: "في دايلات B2B والبيانات طلعت غير متطابقة، أنهي SR؟", expect: ["11993"], section: "الأكواد المختصرة" },
];

const live = process.argv.includes("--live");

if (!live) {
  const kb = readFileSync(path.join(process.cwd(), "src", "server", "assistant", "knowledge-base.md"), "utf8");
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
