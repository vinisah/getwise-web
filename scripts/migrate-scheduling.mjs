import "dotenv/config";
import pg from "pg";
import { readFile } from "node:fs/promises";

if (process.env.VERCEL && process.env.VERCEL_ENV !== "production") {
  console.log("Scheduling migration runs only in production or explicit local execution.");
} else {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ausente");
  const name = new URL(url).pathname.slice(1);
  const allowed = (process.env.DATABASE_ALLOWED_NAMES || "getwise,neondb").split(",");
  if (!allowed.includes(name)) throw new Error("Banco fora da lista permitida");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(742191)");
    await client.query(await readFile(new URL("../prisma/migrations/20261111010000_scheduling/migration.sql", import.meta.url), "utf8"));
    await client.query("COMMIT");
    console.log("Scheduling schema ready.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { await client.end(); }
}
