/**
 * Isolamento de banco — FONTE ÚNICA do guard, usada por todos os consumidores
 * de DATABASE_URL: o app runtime (src/lib/prisma.ts), o seed (prisma/seed.ts) e
 * o Prisma CLI (prisma.config.ts → db push/generate). Mantém a invariante de
 * que o GetWise só fala com o próprio banco, nunca com outro projeto do cluster.
 *
 * Extrai o nome do database da URL e rejeita qualquer alvo fora da allowlist
 * (ex.: solutions_robusto). Allowlist padrão: getwise (local) + neondb (Neon
 * prod). Sobrescrevível via DATABASE_ALLOWED_NAMES (CSV) — ex.: ambientes de
 * preview/CI legítimos. Comparação é case-insensitive (Postgres faz casefold de
 * identificadores não-aspeados).
 */
export function assertDatabaseTarget(url: string | undefined): void {
  if (!url) return; // ausência é tratada pelo adapter/prisma logo adiante

  let dbName: string;
  try {
    // pathname já vem sem query string (o WHATWG URL joga a query em .search).
    dbName = new URL(url).pathname.replace(/^\//, "");
  } catch {
    throw new Error("DATABASE_URL malformada — impossível validar o banco alvo.");
  }

  // `||` (não `??`): string vazia ("DATABASE_ALLOWED_NAMES=") deve cair no padrão,
  // senão a allowlist ficaria vazia e o app rejeitaria até o banco correto.
  const allowed = (process.env.DATABASE_ALLOWED_NAMES || "getwise,neondb")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (!allowed.includes(dbName.toLowerCase())) {
    throw new Error(
      `Isolamento de banco: DATABASE_URL aponta para "${dbName}", fora da allowlist ` +
        `[${allowed.join(", ")}]. Este app só conecta no banco do GetWise. ` +
        `Ajuste web/.env (ou DATABASE_ALLOWED_NAMES para um ambiente legítimo).`
    );
  }
}
