import {
  INSS_BRACKETS,
  IRRF_BRACKETS,
  IRRF_DEPENDENT_DEDUCTION,
  IRRF_SIMPLIFIED_DEDUCTION,
  FGTS_RATE,
  SIMPLES_NACIONAL,
  EMPLOYER_INSS_RATE,
} from "./payroll-tables";

/**
 * Motor de folha de pagamento (CLT brasileira) — tudo em CENTAVOS (Int).
 *
 * ⚠️ Estimativa GERENCIAL: ajuda o dono a enxergar custo real e provisões,
 * mas NÃO substitui contador/eSocial para fins legais.
 */

export type ContractType = "CLT" | "PJ" | "HOURLY";
export type SalaryPaymentType = "SALARY" | "THIRTEENTH_1" | "THIRTEENTH_2" | "VACATION" | "OTHER";

export interface PayrollResult {
  /** Salário bruto mensal (centavos). */
  gross: number;
  /** INSS retido do empregado. */
  inss: number;
  /** IRRF retido do empregado. */
  irrf: number;
  /** Depósito FGTS (custo patronal, não desconta do empregado). */
  fgts: number;
  /** Líquido a pagar ao empregado. */
  net: number;
  /** Provisão mensal de 13º (1/12 do bruto). */
  provision13: number;
  /** Provisão mensal de férias + 1/3 (1/12 + 1/36 do bruto). */
  provisionVacation: number;
  /** INSS patronal (0 no Simples Nacional). */
  employerInss: number;
  /** Custo real mensal p/ empresa: bruto + FGTS + provisões (+ patronal). */
  employerCost: number;
}

export interface PaymentBreakdown {
  /** Valor bruto desta parcela específica (ex: metade do salário no 13º). */
  grossPaid: number;
  inss: number;
  irrf: number;
  fgts: number;
  /** Líquido a pagar nesta parcela. */
  net: number;
}

/** INSS do empregado — progressivo por faixa, com teto. */
export function calcINSSEmployee(grossCents: number): number {
  const base = Math.min(grossCents, INSS_BRACKETS[INSS_BRACKETS.length - 1].upTo);
  let total = 0;
  let prev = 0;
  for (const bracket of INSS_BRACKETS) {
    if (base <= prev) break;
    const slice = Math.min(base, bracket.upTo) - prev;
    total += slice * bracket.rate;
    prev = bracket.upTo;
  }
  return Math.round(total);
}

/**
 * IRRF mensal. Base = bruto − maior entre:
 *  (a) deduções legais (INSS + dependentes) e (b) desconto simplificado.
 */
export function calcIRRF(grossCents: number, inssCents: number, dependents: number): number {
  const legalDeductions = inssCents + dependents * IRRF_DEPENDENT_DEDUCTION;
  const deduction = Math.max(legalDeductions, IRRF_SIMPLIFIED_DEDUCTION);
  const base = Math.max(0, grossCents - deduction);

  for (const bracket of IRRF_BRACKETS) {
    if (base <= bracket.upTo) {
      return Math.max(0, Math.round(base * bracket.rate - bracket.deduction));
    }
  }
  return 0; // inalcançável (última faixa é Infinity)
}

/** FGTS — 8% sobre a remuneração (não desconta do empregado). */
export function calcFGTS(grossCents: number): number {
  return Math.round(grossCents * FGTS_RATE);
}

/**
 * Cálculo mensal completo de um funcionário.
 * PJ/HOURLY: sem retenções nem encargos — custo = bruto (nota fiscal/RPA).
 */
