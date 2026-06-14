import { describe, it, expect } from "vitest";
import { CreateTransactionSchema, UpdateTransactionSchema } from "@/lib/schemas";

// Guard de regressão: o refine de prefixo reservado vale só na CRIAÇÃO (input humano).
// A EDIÇÃO reenvia o reference já-existente do sistema (payment:/salary:/recurring:/enrollment:)
// e NÃO pode ser bloqueada — senão recategorizar essas transações quebra com 400.
describe("reference — guard de prefixo reservado", () => {
  const base = { type: "INCOME", amount: "100", description: "x", date: "2026-06-01" };

  it("CREATE rejeita reference com prefixo reservado (input humano)", () => {
    for (const ref of ["payment:abc", "salary:1", "recurring:r:06/2026", "enrollment:e1"]) {
      const r = CreateTransactionSchema.safeParse({ ...base, reference: ref });
      expect(r.success).toBe(false);
    }
  });

  it("CREATE aceita reference manual comum", () => {
    expect(CreateTransactionSchema.safeParse({ ...base, reference: "NF-12345" }).success).toBe(true);
  });

  it("UPDATE aceita reference de sistema (edição reenvia o existente)", () => {
    for (const ref of ["payment:abc", "salary:1", "recurring:src1:06/2026", "enrollment:e1"]) {
      const r = UpdateTransactionSchema.safeParse({ reference: ref, description: "editado" });
      expect(r.success).toBe(true);
    }
  });
});
