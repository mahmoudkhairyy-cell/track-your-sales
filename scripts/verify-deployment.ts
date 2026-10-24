import "dotenv/config";
import { deploymentAccess } from "../src/lib/deployment-access";

/** Read-only preflight: no migrations, seed data, or credential logging. */
async function main() {
  const gate = deploymentAccess(null, { ...process.env, PUBLIC_DEPLOYMENT: "true" });
  if (!gate.allowed && gate.status === 503) {
    throw new Error("Set WORKSPACE_PASSWORD to a unique password of at least 24 characters, and a valid WORKSPACE_USERNAME.");
  }
  if (process.env.AUTH_MODE && process.env.AUTH_MODE !== "single-workspace") {
    throw new Error("AUTH_MODE=sessions is not wired yet. Use single-workspace with the mandatory deployment password gate.");
  }

  const connection = process.env.DATABASE_URL;
  if (!connection) throw new Error("Connect a hosted PostgreSQL database and set DATABASE_URL.");
  let url: URL;
  try {
    url = new URL(connection);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("DATABASE_URL must use postgres:// or postgresql://.");
  }
  if (["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "::1"].includes(url.hostname)) {
    throw new Error("The sandbox database cannot be used from Vercel. Use a hosted PostgreSQL database.");
  }
  if (!["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode") || "")) {
    throw new Error("Use the provider's TLS connection URL with sslmode=require (or verify-full). Do not disable certificate checks.");
  }

  const { db, pool } = await import("../src/db");
  const { users, sessions, entries, monthSettings, kpiSettings, holidays, articles } = await import("../src/db/schema");
  try {
    // LIMIT 0 validates the schema without reading any actual personal data.
    await Promise.all([
      db.select().from(users).limit(0),
      db.select().from(sessions).limit(0),
      db.select().from(entries).limit(0),
      db.select().from(monthSettings).limit(0),
      db.select().from(kpiSettings).limit(0),
      db.select().from(holidays).limit(0),
      db.select().from(articles).limit(0),
    ]);
  } catch {
    throw new Error("Database check failed. Verify its URL, permissions and availability; run npm run db:push against a NEW empty database before the first deployment. No data was modified by this check.");
  } finally {
    await pool.end();
  }
  console.log("Deployment preflight passed: password gate, remote TLS database, and all required tables.");
}

main().catch((error: unknown) => {
  // Only our own messages are logged; connection strings and database errors aren't.
  console.error("Deployment blocked:", error instanceof Error ? error.message : "Configuration check failed.");
  process.exitCode = 1;
});
