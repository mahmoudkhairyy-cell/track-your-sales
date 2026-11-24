import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// بيحوّل knowledge-base.md لملف TypeScript عشان يتعبّأ جوه الـ serverless function
// من غير ما نعتمد على قراءة ملفات وقت التشغيل (مش مضمونة في بيئة Vercel).
const source = path.join(process.cwd(), "src", "server", "assistant", "knowledge-base.md");
const target = path.join(process.cwd(), "src", "server", "assistant", "knowledge-base.ts");
const markdown = readFileSync(source, "utf8");
const banner = "// ملف متولّد من knowledge-base.md — بعد أي تعديل شغّل: node scripts/build-knowledge-base.mjs\n";
writeFileSync(target, `${banner}export const KNOWLEDGE_BASE = ${JSON.stringify(markdown)};\n`);
console.log(`[build-knowledge-base] wrote knowledge-base.ts (${markdown.length} chars)`);
