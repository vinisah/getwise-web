/**
 * Tabelas oficiais de folha de pagamento — valores em CENTAVOS.
 *
 * ⚠️ TABELAS VIGENTES 2025 — conferir/atualizar com o contador quando o governo
 * publicar as tabelas novas (mudam todo ano, normalmente em janeiro/maio).
 * Fontes: INSS (Portaria Interministerial), IRRF (RFB).
 *
 * Este módulo é a ÚNICA fonte desses números no sistema — atualizar aqui
 * propaga para todos os cálculos.
 */

/** Faixas progressivas do INSS do empregado (teto na última faixa). */
export const INSS_BRACKETS: { upTo: number; rate: number }[] = [
  { upTo: 151_800, rate: 0.075 }, // até R$ 1.518,00 → 7,5%
  { upTo: 279_388, rate: 0.09 },  // até R$ 2.793,88 → 9%
  { upTo: 419_083, rate: 0.12 },  // até R$ 4.190,83 → 12%
  { upTo: 815_741, rate: 0.14 },  // até R$ 8.157,41 → 14% (teto de contribuição)
];

/** Faixas mensais do IRRF: alíquota + parcela a deduzir. */
export const IRRF_BRACKETS: { upTo: number; rate: number; deduction: number }[] = [
  { upTo: 242_880, rate: 0, deduction: 0 },          // isento
  { upTo: 282_665, rate: 0.075, deduction: 18_216 }, // 7,5%
  { upTo: 375_105, rate: 0.15, deduction: 39_416 },  // 15%
  { upTo: 466_468, rate: 0.225, deduction: 67_549 }, // 22,5%
  { upTo: Infinity, rate: 0.275, deduction: 90_873 },// 27,5%
];

/** Dedução mensal por dependente (IRRF). */
export const IRRF_DEPENDENT_DEDUCTION = 18_959; // R$ 189,59

/** Desconto simplificado mensal (alternativa às deduções legais). */
export const IRRF_SIMPLIFIED_DEDUCTION = 60_720; // R$ 607,20

/** FGTS — depósito patronal sobre a remuneração. */
export const FGTS_RATE = 0.08;

/**
 * Regime tributário: Simples Nacional → SEM INSS patronal de 20%
 * (a contribuição previdenciária patronal está embutida na guia DAS,
 * exceto Anexo IV). Se a escola migrar para Lucro Presumido/Real,
 * mudar para false e o custo patronal passa a incluir ~20% + RAT.
 */
export const SIMPLES_NACIONAL = true;

/** INSS patronal usado apenas quando SIMPLES_NACIONAL = false. */
export const EMPLOYER_INSS_RATE = 0.2;
