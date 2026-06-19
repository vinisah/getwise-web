/**
 * Motor do DRE (Demonstração do Resultado do Exercício) — gerencial, empresa de SERVIÇOS.
 *
 * Tudo em CENTAVOS (Int). Soma sempre em centavos; arredondamento só na exibição.
 * Reconciliação é INVARIANTE (não enfeite): a soma dos lançamentos classificados (com o sinal
 * contábil do grupo) = Resultado Líquido da cascata; e o total geral = Resultado Líquido + não
 * classificado. Garantida por construção e travada nos testes.
 *
 * Simples Nacional: o DAS (grupo DEDUCAO, isDas) já inclui ISS/PIS/COFINS/IRPJ/CSLL. NÃO existe
 * linha de IR/CSLL separada — em perfil Simples ela fica 0/oculta. Lançar tributo à parte = dupla
 * contagem (o motor sinaliza em `warnings` se achar IMPOSTO_RENDA no Simples).
 *
 * O motor é puro: recebe lançamentos JÁ filtrados pelo regime (competência → data do fato gerador;
 * caixa → data de pagamento). Quem filtra é a página.
 */
import type { DreGroup } from "@prisma/client";

export type TaxProfile = "SIMPLES" | "OUTRO";
export type AvBase = "LIQUIDA" | "BRUTA";

export interface DreInputTx {
  amount: number; // centavos, sempre positivo (o sinal vem do grupo/tipo)
  type: "INCOME" | "EXPENSE";
  dreGroup: DreGroup | null;
  categoryName: string | null;
}

export interface DreLeaf {
  name: string;
  amount: number; // centavos
}
export interface DreGroupResult {
  group: DreGroup;
  total: number; // centavos
  leaves: DreLeaf[]; // contas-folha que somam exatamente `total`
}

export interface DreReport {
  receitaBruta: number;
  deducoes: number;
  receitaLiquida: number;
  custoServico: number;
  lucroBruto: number;
  despesaAdministrativa: number;
  despesaComercial: number;
  despesaGeral: number;
  depreciacao: number;
  despesasOperacionais: number; // admin + comercial + geral + depreciação
  resultadoOperacional: number; // EBIT
  ebitda: number; // EBIT + depreciação
  receitaFinanceira: number;
  despesaFinanceira: number;
  resultadoFinanceiro: number;
  lair: number; // resultado antes do IR/CSLL
  irCsll: number; // 0 no Simples
  resultadoLiquido: number;

  groups: Record<DreGroup, DreGroupResult>;

  naoClassificado: { receitas: DreLeaf[]; despesas: DreLeaf[]; receitaTotal: number; despesaTotal: number };

  margens: { bruta: number | null; operacional: number | null; ebitda: number | null; liquida: number | null };

  reconciliacao: {
    totalGeral: number; // receitas − despesas de TUDO (= resultadoLiquido + naoClassificadoLiquido)
    resultadoLiquido: number;
    naoClassificadoLiquido: number;
    ok: boolean; // soma dos classificados (com sinal do grupo) == resultadoLiquido
  };

  warnings: string[];
}

const ALL_GROUPS: DreGroup[] = [
  "RECEITA_BRUTA",
  "DEDUCAO",
  "CUSTO_SERVICO",
  "DESPESA_ADMINISTRATIVA",
  "DESPESA_COMERCIAL",
  "DESPESA_GERAL",
  "RECEITA_FINANCEIRA",
  "DESPESA_FINANCEIRA",
  "DEPRECIACAO",
  "IMPOSTO_RENDA",
];
const REVENUE_GROUPS = new Set<DreGroup>(["RECEITA_BRUTA", "RECEITA_FINANCEIRA"]);

function pct(part: number, base: number): number | null {
  // Base não-positiva (receita líquida 0 ou negativa quando deduções > receita) não dá %
  // com sentido econômico — e dividir por base negativa INVERTERIA o sinal. Retorna null → "—".
  return base <= 0 ? null : (part / base) * 100;
}
function addLeaf(map: Map<string, DreLeaf>, list: DreLeaf[], name: string, amount: number) {
  const leaf = map.get(name);
  if (leaf) leaf.amount += amount;
  else {
    const l = { name, amount };
    map.set(name, l);
    list.push(l);
  }
}

