import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { assertDatabaseTarget } from "./db-target";

function createPrismaClient() {
  assertDatabaseTarget(process.env.DATABASE_URL);
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    // password NUNCA sai em nenhuma query por padrão (anti-vazamento de hash).
    // Quem precisa (login) faz opt-in explícito: omit: { password: false }.
    omit: { user: { password: true } },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
export type DbClient = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
