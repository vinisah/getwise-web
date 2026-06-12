import { describe, it, expect } from "vitest";
import { calcLateCharges } from "@/lib/billing";

describe("calcLateCharges", () => {
  it("sem atraso → sem multa nem juros", () => {
    const r = calcLateCharges(39700, 0);
    expect(r.lateFee).toBe(0);
    expect(r.interest).toBe(0);
    expect(r.total).toBe(39700);
  });

  it("dias negativos (ainda não venceu) → valor original", () => {
    expect(calcLateCharges(39700, -5).total).toBe(39700);
  });

  it("30 dias → multa 2% + juros de 1 mês (1%)", () => {
    const r = calcLateCharges(39700, 30);
    expect(r.lateFee).toBe(794); // 2%
    expect(r.interest).toBe(397); // 1%
    expect(r.total).toBe(40891);
  });

  it("15 dias → juros pro-rata (0,5%)", () => {
    const r = calcLateCharges(39700, 15);
    expect(r.lateFee).toBe(794);
    expect(r.interest).toBe(199); // 39700×0,01×15/30 = 198,5 → 199
    expect(r.total).toBe(40693);
  });

  it("101 dias → juros acumulam linearmente", () => {
    const r = calcLateCharges(39700, 101);
    expect(r.lateFee).toBe(794);
    expect(r.interest).toBe(1337); // 39700×0,01×101/30 = 1336,56 → 1337
    expect(r.total).toBe(41831);
  });
});
