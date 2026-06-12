import { describe, it, expect } from "vitest";
import { reaisToCents, centsToReais, fmtCents } from "@/lib/money";

describe("money", () => {
  it("reaisToCents arredonda para o centavo (19.99 → 1999)", () => {
    expect(reaisToCents(19.99)).toBe(1999);
    expect(reaisToCents(0.1)).toBe(10);
    expect(reaisToCents(0.01)).toBe(1);
    expect(reaisToCents(397)).toBe(39700);
  });

  it("centsToReais inverte (1999 → 19.99)", () => {
    expect(centsToReais(1999)).toBe(19.99);
    expect(centsToReais(0)).toBe(0);
  });

  it("soma de centavos é exata (sem erro de float)", () => {
    // 0,01 + 0,01 + 0,01 = 0,03 — em float daria 0.030000000000000002
    const total = reaisToCents(0.01) * 3;
    expect(total).toBe(3);
    expect(centsToReais(total)).toBe(0.03);
  });

  it("fmtCents formata em BRL", () => {
    expect(fmtCents(1999)).toContain("19,99");
    expect(fmtCents(39700)).toContain("397,00");
  });
});
