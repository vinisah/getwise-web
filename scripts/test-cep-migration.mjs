import "dotenv/config";
import pg from "pg";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const url = new URL(process.env.DATABASE_URL);
if (url.hostname !== "127.0.0.1" || url.port !== "55432" || url.pathname !== "/getwise_cep_test")
  throw Error("Banco exclusivo obrigatório");
const db = new pg.Client({ connectionString: url.toString() });
await db.connect();
try {
  await db.query("BEGIN");
  const schema = `cep_migration_${randomUUID().replaceAll("-", "")}`;
  await db.query(`CREATE SCHEMA "${schema}"`);
  await db.query(`SET LOCAL search_path TO "${schema}"`);
  await db.query(
    'CREATE TABLE users (id TEXT PRIMARY KEY); CREATE TABLE pre_enrollments (id TEXT PRIMARY KEY, "courseId" TEXT NOT NULL, data JSONB); CREATE TABLE enrollments (id TEXT PRIMARY KEY)'
  );
  await db.query(
    `INSERT INTO users VALUES ('legacy'); INSERT INTO pre_enrollments VALUES ('legacy','course','{"student":{"zipCode":"00000000"},"favorite":"Preservar"}'); INSERT INTO enrollments VALUES ('legacy')`
  );
  const sql = await readFile(
    new URL("../prisma/migrations/20261126010000_enrollment_cep/migration.sql", import.meta.url),
    "utf8"
  );
  await db.query(sql);
  await db.query(sql);
  assert.equal((await db.query('SELECT "isSchoolDirector" FROM users')).rows[0].isSchoolDirector, false);
  assert.deepEqual((await db.query('SELECT data,"geographyRequired","residence" FROM pre_enrollments')).rows[0], {
    data: { student: { zipCode: "00000000" }, favorite: "Preservar" },
    geographyRequired: false,
    residence: null,
  });
  await db.query(`INSERT INTO pre_enrollments (id, "courseId") VALUES ('draft',NULL)`);
  assert.equal((await db.query('SELECT "preEnrollmentId" FROM enrollments')).rows[0].preEnrollmentId, null);
  console.log(
    "Migração aplicada duas vezes: ficha legada preservada, diretor=false, curso opcional e vínculo aditivo verificados."
  );
} finally {
  await db.query("ROLLBACK");
  await db.end();
}
