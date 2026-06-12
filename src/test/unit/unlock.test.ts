import { describe, it, expect } from "vitest";
import { isUnitUnlocked, type OrderedUnit } from "@/lib/services/unlock";

const ordered: OrderedUnit[] = [
  { id: "u1", moduleOrder: 1, unitOrder: 1 },
  { id: "u2", moduleOrder: 1, unitOrder: 2 },
  { id: "u3", moduleOrder: 2, unitOrder: 1 },
];

describe("isUnitUnlocked (sequencial)", () => {
  it("primeira unidade sempre desbloqueada", () => {
    expect(isUnitUnlocked("u1", ordered, new Set())).toBe(true);
  });

  it("segunda bloqueada se primeira não concluída", () => {
    expect(isUnitUnlocked("u2", ordered, new Set())).toBe(false);
  });

  it("segunda desbloqueada após concluir primeira", () => {
    expect(isUnitUnlocked("u2", ordered, new Set(["u1"]))).toBe(true);
  });

  it("terceira (próximo módulo) exige segunda concluída", () => {
    expect(isUnitUnlocked("u3", ordered, new Set(["u1"]))).toBe(false);
    expect(isUnitUnlocked("u3", ordered, new Set(["u1", "u2"]))).toBe(true);
  });
});
