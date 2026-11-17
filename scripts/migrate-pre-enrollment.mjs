import "dotenv/config";
import pg from "pg";
import { readFile } from "node:fs/promises";
const url = new URL(process.env.DATABASE_URL);
const allowed = (process.env.DATABASE_ALLOWED_NAMES || "getwise,neondb").split(",");
if (!allowed.includes(url.pathname.slice(1))) throw Error("Banco fora da lista permitida");
if (process.env.VERCEL && process.env.VERCEL_ENV !== "production") {
  console.log("Pré-matrícula: migração não executada em preview.");
} else {
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(742192)");
    await client.query(
      await readFile(
        new URL("../prisma/migrations/20261117010000_pre_enrollment/migration.sql", import.meta.url),
        "utf8"
      )
    );
    await client.query("COMMIT");
    console.log("Pré-matrícula e unidade Marechal preparadas.");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    await client.end();
  }
}
