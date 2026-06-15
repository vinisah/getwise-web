import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { assertDatabaseTarget } from "@/lib/db-target";

// Guard de isolamento: o GetWise só pode falar com o próprio banco.
// Estes testes travam a invariante (regressão = isolamento furado).
describe("db-target / assertDatabaseTarget", () => {
  const original = process.env.DATABASE_ALLOWED_NAMES;
  beforeEach(() => {
    delete process.env.DATABASE_ALLOWED_NAMES; // estado padrão (allowlist implícita)
  });
  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_ALLOWED_NAMES;
    else process.env.DATABASE_ALLOWED_NAMES = original;
  });

  it("aceita os bancos da allowlist padrão (getwise, neondb)", () => {
    expect(() => assertDatabaseTarget("postgresql://u:p@localhost:5432/getwise?schema=public")).not.toThrow();
    expect(() => assertDatabaseTarget("postgresql://u:p@host-pooler.neon.tech/neondb?sslmode=require")).not.toThrow();
  });

  it("REJEITA banco de outro projeto (solutions_robusto)", () => {
    expect(() => assertDatabaseTarget("postgresql://u:p@localhost:5432/solutions_robusto")).toThrow(
      /Isolamento de banco/
    );
  });

  it("é case-insensitive (GetWise / NEONDB)", () => {
    expect(() => assertDatabaseTarget("postgresql://u:p@localhost:5432/GetWise")).not.toThrow();
    expect(() => assertDatabaseTarget("postgresql://u:p@localhost:5432/NEONDB")).not.toThrow();
  });

  it("string vazia em DATABASE_ALLOWED_NAMES cai no default (|| não ??)", () => {
    process.env.DATABASE_ALLOWED_NAMES = "";
    expect(() => assertDatabaseTarget("postgresql://u:p@localhost:5432/getwise")).not.toThrow();
  });

  it("respeita allowlist customizada e rejeita fora dela", () => {
    process.env.DATABASE_ALLOWED_NAMES = "getwise, ci";
    expect(() => assertDatabaseTarget("postgresql://u:p@localhost:5432/ci")).not.toThrow();
    expect(() => assertDatabaseTarget("postgresql://u:p@localhost:5432/neondb")).toThrow(/Isolamento de banco/);
  });

  it("URL ausente não lança (deixa o prisma/adapter tratar)", () => {
    expect(() => assertDatabaseTarget(undefined)).not.toThrow();
    expect(() => assertDatabaseTarget("")).not.toThrow();
  });

  it("URL malformada lança erro explícito", () => {
    expect(() => assertDatabaseTarget("não-é-uma-url")).toThrow(/malformada/);
  });
});
