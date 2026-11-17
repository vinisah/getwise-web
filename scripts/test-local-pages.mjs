import "dotenv/config";
import assert from "node:assert/strict";

// Teste HTTP do servidor compilado. A sessão temporária não altera a sessão do Chrome.
const db = new URL(process.env.DATABASE_URL);
assert.equal(db.hostname, "127.0.0.1", "Execute somente contra o ambiente local.");
assert.equal(db.port, "55432");
assert.equal(db.pathname, "/getwise_feature");
const base = "http://127.0.0.1:3001";
const cookies = new Map();
async function request(path, body, form = false) {
  const response = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      Origin: base,
      Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; "),
      ...(body ? { "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" } : {}),
    },
    body: body ? (form ? new URLSearchParams(body) : JSON.stringify(body)) : undefined,
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
  });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";")[0];
    const delimiter = pair.indexOf("=");
    cookies.set(pair.slice(0, delimiter), pair.slice(delimiter + 1));
  }
  return { status: response.status, text: await response.text() };
}
const checked = [];
const assets = new Set();
async function page(path, marker) {
  const result = await request(path);
  assert.equal(result.status, 200, `${path} precisa responder 200`);
  assert.match(result.text, /<!DOCTYPE html>/i, `${path} deve renderizar HTML`);
  assert.doesNotMatch(
    result.text,
    /Internal Server Error|InvariantError|Could not find the module|client reference manifest/i
  );
  if (marker) assert.ok(result.text.includes(marker), `${path}: conteúdo esperado não encontrado`);
  for (const match of result.text.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/g))
    assets.add(match[1].replaceAll("&amp;", "&"));
  checked.push(path);
}
await page("/login", "Bem-vindo de volta");
await page("/register", "Vamos começar pelo essencial");
const csrf = JSON.parse((await request("/api/auth/csrf")).text).csrfToken;
assert.ok(csrf);
assert.equal(
  (
    await request(
      "/api/auth/callback/credentials",
      { csrfToken: csrf, demo: "1", json: "true", callbackUrl: base },
      true
    )
  ).status,
  200
);
assert.equal(JSON.parse((await request("/api/auth/session")).text).user.role, "ADMIN");
try {
  assert.equal((await request("/api/admin/preview", { role: "STUDENT" })).status, 200);
  await page("/student", "Você está a caminho da fluência");
  for (const path of [
    "/student/agenda",
    "/student/lessons",
    "/student/courses",
    "/student/exercises",
    "/student/settings",
    "/student/tutor",
  ])
    await page(path);
  assert.equal((await request("/api/admin/preview", { role: "ADMIN" })).status, 200);
  for (const path of ["/admin", "/admin/pre-enrollments", "/admin/school-units"]) await page(path);
  for (const path of assets) assert.equal((await request(path)).status, 200, `Arquivo estático ausente: ${path}`);
  console.log(JSON.stringify({ result: "PASS", pages: checked, staticAssets: assets.size }, null, 2));
} finally {
  const token = JSON.parse((await request("/api/auth/csrf")).text).csrfToken;
  await request("/api/auth/signout", { csrfToken: token, json: "true", callbackUrl: base }, true);
}
