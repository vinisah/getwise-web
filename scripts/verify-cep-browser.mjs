import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { chromium } = await import(
  pathToFileURL(resolve(dirname(process.execPath), "../node_modules/playwright/index.mjs")).href
);
const base = "http://127.0.0.1:3006";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const checks = [];
const out = "docs/cep-browser";
await mkdir(out, { recursive: true });
async function screenshot(page, file) {
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    "Sem overflow horizontal"
  );
  await page.screenshot({ path: `${out}/${file}.png`, fullPage: true });
  checks.push(file);
}
async function login(context, email, password) {
  const { csrfToken } = await (await context.request.get(`${base}/api/auth/csrf`)).json();
  await context.request.post(`${base}/api/auth/callback/credentials`, {
    form: { csrfToken, email, password, callbackUrl: `${base}/pre-enrollments`, json: "true" },
  });
}
try {
  const family = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  family.setDefaultNavigationTimeout(120000);
  family.setDefaultTimeout(60000);
  const page = await family.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/register`, { timeout: 120000 });
  await page.getByText("Carregando unidades e cursos…").waitFor({ state: "hidden", timeout: 60000 });
  await page.getByLabel("CEP residencial do aluno", { exact: false }).fill("85960002");
  await page.getByRole("button", { name: "Consultar CEP", exact: true }).click();
  await page.getByRole("radio", { name: /^Get Wise Marechal Marechal/ }).waitFor({ timeout: 20000 });
  assert.equal(await page.getByRole("radio").count(), 2);
  await screenshot(page, "01-unidades-da-cidade-desktop");
  await page.setViewportSize({ width: 320, height: 740 });
  await screenshot(page, "02-unidades-da-cidade-320");
  await page.getByRole("button", { name: "Preciso estudar em outra cidade" }).click();
  await page.getByRole("radio", { name: /Toledo/ }).check();
  await page.getByLabel("Nome completo do aluno", { exact: false }).fill("Aluno de avaliação CEP");
  await page.getByLabel("Data de nascimento do aluno", { exact: false }).fill("2015-04-03");
  await page.getByLabel("CPF do aluno", { exact: false }).fill("52998224725");
  await page
    .getByLabel("Por que precisa estudar nesta unidade?", { exact: false })
    .fill("O responsável trabalha nesta cidade durante o horário da aula.");
  await page.getByLabel("Nome completo do responsável", { exact: false }).fill("Responsável de avaliação CEP");
  const email = `browser-cep-${Date.now()}@example.invalid`,
    password = "RevisaoLocal!2026";
  await page.getByLabel("E-mail de acesso do responsável", { exact: false }).fill(email);
  await page.getByLabel(/^Senha/).fill(password);
  await screenshot(page, "03-pedido-outra-cidade-320");
  const responsePromise = page.waitForResponse(
    (r) => r.url().endsWith("/api/auth/enrollment-placement") && r.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Solicitar análise da direção", exact: true }).click();
  const response = await responsePromise;
  const created = await response.json();
  assert.equal(response.status(), 201, JSON.stringify(created));
  await page.getByRole("heading", { name: "Pedido enviado à direção" }).waitFor();
  await screenshot(page, "04-pendente-320");
  await login(family, email, password);
  await page.goto(`${base}/pre-enrollments/${created.id}`);
  await page.getByRole("button", { name: "Concluir pré-matrícula" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Concluir pré-matrícula" }).isDisabled(), true);
  await screenshot(page, "05-acompanhamento-pendente-320");
  const staff = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  staff.setDefaultNavigationTimeout(120000);
  staff.setDefaultTimeout(60000);
  await login(staff, "secretaria.cep@example.invalid", password);
  const staffPage = await staff.newPage();
  await staffPage.goto(`${base}/admin/pre-enrollments/${created.id}`);
  await staffPage.getByText("Somente a direção designada pode decidir este pedido.", { exact: false }).waitFor();
  assert.equal(await staffPage.getByRole("button", { name: "Autorizar esta unidade" }).count(), 0);
  await screenshot(staffPage, "06-secretaria-sem-decisao");
  const director = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  director.setDefaultNavigationTimeout(120000);
  director.setDefaultTimeout(60000);
  await login(director, "direcao.cep@example.invalid", password);
  const direction = await director.newPage();
  await direction.goto(`${base}/admin/pre-enrollments/${created.id}`);
  await direction
    .getByLabel("Justificativa da direção", { exact: false })
    .fill("Deslocamento avaliado; esta unidade atende à necessidade apresentada.");
  await direction.getByRole("button", { name: "Autorizar esta unidade", exact: true }).click();
  assert.match(await direction.getByRole("dialog").innerText(), /não reserva vaga nem efetiva matrícula/);
  await screenshot(direction, "07-direcao-confirmacao");
  await direction.getByRole("button", { name: "Confirmar decisão", exact: true }).click();
  await direction.getByText("Decisão registrada.", { exact: false }).waitFor();
  await page.reload();
  await page.getByRole("button", { name: "Continuar pré-matrícula", exact: true }).waitFor();
  await screenshot(page, "08-excecao-autorizada-320");
  await page.getByRole("button", { name: "Continuar pré-matrícula", exact: true }).click();
  await page.getByRole("button", { name: "Consultar CEP", exact: true }).click();
  await page.getByText("Exceção autorizada para este aluno", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Continuar com esta unidade", exact: true }).click();
  await page.getByRole("button", { name: "Revisar pré-matrícula", exact: true }).waitFor();
  assert.equal(await page.getByLabel("E-mail", { exact: false }).last().inputValue(), email);
  await screenshot(page, "09-retomada-formulario-320");
  assert.deepEqual(errors, []);
  checks.push("sem-excecoes-JavaScript", "CEP-real-server-side", "direcao-secretaria-isoladas");
  await writeFile(
    `${out}/result.json`,
    JSON.stringify(
      {
        checks,
        applicationId: created.id,
        fixtureEmail: email,
        evidence: "Chrome headless, banco exclusivo local; resposta real do ViaCEP",
        viewport: [1366, 320],
      },
      null,
      2
    )
  );
  console.log(JSON.stringify({ passed: checks.length, applicationId: created.id }));
} finally {
  await browser.close();
}
