import { cpSync, rmSync } from "node:fs";
import path from "node:path";

// المساعد بيحتاج Route Handler (POST) وده مش مدعوم مع `output: "export"`.
// على Vercel (VERCEL=1) بنحقن الراوت جوه الـ App Router قبل البناء،
// وفي البناء الثابت (GitHub Pages / محلي) بنشيله عشان `next build` يفضل ثابت.
const source = path.join(process.cwd(), "src", "server", "assistant");
const target = path.join(process.cwd(), "src", "app", "api", "assistant");

rmSync(target, { recursive: true, force: true });
if (process.env.VERCEL === "1") {
  cpSync(source, target, { recursive: true });
  console.log("[prepare-assistant-api] Vercel build: assistant API route injected at src/app/api/assistant");
} else {
  console.log("[prepare-assistant-api] static build: assistant API route skipped");
}
