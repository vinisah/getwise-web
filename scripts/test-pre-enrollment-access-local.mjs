// Requires the local launcher on port 3001 and Playwright (or the Codex bundled runtime).
// Fixtures are created directly in the guarded local DB: no email is sent.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import pg from "pg";
import bcrypt from "bcryptjs";

const dbUrl = new URL(process.env.DATABASE_URL);
assert.ok(
  dbUrl.hostname === "127.0.0.1" && dbUrl.port === "55432" && dbUrl.pathname === "/getwise_feature",
  "Somente o banco local getwise_feature é permitido."
);
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require(resolve(dirname(process.execPath), "../node_modules/playwright")));
}
const base = "http://127.0.0.1:3001";
const run = randomUUID();
const users = [0, 1, 2].map((i) => ({ id: `qa-access-${run}-${i}`, email: `qa-access-${run}-${i}@example.invalid` }));
const entries = [0, 1, 2].map((i) => `qa-entry-${run}-${i}`);
const password = `Qa-${randomUUID()}`;
const reportDir = join(process.env.LOCALAPPDATA, "GetWise", "reports", "pre-enrollment-access");
await mkdir(reportDir, { recursive: true });
const db = new pg.Client({ connectionString: dbUrl.toString() });
await db.connect();
let browser;
const checks = [];
const errors = [];