export function calcPayroll(
  grossCents: number,
  dependents: number,
  contractType: ContractType
): PayrollResult {
  if (contractType !== "CLT") {
    return {
      gross: grossCents,
      inss: 0,
      irrf: 0,
      fgts: 0,
      net: grossCents,
      provision13: 0,
      provisionVacation: 0,
      employerInss: 0,
      employerCost: grossCents,
    };
  }

  const inss = calcINSSEmployee(grossCents);
  const irrf = calcIRRF(grossCents, inss, dependents);
  const fgts = calcFGTS(grossCents);
  const provision13 = Math.round(grossCents / 12);
  // férias: 1/12 do bruto + 1/3 constitucional sobre essa fração (= 1/36)
  const provisionVacation = Math.round(grossCents / 12 + grossCents / 36);
  const employerInss = SIMPLES_NACIONAL ? 0 : Math.round(grossCents * EMPLOYER_INSS_RATE);
  const employerCost = grossCents + fgts + provision13 + provisionVacation + employerInss;

  return {
    gross: grossCents,
    inss,
    irrf,
    fgts,
    net: grossCents - inss - irrf,
    provision13,
    provisionVacation,
    employerInss,
    employerCost,
  };
}

/**
 * Breakdown de uma PARCELA de pagamento conforme o tipo.
 * `baseSalaryCents` = salário mensal bruto cadastrado do funcionário.
 *
 * Regras (CLT):
 * - SALARY:       bruto integral, INSS+IRRF normais.
 * - THIRTEENTH_1: metade do salário, SEM descontos (1ª parcela, até 30/11).
 * - THIRTEENTH_2: metade do salário, mas INSS+IRRF calculados sobre o 13º
 *                 INTEGRAL (tributação exclusiva) e descontados nesta parcela.
 * - VACATION:     salário + 1/3 constitucional, INSS+IRRF sobre o total.
 * - OTHER:        valor livre, sem descontos (bônus/ajuste).
 * FGTS incide sobre o bruto de cada parcela (exceto OTHER e não-CLT).
 */
export function calcPaymentBreakdown(
  type: SalaryPaymentType,
  baseSalaryCents: number,
  dependents: number,
  contractType: ContractType
): PaymentBreakdown {
  if (contractType !== "CLT") {
    const grossPaid =
      type === "THIRTEENTH_1" || type === "THIRTEENTH_2"
        ? Math.round(baseSalaryCents / 2)
        : type === "VACATION"
          ? Math.round(baseSalaryCents * (4 / 3))
          : baseSalaryCents;
    return { grossPaid, inss: 0, irrf: 0, fgts: 0, net: grossPaid };
  }

  switch (type) {
    case "SALARY": {
      const r = calcPayroll(baseSalaryCents, dependents, "CLT");
      return { grossPaid: r.gross, inss: r.inss, irrf: r.irrf, fgts: r.fgts, net: r.net };
    }
    case "THIRTEENTH_1": {
      const grossPaid = Math.round(baseSalaryCents / 2);
      return { grossPaid, inss: 0, irrf: 0, fgts: calcFGTS(grossPaid), net: grossPaid };
    }
    case "THIRTEENTH_2": {
      const grossPaid = Math.round(baseSalaryCents / 2);
      const inss = calcINSSEmployee(baseSalaryCents);
      const irrf = calcIRRF(baseSalaryCents, inss, dependents);
      return { grossPaid, inss, irrf, fgts: calcFGTS(grossPaid), net: grossPaid - inss - irrf };
    }
    case "VACATION": {
      const grossPaid = Math.round(baseSalaryCents * (4 / 3));
      const inss = calcINSSEmployee(grossPaid);
      const irrf = calcIRRF(grossPaid, inss, dependents);
      return { grossPaid, inss, irrf, fgts: calcFGTS(grossPaid), net: grossPaid - inss - irrf };
    }
    case "OTHER":
      return { grossPaid: baseSalaryCents, inss: 0, irrf: 0, fgts: 0, net: baseSalaryCents };
  }
}

/** Rótulos pt-BR para tipos de pagamento (UI + descrição de transação). */
export const PAYMENT_TYPE_LABEL: Record<SalaryPaymentType, string> = {
  SALARY: "Salário",
  THIRTEENTH_1: "13º — 1ª parcela",
  THIRTEENTH_2: "13º — 2ª parcela",
  VACATION: "Férias",
  OTHER: "Outro",
};
