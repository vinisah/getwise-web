import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
const url = new URL(process.env.DATABASE_URL);
if (url.hostname !== "127.0.0.1" || url.port !== "55432" || url.pathname !== "/getwise_feature")
  throw Error("Este teste só roda no banco local getwise_feature.");
if (process.env.BILLING_PROVIDER && process.env.BILLING_PROVIDER !== "stub")
  throw Error("Este teste exige cobrança local simulada.");
const db = new pg.Client({ connectionString: url.toString() });
await db.connect();
const base = "http://127.0.0.1:3001";
const run = randomUUID().slice(0, 8);
const emails = [`qa-${run}@example.invalid`, `qa-other-${run}@example.invalid`];
const password = `Teste-${randomUUID()}`;
const checks = [];
let testUnitId, testCourseId;
function cpf(seed) {
  const a = String(seed).padStart(9, "0").slice(0, 9).split("").map(Number);
  for (let n = 9; n <= 10; n++) {
    let r = (a.reduce((sum, x, i) => sum + x * (n + 1 - i), 0) * 10) % 11;
    a.push(r === 10 ? 0 : r);
  }
  return a.join("");
}
const n = Math.floor(Math.random() * 800000000 + 100000000);
const person = (i, email, child = false) => ({
  name: `Avaliação automatizada ${run} ${i}`,
  cpf: cpf(n + i),
  birthDate: child ? "2016-02-10" : "1990-03-20",
  gender: "Prefiro não informar",
  maritalStatus: "Não se aplica",
  profession: "Estudante",
  workplace: "Ambiente de teste",
  phone: "45999999999",
  email,
  zipCode: "85960000",
  address: "Endereço fictício de teste",
  number: "1",
  neighborhood: "Centro",
});
function client() {
  const jar = new Map();
  return async (path, method = "GET", body, form = false) => {
    const r = await fetch(base + path, {
      method,
      headers: {
        Origin: base,
        Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
        ...(body ? { "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" } : {}),
      },
      body: body ? (form ? new URLSearchParams(body) : JSON.stringify(body)) : undefined,
      redirect: "manual",
    });
    for (const c of r.headers.getSetCookie()) {
      const pair = c.split(";")[0];
      const idx = pair.indexOf("=");
      jar.set(pair.slice(0, idx), pair.slice(idx + 1));
    }
    const raw = await r.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { html: true };
    }
    return { status: r.status, data, headers: r.headers };
  };
}
const family = client(),
  other = client(),
  admin = client();
