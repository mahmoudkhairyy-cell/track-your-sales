#!/usr/bin/env node
/**
 * نقطة دخول الفحص الذاتي: بتشغّل scripts/self-check.impl.ts عن طريق tsx
 * عشان نقدر نستورد كود المشروع الحقيقي (TypeScript + مسارات @/).
 *
 *   npm run selfcheck
 *
 * محتاج DATABASE_URL في .env و Postgres شغال.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

let tsxCli;
try {
  tsxCli = require.resolve("tsx/cli");
} catch {
  console.error("tsx مش متسطّب. شغّل: npm install");
  process.exit(1);
}

const impl = resolve(here, "self-check.impl.ts");
const child = spawn(process.execPath, [tsxCli, "--tsconfig", resolve(here, "..", "tsconfig.json"), impl], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`self-check اتقفل بإشارة ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
