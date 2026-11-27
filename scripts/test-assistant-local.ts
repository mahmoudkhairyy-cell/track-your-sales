// اختبار الإجابات المحلية (من غير Gemini). الحالات في scripts/test-assistant-local.cases.json (خاص، gitignored).
// كل حالة: { q, local: true|false, expect: [نصوص لازم تكون في الإجابة], forbid?: [نصوص ممنوعة] }
// local:false = سؤال لازم يروح للموديل (الإجابة المحلية لازم تكون null).
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { directAnswer, freemaxPriceAnswer } from "../src/server/assistant/direct";
import { FIXED_ANSWERS, localAnswer } from "../src/server/assistant/local";

const kbPath = path.join(process.cwd(), "src/server/assistant/knowledge-base.md");
const casesPath = path.join(process.cwd(), "scripts/test-assistant-local.cases.json");
if (!existsSync(kbPath) || !existsSync(casesPath)) {
  console.error("محتاج knowledge-base.md و test-assistant-local.cases.json (خاصين)");
  process.exit(1);
}
const kb = readFileSync(kbPath, "utf8");
const cases: { q: string; local: boolean; expect?: string[]; forbid?: string[] }[] = JSON.parse(readFileSync(casesPath, "utf8"));
const baseline = process.argv.includes("--baseline");
const verbose = process.argv.includes("-v");

let localHits = 0, localCorrect = 0, wrong = 0, wronglyLocal = 0, localTotal = 0, gemTotal = 0;
const failures: string[] = [];
for (const c of cases) {
  const hit = baseline
    ? (() => { const a = directAnswer(kb, c.q) ?? freemaxPriceAnswer(kb, c.q); return a ? { answer: a, kind: "direct" } : null; })()
    : localAnswer(kb, c.q) ?? (() => { const a = directAnswer(kb, c.q) ?? freemaxPriceAnswer(kb, c.q); return a ? { answer: a, kind: "direct" } : null; })();
  if (c.local) {
    localTotal++;
    if (hit) {
      localHits++;
      const ok = (c.expect ?? []).every((e) => hit.answer.includes(e)) && !(c.forbid ?? []).some((f) => hit.answer.includes(f));
      if (ok) localCorrect++;
      else { wrong++; failures.push(`WRONG [${hit.kind}] ${c.q}\n   -> ${hit.answer.replace(/\n/g, " ⏎ ").slice(0, 220)}\n   expected ${JSON.stringify(c.expect)}`); }
    } else failures.push(`MISS  ${c.q}`);
  } else {
    gemTotal++;
    if (hit) { wronglyLocal++; failures.push(`SHOULD-GO-TO-MODEL but answered [${hit.kind}] ${c.q}\n   -> ${hit.answer.replace(/\n/g, " ⏎ ").slice(0, 160)}`); }
  }
  if (verbose && hit) console.log(`[${hit.kind}] ${c.q}\n${hit.answer}\n`);
}
// حراسة: الأكواد الثابتة لسه موجودة في القاعدة
for (const f of FIXED_ANSWERS) {
  for (const code of f.answer.match(/\b\d{4,5}\b/g) ?? []) {
    if (!kb.includes(code)) failures.push(`DRIFT: الكود ${code} مش موجود في القاعدة`);
  }
}
console.log(failures.join("\n"));
console.log(`\nlocal-eligible: ${localTotal}, answered locally: ${localHits} (${Math.round((100 * localHits) / localTotal)}%), correct: ${localCorrect}, wrong local answers: ${wrong}`);
console.log(`model-only: ${gemTotal}, wrongly answered locally: ${wronglyLocal}`);
process.exit(wrong + wronglyLocal > 0 ? 1 : 0);
