/**
 * Multa e juros de mensalidade em atraso — tudo em CENTAVOS (Int).
 *
 * Tetos legais para relação de consumo no Brasil (CDC):
 *   multa máx. 2% (única) + juros de mora máx. 1% a.m. (pro-rata por dia).
 * Alterar aqui se o contrato da escola previr valores menores.
 */

export const LATE_FEE_RATE = 0.02; // multa única de 2%
export const MONTHLY_INTEREST_RATE = 0.01; // juros 1% ao mês, pro-rata dia

export interface LateCharges {
  /** Multa única (2% do valor original). */
  lateFee: number;
  /** Juros acumulados (1% a.m. ÷ 30 × dias). */
  interest: number;
  /** Valor original + multa + juros. */
  total: number;
}

/** Calcula multa + juros de um valor vencido há `daysOverdue` dias. */
export function calcLateCharges(amountCents: number, daysOverdue: number): LateCharges {
  if (daysOverdue <= 0) {
    return { lateFee: 0, interest: 0, total: amountCents };
  }
  const lateFee = Math.round(amountCents * LATE_FEE_RATE);
  const interest = Math.round((amountCents * MONTHLY_INTEREST_RATE * daysOverdue) / 30);
  return { lateFee, interest, total: amountCents + lateFee + interest };
}
