import { describe, it, expect } from "vitest";
import {
  calcINSSEmployee,
  calcIRRF,
  calcFGTS,
  calcPayroll,
  calcPaymentBreakdown,
} from "@/lib/payroll";

// Valores esperados calculados manualmente com as tabelas 2025 (centavos).

describe("calcINSSEmployee (progressivo)", () => {
  it("salário mínimo R$ 1.518 → 7,5% = R$ 113,85", () => {
    expect(calcINSSEmployee(151_800)).toBe(11_385);
  });

  it("R$ 3.000 → faixas somadas = R$ 253,41", () => {
    // 1518×7,5% + 1275,88×9% + 206,12×12% = 113,85 + 114,83 + 24,73
    expect(calcINSSEmployee(300_000)).toBe(25_341);
  });

  it("acima do teto (R$ 10.000) → mesma contribuição do teto", () => {
    expect(calcINSSEmployee(1_000_000)).toBe(calcINSSEmployee(815_741));
  });

  it("teto → R$ 951,63", () => {
    expect(calcINSSEmployee(815_741)).toBe(95_163);
  });
});

describe("calcIRRF", () => {
  it("R$ 3.000 → isento (desconto simplificado leva base p/ 2.392,80)", () => {
    const inss = calcINSSEmployee(300_000);
    expect(calcIRRF(300_000, inss, 0)).toBe(0);
  });

  it("R$ 5.000 → faixa 22,5% = R$ 312,89", () => {
    const inss = calcINSSEmployee(500_000); // 50.960
    // ded = max(509,60; 607,20) = 607,20 → base 4.392,80 → ×22,5% − 675,49
    expect(calcIRRF(500_000, inss, 0)).toBe(31_289);
  });

  it("dependentes aumentam dedução quando legais > simplificado", () => {
    const inss = calcINSSEmployee(800_000);
    const semDep = calcIRRF(800_000, inss, 0);
    const comDep = calcIRRF(800_000, inss, 3);
    expect(comDep).toBeLessThan(semDep);
  });

  it("nunca negativo", () => {
    expect(calcIRRF(100_000, calcINSSEmployee(100_000), 5)).toBe(0);
  });
});

describe("calcPayroll", () => {
  it("CLT R$ 3.000, 0 dep — breakdown completo", () => {
    const r = calcPayroll(300_000, 0, "CLT");
    expect(r.inss).toBe(25_341);
    expect(r.irrf).toBe(0);
    expect(r.fgts).toBe(24_000); // 8%
    expect(r.net).toBe(274_659); // 3.000 − 253,41
    expect(r.provision13).toBe(25_000); // 1/12
    expect(r.provisionVacation).toBe(33_333); // 1/12 + 1/36
    expect(r.employerInss).toBe(0); // Simples Nacional
    expect(r.employerCost).toBe(382_333); // 300000+24000+25000+33333
  });

  it("PJ → sem descontos nem encargos, custo = bruto", () => {
    const r = calcPayroll(300_000, 0, "PJ");
    expect(r.inss).toBe(0);
    expect(r.fgts).toBe(0);
    expect(r.net).toBe(300_000);
    expect(r.employerCost).toBe(300_000);
  });
});

describe("calcPaymentBreakdown", () => {
  it("SALARY = mesmo resultado do cálculo mensal", () => {
    const b = calcPaymentBreakdown("SALARY", 300_000, 0, "CLT");
    expect(b.net).toBe(274_659);
    expect(b.grossPaid).toBe(300_000);
  });

  it("13º 1ª parcela: metade SEM descontos, FGTS sobre a metade", () => {
    const b = calcPaymentBreakdown("THIRTEENTH_1", 300_000, 0, "CLT");
    expect(b.grossPaid).toBe(150_000);
    expect(b.inss).toBe(0);
    expect(b.net).toBe(150_000);
    expect(b.fgts).toBe(12_000);
  });

  it("13º 2ª parcela: INSS/IRRF sobre o 13º INTEGRAL descontados da metade", () => {
    const b = calcPaymentBreakdown("THIRTEENTH_2", 300_000, 0, "CLT");
    expect(b.grossPaid).toBe(150_000);
    expect(b.inss).toBe(25_341); // sobre 3.000 integral
    expect(b.irrf).toBe(0);
    expect(b.net).toBe(124_659); // 1.500 − 253,41
  });

  it("férias: salário + 1/3, descontos sobre o total", () => {
    const b = calcPaymentBreakdown("VACATION", 300_000, 0, "CLT");
    expect(b.grossPaid).toBe(400_000); // 3.000 × 4/3
    expect(b.inss).toBe(37_341);
    expect(b.irrf).toBe(11_476); // base 3.392,80 → 15% − 394,16
    expect(b.net).toBe(351_183);
  });

  it("PJ: qualquer tipo sem descontos", () => {
    const b = calcPaymentBreakdown("THIRTEENTH_2", 300_000, 0, "PJ");
    expect(b.inss).toBe(0);
    expect(b.net).toBe(b.grossPaid);
  });
});

describe("calcFGTS", () => {
  it("8% do bruto", () => {
    expect(calcFGTS(300_000)).toBe(24_000);
  });
});
