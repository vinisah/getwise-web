import { fmtBRL } from "./utils";

/**
 * Dinheiro é armazenado no banco como Int (centavos) para eliminar erro de
 * ponto flutuante. A fronteira da API trabalha em reais (unidade humana); a
 * conversão acontece aqui.
 *
 *   R$ 19,99  ⇄  1999 centavos
 */

/** Reais (float) → centavos (Int). Arredonda para o centavo mais próximo. */
export const reaisToCents = (reais: number): number => Math.round(reais * 100);

/** Centavos (Int) → reais (float). Use apenas para exibição/formatação. */
export const centsToReais = (cents: number): number => cents / 100;

/** Centavos (Int) → string "R$ 19,99". */
export const fmtCents = (cents: number): string => fmtBRL(cents / 100);
