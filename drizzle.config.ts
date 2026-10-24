import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// بيانات الاتصال من البيئة فقط (DATABASE_URL في .env) — مفيش بيانات اتصال مكتوبة في الريبو.
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL مش موجود. انسخ .env.example إلى .env واملأه.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