export function computeDre(txns: DreInputTx[], opts: { taxProfile?: TaxProfile; avBase?: AvBase } = {}): DreReport {
  const taxProfile = opts.taxProfile ?? "SIMPLES";

  const groups = {} as Record<DreGroup, DreGroupResult>;
  const leafMaps = {} as Record<DreGroup, Map<string, DreLeaf>>;
  for (const g of ALL_GROUPS) {
    groups[g] = { group: g, total: 0, leaves: [] };
    leafMaps[g] = new Map();
  }

  const nc = { receitas: [] as DreLeaf[], despesas: [] as DreLeaf[], receitaTotal: 0, despesaTotal: 0 };
  const ncIncomeMap = new Map<string, DreLeaf>();
  const ncExpenseMap = new Map<string, DreLeaf>();
  let classifiedNet = 0; // Σ classificados com sinal do grupo (receita +, resto −)

  for (const t of txns) {
    if (!Number.isFinite(t.amount)) continue; // rejeita não-finitos
    const name = t.categoryName ?? "(sem categoria)";

    if (t.dreGroup) {
      groups[t.dreGroup].total += t.amount;
      addLeaf(leafMaps[t.dreGroup], groups[t.dreGroup].leaves, name, t.amount);
      classifiedNet += REVENUE_GROUPS.has(t.dreGroup) ? t.amount : -t.amount;
    } else if (t.type === "INCOME") {
      addLeaf(ncIncomeMap, nc.receitas, name, t.amount);
      nc.receitaTotal += t.amount;
    } else {
      addLeaf(ncExpenseMap, nc.despesas, name, t.amount);
      nc.despesaTotal += t.amount;
    }
  }

  const G = (g: DreGroup) => groups[g].total;
  const receitaBruta = G("RECEITA_BRUTA");
  const deducoes = G("DEDUCAO");
  const receitaLiquida = receitaBruta - deducoes;
  const custoServico = G("CUSTO_SERVICO");
  const lucroBruto = receitaLiquida - custoServico;
  const despesaAdministrativa = G("DESPESA_ADMINISTRATIVA");
  const despesaComercial = G("DESPESA_COMERCIAL");
  const despesaGeral = G("DESPESA_GERAL");
  const depreciacao = G("DEPRECIACAO");
  const despesasOperacionais = despesaAdministrativa + despesaComercial + despesaGeral + depreciacao;
  const resultadoOperacional = lucroBruto - despesasOperacionais;
  const ebitda = resultadoOperacional + depreciacao;
  const receitaFinanceira = G("RECEITA_FINANCEIRA");
  const despesaFinanceira = G("DESPESA_FINANCEIRA");
  const resultadoFinanceiro = receitaFinanceira - despesaFinanceira;
  const lair = resultadoOperacional + resultadoFinanceiro;
  const irCsll = G("IMPOSTO_RENDA");
  const resultadoLiquido = lair - irCsll;

  const warnings: string[] = [];
  if (taxProfile === "SIMPLES" && irCsll !== 0) {
    warnings.push(
      "Há lançamentos em IR/CSLL separado, mas o perfil é Simples Nacional (esses tributos já estão no DAS). Possível dupla contagem — reclassifique."
    );
  }

  const base = (opts.avBase ?? "LIQUIDA") === "BRUTA" ? receitaBruta : receitaLiquida;
  const naoClassificadoLiquido = nc.receitaTotal - nc.despesaTotal;

  return {
    receitaBruta,
    deducoes,
    receitaLiquida,
    custoServico,
    lucroBruto,
    despesaAdministrativa,
    despesaComercial,
    despesaGeral,
    depreciacao,
    despesasOperacionais,
    resultadoOperacional,
    ebitda,
    receitaFinanceira,
    despesaFinanceira,
    resultadoFinanceiro,
    lair,
    irCsll,
    resultadoLiquido,
    groups,
    naoClassificado: nc,
    margens: {
      bruta: pct(lucroBruto, base),
      operacional: pct(resultadoOperacional, base),
      ebitda: pct(ebitda, base),
      liquida: pct(resultadoLiquido, base),
    },
    reconciliacao: {
      totalGeral: classifiedNet + naoClassificadoLiquido,
      resultadoLiquido,
      naoClassificadoLiquido,
      ok: classifiedNet === resultadoLiquido,
    },
    warnings,
  };
}

/** % para exibição (1 casa). "—" quando null (base zero). */
export function fmtPct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return `${(Math.round(v * 10) / 10).toFixed(1)}%`;
}