async function login(c, email, demo = false) {
  const csrf = await c("/api/auth/csrf");
  const r = await c(
    "/api/auth/callback/credentials",
    "POST",
    { csrfToken: csrf.data.csrfToken, email, password, demo: demo ? "1" : "0", json: "true", callbackUrl: base },
    true
  );
  assert.equal(r.status, 200);
  const session = await c("/api/auth/session");
  assert.ok(session.data.user?.id, "Login deve criar sessão");
  return session.data.user;
}
async function verify(email) {
  const token = (
    await db.query("SELECT token FROM email_verification_tokens WHERE email=$1 ORDER BY expires DESC LIMIT 1", [email])
  ).rows[0]?.token;
  assert.ok(token);
  const r = await family(`/api/auth/verify-email?token=${token}`);
  assert.equal(r.status, 307);
}
try {
  const catalog = await family("/api/auth/enrollment-catalog");
  assert.equal(catalog.status, 200);
  const unit = catalog.data.find((u) => u.id === "gw-marechal");
  assert.ok(unit);
  assert.ok(unit.courses.length);
  assert.equal(unit.cnpj, undefined);
  assert.equal(unit.partners, undefined);
  checks.push("Marechal, cursos vinculados e catálogo público mínimo");
  const initial = {
    schoolUnitId: unit.id,
    courseId: unit.courses[0].course.id,
    consultant: "Secretaria",
    student: person(1, emails[0]),
    guardian: null,
    relationship: "",
    allergies: "NO",
    allergyDetails: "",
    learningNeeds: "",
    source: "Teste",
    favorite: "Acolhimento",
  };
  const payload = { data: initial, password, requestId: randomUUID() };
  let r = await family("/api/auth/register", "POST", payload);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const protocol = r.data.protocol;
  r = await family("/api/auth/register", "POST", payload);
  assert.equal(r.status, 201);
  assert.equal(r.data.protocol, protocol);
  r = await family("/api/auth/register", "POST", { ...payload, requestId: randomUUID() });
  assert.equal(r.status, 409);
  const account = await login(family, emails[0]);
  assert.equal(account.role, "APPLICANT");
  assert.equal((await family("/api/me/prefs")).status, 403);
  let own = (await family("/api/pre-enrollments")).data.items;
  assert.equal(own.length, 1);
  const adultId = own[0].id;
  assert.equal(
    (await db.query('SELECT COUNT(*)::int AS n FROM enrollments WHERE "studentId"=$1', [account.id])).rows[0].n,
    0
  );
  checks.push("Envio idempotente, conta restrita e nenhuma matrícula automática");
  const minor = {
    ...initial,
    student: person(2, "", true),
    guardian: initial.student,
    relationship: "Responsável",
    allergies: "YES",
    allergyDetails: "Informação fictícia para teste",
  };
  r = await family("/api/auth/register", "POST", { data: minor, password, requestId: randomUUID() });
  assert.equal(r.status, 201);
  const sibling = { ...minor, student: person(3, "", true) };
  r = await family("/api/auth/register", "POST", { data: sibling, password, requestId: randomUUID() });
  assert.equal(r.status, 201);
  own = (await family("/api/pre-enrollments")).data.items;
  assert.equal(own.length, 3);
  const childId = own.find((i) => i.studentName === minor.student.name).id;
  checks.push("Responsável com dois filhos usando a mesma conta");
  await other("/api/auth/register", "POST", {
    data: { ...initial, student: person(4, emails[1]) },
    password,
    requestId: randomUUID(),
  });
  await login(other, emails[1]);
  assert.equal((await other(`/api/pre-enrollments/${adultId}`)).status, 404);
  assert.equal((await other("/api/pre-enrollments?scope=admin")).status, 403);
  checks.push("Isolamento entre famílias e bloqueio administrativo");
  await login(admin, "", true);
  r = await admin(`/api/pre-enrollments/${adultId}`, "POST", { version: 1, action: "APPROVED", feedback: "" });
  assert.equal(r.status, 409);
  await verify(emails[0]);
  r = await admin(`/api/pre-enrollments/${childId}`, "POST", {
    version: 1,
    action: "CORRECTION",
    feedback: "Confira o número do endereço.",
  });
  assert.equal(r.status, 200);
  let entry = (await family(`/api/pre-enrollments/${childId}`)).data;
  r = await family(`/api/pre-enrollments/${childId}`, "PUT", {
    version: entry.version,
    data: { ...minor, student: { ...minor.student, number: "2" } },
  });
  assert.equal(r.status, 200);
  r = await family(`/api/pre-enrollments/${childId}`, "PUT", { version: entry.version, data: minor });
  assert.equal(r.status, 409);
  checks.push("Correção, reenvio e conflito de versão");
  entry = (await admin(`/api/pre-enrollments/${childId}?scope=admin`)).data;
  r = await admin(`/api/pre-enrollments/${childId}`, "POST", {
    version: entry.version,
    action: "APPROVED",
    feedback: "Dados conferidos no teste.",
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const childStudentId = r.data.studentId;
  assert.ok(childStudentId);
  r = await admin(`/api/pre-enrollments/${adultId}`, "POST", { version: 1, action: "APPROVED", feedback: "" });
  assert.equal(r.status, 200);
  assert.equal(r.data.studentId, account.id);
  const plans = (await admin("/api/plans")).data;
  assert.ok(plans.length);
  r = await admin("/api/enrollments", "POST", {
    preEnrollmentId: childId,
    studentId: childStudentId,
    planId: plans[0].id,
    startDate: "2026-11-17",
    discount: 0,
    notes: `Teste ${run}`,
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  r = await admin("/api/enrollments", "POST", {
    preEnrollmentId: childId,
    studentId: childStudentId,
    planId: plans[0].id,
    startDate: "2026-11-17",
  });
  assert.equal(r.status, 409);
  assert.equal((await family(`/api/pre-enrollments/${childId}`)).data.status, "ENROLLED");
  checks.push("Aprovação, ficha do aluno e efetivação sem duplicação");
  r = await family("/api/auth/register", "POST", {
    data: { ...initial, courseId: "inexistente", student: person(5, emails[0]) },
    password,
    requestId: randomUUID(),
  });
  assert.equal(r.status, 409);
  checks.push("Curso sem vínculo recusado no servidor");
  r = await admin("/api/courses", "POST", { title: `Curso QA ${run}`, level: "A1" });
  assert.equal(r.status, 201);
  testCourseId = r.data.id;
  const schoolData = {
    code: `QA-${run}`,
    name: `Unidade QA ${run}`,
    legalName: "Escola fictícia QA",
    cnpj: "",
    zipCode: "85960000",
    address: "Rua de teste",
    number: "1",
    complement: "",
    neighborhood: "Centro",
    city: "Marechal Cândido Rondon",
    state: "PR",
    phone: "",
    mobile: "",
    email: `unit-${run}@example.invalid`,
    classification: "",
    notes: "Teste automatizado descartável",
    logoUrl: "",
    photos: [],
    partners: [],
    consultants: ["Secretaria", "Outro"],
    isActive: true,
    enrollmentOpen: true,
    courseIds: [testCourseId],
  };
  r = await admin("/api/school-units", "POST", schoolData);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  testUnitId = r.data.id;
  let publicUnit = (await family("/api/auth/enrollment-catalog")).data.find((u) => u.id === testUnitId);
  assert.equal(publicUnit.courses[0].course.id, testCourseId);
  r = await admin(`/api/school-units/${testUnitId}`, "PUT", { ...schoolData, enrollmentOpen: false, version: 1 });
  assert.equal(r.status, 200);
  assert.equal(
    (await family("/api/auth/enrollment-catalog")).data.some((u) => u.id === testUnitId),
    false
  );
  r = await family("/api/auth/register", "POST", {
    data: { ...initial, schoolUnitId: testUnitId, courseId: testCourseId, student: person(6, emails[0]) },
    password,
    requestId: randomUUID(),
  });
  assert.equal(r.status, 409);
  r = await admin(`/api/school-units/${testUnitId}`, "PUT", { ...schoolData, version: 1 });
  assert.equal(r.status, 409);
  r = await admin(`/api/school-units/${testUnitId}`, "PUT", { ...schoolData, version: 2 });
  assert.equal(r.status, 200);
  let associations = (await admin(`/api/courses/${testCourseId}/school-units`)).data;
  assert.deepEqual(associations.selected, [testUnitId]);
  r = await admin(`/api/courses/${testCourseId}/school-units`, "PUT", { unitIds: [], version: associations.version });
  assert.equal(r.status, 200);
  publicUnit = (await family("/api/auth/enrollment-catalog")).data.find((u) => u.id === testUnitId);
  assert.equal(publicUnit.courses.length, 0);
  r = await admin(`/api/courses/${testCourseId}/school-units`, "PUT", {
    unitIds: [testUnitId],
    version: associations.version,
  });
  assert.equal(r.status, 409);
  checks.push("Cadastro/edição de unidade, fechamento, vínculo pelo curso e conflitos de versão");
  r = await admin("/api/pre-enrollments?scope=admin&from=2026-11-17&to=2026-11-17");
  assert.equal(r.status, 200);
  r = await admin("/api/pre-enrollments?scope=admin&from=2026-11-18&to=2026-11-17");
  assert.equal(r.status, 400);
  checks.push("Período de envio validado no fuso da escola");
  console.log(JSON.stringify({ result: "PASS", checks }, null, 2));
} finally {
  // Somente os registros desta execução (e-mails/nomes aleatórios .invalid).
  const ids = (
    await db.query("SELECT id FROM users WHERE email = ANY($1::text[]) OR name LIKE $2", [
      emails,
      `Avaliação automatizada ${run}%`,
    ])
  ).rows.map((r) => r.id);
  await db.query('DELETE FROM pre_enrollments WHERE "applicantId" = ANY($1::text[])', [ids]);
  await db.query("DELETE FROM email_verification_tokens WHERE email = ANY($1::text[])", [emails]);
  await db.query("DELETE FROM users WHERE id = ANY($1::text[])", [ids]);
  if (testUnitId) await db.query("DELETE FROM school_units WHERE id=$1", [testUnitId]);
  if (testCourseId) await db.query("DELETE FROM courses WHERE id=$1", [testCourseId]);
  await db.end();
}