function cpf(seed) {
  const digits = String(seed).padStart(9, "0").slice(0, 9).split("").map(Number);
  for (let n = 9; n <= 10; n++) {
    const remainder = (digits.reduce((sum, digit, i) => sum + digit * (n + 1 - i), 0) * 10) % 11;
    digits.push(remainder === 10 ? 0 : remainder);
  }
  return digits.join("");
}
try {
  const unit = (
    await db.query('SELECT "schoolUnitId", "courseId" FROM school_unit_courses WHERE "schoolUnitId"=$1 LIMIT 1', [
      "gw-marechal",
    ])
  ).rows[0];
  assert.ok(unit, "Marechal deve ter ao menos um curso vinculado.");
  const hash = await bcrypt.hash(password, 10);
  for (const user of users) {
    await db.query('INSERT INTO users (id,name,email,password,role,"updatedAt") VALUES ($1,$2,$3,$4,$5,NOW())', [
      user.id,
      "Conta fictícia de acompanhamento",
      user.email,
      hash,
      "APPLICANT",
    ]);
  }
  const seed = Math.floor(Math.random() * 800000000 + 100000000);
  for (let i = 0; i < entries.length; i++) {
    const owner = users[i === 2 ? 1 : 0];
    const person = {
      name: `Aluno fictício ${i + 1}`,
      cpf: cpf(seed + i),
      birthDate: "2015-02-10",
      gender: "Não informado",
      maritalStatus: "Não se aplica",
      profession: "Estudante",
      workplace: "Escola fictícia",
      phone: "45999999999",
      email: owner.email,
      zipCode: "85960000",
      address: "Endereço fictício",
      number: "1",
      neighborhood: "Centro",
    };
    const data = {
      schoolUnitId: unit.schoolUnitId,
      courseId: unit.courseId,
      consultant: "Secretaria",
      student: person,
      guardian: { ...person, name: "Responsável fictício", cpf: cpf(seed + i + 3), birthDate: "1990-03-20" },
      relationship: "Responsável",
      allergies: "NO",
      allergyDetails: "",
      learningNeeds: "",
      source: "Teste automatizado",
      favorite: "Acolhimento",
    };
    await db.query(
      'INSERT INTO pre_enrollments (id,"requestId",protocol,"applicantId","schoolUnitId","courseId","studentCpf","studentName",data,status,feedback,"updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())',
      [
        entries[i],
        randomUUID(),
        `GW-QA-${run}-${i}`,
        owner.id,
        unit.schoolUnitId,
        unit.courseId,
        person.cpf,
        person.name,
        data,
        i === 1 ? "CORRECTION" : "PENDING",
        i === 1 ? "Confira o telefone cadastrado." : "",
      ]
    );
  }
  browser = await chromium.launch({
    executablePath: join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "pt-BR",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await context.request.get(`${base}/api/pre-enrollments?email=${users[0].email}`);
  assert.equal(response.status(), 401);
  await page.goto(`${base}/pre-enrollments/${entries[0]}`);
  await page.waitForURL(
    (url) => url.pathname === "/login" && url.searchParams.get("callbackUrl") === `/pre-enrollments/${entries[0]}`
  );
  checks.push("Consulta sem sessão exige login e preserva o destino");

  await page.goto(`${base}/login`);
  const track = page.getByRole("link", { name: "Acompanhar pré-matrícula", exact: true });
  assert.equal(await track.count(), 1);
  await page.screenshot({ path: join(reportDir, "login-desktop.png"), fullPage: true });
  await track.click();
  await page.getByRole("heading", { name: "Acompanhe sua pré-matrícula" }).waitFor();
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `Login sem overflow em ${width}px`
    );
    await page.screenshot({ path: join(reportDir, `acesso-${width}.png`), fullPage: true });
  }
  await page.getByLabel(/^E-mail/).fill(users[0].email.toUpperCase());
  await page.getByLabel(/^Senha/).fill("senha-incorreta");
  await page.getByRole("button", { name: "Consultar situação", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Confira seu e-mail e senha" }).waitFor();
  assert.equal(await page.getByLabel(/^E-mail/).inputValue(), users[0].email.toUpperCase());
  await page.getByLabel(/^Senha/).fill(password);
  await page.getByLabel(/^Senha/).press("Enter");
  await page.waitForURL(`${base}/pre-enrollments`);
  await page.getByText(users[0].email, { exact: true }).waitFor();
  await page.getByText("Conta de acompanhamento:", { exact: true }).waitFor();
  await page
    .getByRole("link", { name: /Aluno fictício 1/ })
    .getByText("Em análise", { exact: true })
    .waitFor();
  await page
    .getByRole("link", { name: /Aluno fictício 2/ })
    .getByText("Ajustes solicitados", { exact: true })
    .waitFor();
  assert.equal(await page.getByText("Aluno fictício 3", { exact: true }).count(), 0);
  checks.push("Botão no login, recuperação de senha incorreta e entrada por teclado com e-mail do responsável");
  const own = await (
    await context.request.get(`${base}/api/pre-enrollments?email=${users[1].email}&applicantId=${users[1].id}`)
  ).json();
  assert.equal(own.accountEmail, users[0].email);
  assert.deepEqual(own.items.map((item) => item.id).sort(), entries.slice(0, 2).sort());
  assert.equal((await context.request.get(`${base}/api/pre-enrollments/${entries[2]}`)).status(), 404);
  checks.push("Irmãos na mesma conta e isolamento de consulta/detalhe entre famílias");
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `Acompanhamento sem overflow em ${width}px`
    );
    await page.screenshot({ path: join(reportDir, `situacao-${width}.png`), fullPage: true });
  }
  await page.getByRole("link", { name: /Aluno fictício 1/ }).click();
  await page.waitForURL(`${base}/pre-enrollments/${entries[0]}`);
  await page.getByRole("heading", { name: "Aluno fictício 1", level: 1, exact: true }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: "Aluno fictício 1", level: 1, exact: true }).waitFor();
  await page.getByRole("link", { name: /Voltar às pré-matrículas/ }).click();
  await page.getByRole("button", { name: "Entrar com outro e-mail" }).click();
  await page.waitForURL(`${base}/login?mode=pre-enrollment`);
  await page.getByLabel(/^E-mail/).fill(users[2].email);
  await page.getByLabel(/^Senha/).fill(password);
  await page.getByRole("button", { name: "Consultar situação", exact: true }).click();
  await page.waitForURL(`${base}/pre-enrollments`);
  await page.getByRole("heading", { name: "Nenhuma pré-matrícula vinculada a esta conta" }).waitFor();
  checks.push("Detalhe, recarga com sessão preservada e troca para conta sem solicitações sem abrir o cadastro");
  await page.screenshot({ path: join(reportDir, "conta-sem-solicitacoes.png"), fullPage: true });
  await page.route("**/api/pre-enrollments?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Consulta temporariamente indisponível." }),
    })
  );
  await page.reload();
  await page.getByRole("alert").filter({ hasText: "Consulta temporariamente indisponível." }).waitFor();
  await page.unroute("**/api/pre-enrollments?*");
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await page.getByRole("heading", { name: "Nenhuma pré-matrícula vinculada a esta conta" }).waitFor();
  checks.push("Falha de consulta com nova tentativa; Chrome 1280, 390 e 320 px sem overflow");
  assert.deepEqual(errors, []);
  const report = { result: "PASS", checks, screenshots: reportDir, noPageErrors: true };
  await writeFile(join(reportDir, "result.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close();
  await db.query("DELETE FROM pre_enrollments WHERE id = ANY($1::text[])", [entries]);
  await db.query('DELETE FROM audit_logs WHERE "userId" = ANY($1::text[])', [users.map((user) => user.id)]);
  await db.query("DELETE FROM users WHERE id = ANY($1::text[])", [users.map((user) => user.id)]);
  await db.end();
}
