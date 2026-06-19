import { describe, it, expect } from "vitest";
import { computeDre, fmtPct, type DreInputTx } from "@/lib/dre";

// Cenário-base (centavos): escola, Simples Nacional.
const base: DreInputTx[] = [
  { amount: 100000, type: "INCOME", dreGroup: "RECEITA_BRUTA", categoryName: "Mensalidade" },
  { amount: 20000, type: "INCOME", dreGroup: "RECEITA_BRUTA", categoryName: "Matrícula" },
  { amount: 7200, type: "EXPENSE", dreGroup: "DEDUCAO", categoryName: "DAS (Simples Nacional)" },
  { amount: 40000, type: "EXPENSE", dreGroup: "CUSTO_SERVICO", categoryName: "Salários" },
  { amount: 5000, type: "EXPENSE", dreGroup: "CUSTO_SERVICO", categoryName: "Material didático (compra)" },
  { amount: 15000, type: "EXPENSE", dreGroup: "DESPESA_ADMINISTRATIVA", categoryName: "Aluguel" },
  { amount: 8000, type: "EXPENSE", dreGroup: "DESPESA_COMERCIAL", categoryName: "Marketing" },
  { amount: 1000, type: "EXPENSE", dreGroup: "DESPESA_FINANCEIRA", categoryName: "Tarifas" },
  { amount: 500, type: "INCOME", dreGroup: "RECEITA_FINANCEIRA", categoryName: "Rendimentos" },
];

describe("computeDre — cascata e sinais", () => {
  const r = computeDre(base);

  it("cascata com os sinais corretos (dedução/custo/despesa reduzem; receita soma)", () => {
    expect(r.receitaBruta).toBe(120000);
    expect(r.deducoes).toBe(7200);
    expect(r.receitaLiquida).toBe(112800); // bruta − deduções
    expect(r.custoServico).toBe(45000);
    expect(r.lucroBruto).toBe(67800); // líquida − CSP
    expect(r.despesasOperacionais).toBe(23000); // 15000 + 8000
    expect(r.resultadoOperacional).toBe(44800); // EBIT
    expect(r.resultadoFinanceiro).toBe(-500); // 500 − 1000
    expect(r.lair).toBe(44300);
    expect(r.irCsll).toBe(0); // Simples
    expect(r.resultadoLiquido).toBe(44300);
  });

  it("RECONCILIAÇÃO: soma dos classificados == resultado líquido (invariante)", () => {
    expect(r.reconciliacao.ok).toBe(true);
    expect(r.reconciliacao.resultadoLiquido).toBe(44300);
    expect(r.reconciliacao.totalGeral).toBe(44300); // sem não-classificado neste cenário
  });

  it("soma das folhas == total do grupo", () => {
    for (const g of Object.values(r.groups)) {
      expect(g.leaves.reduce((s, l) => s + l.amount, 0)).toBe(g.total);
    }
    expect(r.groups.CUSTO_SERVICO.leaves).toHaveLength(2);
  });

  it("margens em % da receita líquida", () => {
    expect(r.margens.bruta).toBeCloseTo((67800 / 112800) * 100, 4);
    expect(r.margens.liquida).toBeCloseTo((44300 / 112800) * 100, 4);
  });
});

describe("computeDre — depreciação e EBITDA", () => {
  it("depreciação reduz o EBIT e é somada de volta no EBITDA", () => {
    const r = computeDre([
      ...base,
      { amount: 5000, type: "EXPENSE", dreGroup: "DEPRECIACAO", categoryName: "Depreciação" },
    ]);
    expect(r.resultadoOperacional).toBe(44800 - 5000); // EBIT cai
    expect(r.ebitda).toBe(44800); // EBIT + depreciação = volta ao patamar pré-depreciação
    expect(r.reconciliacao.ok).toBe(true);
  });
});

describe("computeDre — Simples Nacional (anti-dupla-contagem)", () => {
  it("DAS aparece UMA vez (deduções) e IR/CSLL separado = 0, sem warning", () => {
    const r = computeDre(base, { taxProfile: "SIMPLES" });
    expect(r.deducoes).toBe(7200);
    expect(r.groups.DEDUCAO.leaves).toHaveLength(1);
    expect(r.irCsll).toBe(0);
    expect(r.warnings).toHaveLength(0);
  });

  it("IR/CSLL lançado à parte no Simples → warning de dupla contagem (mas não some)", () => {
    const r = computeDre(
      [...base, { amount: 3000, type: "EXPENSE", dreGroup: "IMPOSTO_RENDA", categoryName: "IRPJ" }],
      {
        taxProfile: "SIMPLES",
      }
    );
    expect(r.irCsll).toBe(3000);
    expect(r.resultadoLiquido).toBe(44300 - 3000);
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.reconciliacao.ok).toBe(true); // continua reconciliando
  });
});

describe("computeDre — não classificado nunca some", () => {
  it("lançamentos sem grupo entram em (não classificado) e contam no total geral", () => {
    const r = computeDre([
      ...base,
      { amount: 3000, type: "EXPENSE", dreGroup: null, categoryName: "Multa de trânsito" },
      { amount: 1000, type: "INCOME", dreGroup: null, categoryName: "Reembolso" },
    ]);
    expect(r.naoClassificado.despesaTotal).toBe(3000);
    expect(r.naoClassificado.receitaTotal).toBe(1000);
    expect(r.reconciliacao.naoClassificadoLiquido).toBe(-2000);
    // cascata não muda; total geral = líquido + não classificado
    expect(r.resultadoLiquido).toBe(44300);
    expect(r.reconciliacao.totalGeral).toBe(42300);
  });
});

describe("computeDre — bordas", () => {
  it("período vazio → zeros, sem erro, margens '—'", () => {
    const r = computeDre([]);
    expect(r.resultadoLiquido).toBe(0);
    expect(r.margens.bruta).toBeNull();
    expect(fmtPct(r.margens.bruta)).toBe("—");
    expect(r.reconciliacao.ok).toBe(true);
  });

  it("valor não-finito é rejeitado (não entra na soma)", () => {
    const r = computeDre([
      { amount: NaN, type: "INCOME", dreGroup: "RECEITA_BRUTA", categoryName: "x" },
      { amount: 10000, type: "INCOME", dreGroup: "RECEITA_BRUTA", categoryName: "Mensalidade" },
    ]);
    expect(r.receitaBruta).toBe(10000);
  });

  it("base zero nas margens → null (sem divisão por zero)", () => {
    const r = computeDre([
      { amount: 5000, type: "EXPENSE", dreGroup: "DESPESA_ADMINISTRATIVA", categoryName: "Aluguel" },
    ]);
    expect(r.receitaLiquida).toBe(0);
    expect(r.margens.operacional).toBeNull();
  });

  it("base NEGATIVA (deduções > receita) → margens null, sem inverter sinal", () => {
    // só DAS no período, sem receita → receitaLiquida < 0
    const r = computeDre([{ amount: 7200, type: "EXPENSE", dreGroup: "DEDUCAO", categoryName: "DAS" }]);
    expect(r.receitaLiquida).toBe(-7200);
    expect(r.margens.liquida).toBeNull(); // NÃO +100%
    expect(r.margens.bruta).toBeNull();
  });

  it("fmtPct: null e não-finitos → '—' (nunca 'NaN%')", () => {
    expect(fmtPct(null)).toBe("—");
    expect(fmtPct(NaN)).toBe("—");
    expect(fmtPct(Infinity)).toBe("—");
    expect(fmtPct(39.27)).toBe("39.3%");
  });
});
