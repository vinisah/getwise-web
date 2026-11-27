// Operational bootstrap only. No HTTP endpoint, seeded production account or app
// administrator can opt in. Requires separately held database credentials.
import "dotenv/config";
import pg from "pg";
import { randomUUID } from "node:crypto";
const [action, email, confirmation] = process.argv.slice(2);
if (!["grant", "revoke"].includes(action) || !email || confirmation !== `--confirm=${email}`)
  throw Error("Uso: node scripts/designate-school-director.mjs grant|revoke EMAIL --confirm=EMAIL");
const url = new URL(process.env.DATABASE_URL);
if (!(process.env.DATABASE_ALLOWED_NAMES || "").split(",").includes(url.pathname.slice(1)))
  throw Error("Banco fora da lista explícita permitida");
const db = new pg.Client({ connectionString: url.toString() });
await db.connect();
try {
  await db.query("BEGIN");
  const {
    rows: [user],
  } = await db.query(
    'SELECT u.id, u.role, u."isActive", p.sections FROM users u LEFT JOIN access_profiles p ON p.id=u."profileId" WHERE lower(u.email)=$1 FOR UPDATE OF u',
    [email.toLowerCase()]
  );
  if (
    !user ||
    user.role !== "ADMIN" ||
    (action === "grant" && (!user.isActive || (user.sections && !user.sections.includes("pre-enrollments"))))
  )
    throw Error("Alvo precisa ser conta administrativa ativa com acesso a pré-matrículas");
  await db.query('UPDATE users SET "isSchoolDirector"=$1, "updatedAt"=NOW() WHERE id=$2', [
    action === "grant",
    user.id,
  ]);
  await db.query(
    'INSERT INTO audit_logs (id, action, entity, "entityId", payload, "createdAt") VALUES ($1,$2,$3,$4,$5,NOW())',
    [
      randomUUID(),
      "DESIGNATE_SCHOOL_DIRECTOR",
      "User",
      user.id,
      JSON.stringify({ enabled: action === "grant", source: "operator-cli" }),
    ]
  );
  await db.query("COMMIT");
  console.log(`Designação ${action === "grant" ? "concedida" : "revogada"} para a conta indicada.`);
} catch (error) {
  await db.query("ROLLBACK");
  throw error;
} finally {
  await db.end();
}
