import { Fragment } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card } from "@/components/gw/primitives";
import { Button } from "@/components/ui/button";
import { fmtCents } from "@/lib/money";
import { monthRangeBrasilia } from "@/lib/utils";
import { MonthYearQuerySchema } from "@/lib/schemas";
import { computeDre, fmtPct, type DreInputTx, type DreReport } from "@/lib/dre";
import { Download, FileBarChart, AlertTriangle } from "lucide-react";

/**
 * DRE gerencial em cascata (empresa de serviços, Simples Nacional).
 * Regimes: COMPETÊNCIA (padrão) usa a data do fato gerador (`date`); CAIXA usa o pagamento
 * (`paidAt`, só `isPaid`). A classificação contábil vem de FinancialCategory.dreGroup.
 */
type SP = { month?: string; year?: string; regime?: string };

export default async function DrePage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== "ADMIN") redirect("/login");

  const now = new Date();
  const sp = await searchParams;
  const q = MonthYearQuerySchema.safeParse({ month: sp?.month, year: sp?.year });
  const month = (q.success ? q.data.month : undefined) ?? now.getMonth() + 1;
  const year = (q.success ? q.data.year : undefined) ?? now.getFullYear();
  const regime: "COMPETENCIA" | "CAIXA" = sp?.regime === "CAIXA" ? "CAIXA" : "COMPETENCIA";

  const monthRange = monthRangeBrasilia(year, month);
  const yearRange = { gte: monthRangeBrasilia(year, 1).gte, lte: monthRangeBrasilia(year, 12).lte };

  // Regime define a COLUNA de data e o filtro de pago.
  const whereFor = (range: { gte: Date; lte: Date }) =>
    regime === "CAIXA"
      ? { isPaid: true, paidAt: { gte: range.gte, lte: range.lte } }
      : { date: { gte: range.gte, lte: range.lte } };

  const select = { amount: true, type: true, category: { select: { name: true, dreGroup: true } } } as const;
  const [monthTx, yearTx] = await Promise.all([
    prisma.financialTransaction.findMany({ where: whereFor(monthRange), select }),
    prisma.financialTransaction.findMany({ where: whereFor(yearRange), select }),
  ]);

  const toInput = (t: {
    amount: number;
    type: "INCOME" | "EXPENSE";
    category: { name: string; dreGroup: DreInputTx["dreGroup"] } | null;
  }): DreInputTx => ({
    amount: t.amount,
    type: t.type,
    dreGroup: t.category?.dreGroup ?? null,
    categoryName: t.category?.name ?? null,
  });

  const rMonth = computeDre(monthTx.map(toInput), { taxProfile: "SIMPLES" });
  const rYear = computeDre(yearTx.map(toInput), { taxProfile: "SIMPLES" });

  const monthName = new Date(year, month - 1).toLocaleString("pt-BR", { month: "long" });
  const hasData = rYear.reconciliacao.totalGeral !== 0 || yearTx.length > 0 || monthTx.length > 0;

  // AV% relativo à Receita Líquida (base padrão). Base não-positiva → "—" (evita % de sinal invertido).
  const av = (val: number, r: DreReport) => fmtPct(r.receitaLiquida <= 0 ? null : (val / r.receitaLiquida) * 100);

  // Linhas da cascata: pick puxa o valor de um report (serve p/ coluna mês e ano).
  // "memo" = linha informativa FORA da soma da cascata (ex.: EBITDA não alimenta o LAIR).
  type Kind = "group" | "subtotal" | "result" | "memo";
  type Row = { label: string; pick: (r: DreReport) => number; kind: Kind; group?: DreInputTx["dreGroup"] };
  const rows: Row[] = [
    { label: "(=) RECEITA BRUTA DE SERVIÇOS", pick: (r) => r.receitaBruta, kind: "group", group: "RECEITA_BRUTA" },
    {
      label: "(−) Deduções (DAS, ISS retido, cancelamentos)",
      pick: (r) => -r.deducoes,
      kind: "group",
      group: "DEDUCAO",
    },
    { label: "(=) RECEITA LÍQUIDA", pick: (r) => r.receitaLiquida, kind: "subtotal" },
    {
      label: "(−) Custo dos serviços prestados (CSP)",
      pick: (r) => -r.custoServico,
      kind: "group",
      group: "CUSTO_SERVICO",
    },
    { label: "(=) LUCRO BRUTO", pick: (r) => r.lucroBruto, kind: "subtotal" },
    {
      label: "(−) Despesas administrativas",
      pick: (r) => -r.despesaAdministrativa,
      kind: "group",
      group: "DESPESA_ADMINISTRATIVA",
    },
    { label: "(−) Despesas comerciais", pick: (r) => -r.despesaComercial, kind: "group", group: "DESPESA_COMERCIAL" },
    { label: "(−) Despesas gerais", pick: (r) => -r.despesaGeral, kind: "group", group: "DESPESA_GERAL" },
    { label: "(−) Depreciação/amortização", pick: (r) => -r.depreciacao, kind: "group", group: "DEPRECIACAO" },
    { label: "(=) RESULTADO OPERACIONAL (EBIT)", pick: (r) => r.resultadoOperacional, kind: "subtotal" },
    {
      label: "↳ EBITDA (informativo — EBIT + depreciação; não entra na soma abaixo)",
      pick: (r) => r.ebitda,
      kind: "memo",
    },
    { label: "(+) Receitas financeiras", pick: (r) => r.receitaFinanceira, kind: "group", group: "RECEITA_FINANCEIRA" },
    {
      label: "(−) Despesas financeiras",
      pick: (r) => -r.despesaFinanceira,
      kind: "group",
      group: "DESPESA_FINANCEIRA",
    },
    { label: "(=) RESULTADO ANTES DO IR/CSLL (LAIR)", pick: (r) => r.lair, kind: "subtotal" },
    { label: "(−) IR/CSLL (0 no Simples — já no DAS)", pick: (r) => -r.irCsll, kind: "group", group: "IMPOSTO_RENDA" },
    { label: "(=) RESULTADO LÍQUIDO DO EXERCÍCIO", pick: (r) => r.resultadoLiquido, kind: "result" },
  ];

  // Se há lançamentos sem classificação, o "Resultado Líquido" da cascata NÃO reflete o caixa real.
  // Mostra o total geral (cascata + não classificado) para nada ficar escondido.
  if (rMonth.reconciliacao.naoClassificadoLiquido !== 0 || rYear.reconciliacao.naoClassificadoLiquido !== 0) {
    rows.push({
      label: "(=) RESULTADO DO PERÍODO (com não classificado)",
      pick: (r) => r.reconciliacao.totalGeral,
      kind: "result",
    });
  }

  // Maior valor absoluto da cascata (mês) — base para a largura das barras horizontais.
  const dreMaxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.pick(rMonth))));

  const leafRows = (group: DreInputTx["dreGroup"]) => {
    if (!group) return [];
    const byName = new Map<string, { name: string; m: number; y: number }>();
    for (const l of rYear.groups[group].leaves) byName.set(l.name, { name: l.name, m: 0, y: l.amount });
    for (const l of rMonth.groups[group].leaves) {
      const e = byName.get(l.name) ?? { name: l.name, m: 0, y: 0 };
      e.m = l.amount;
      byName.set(l.name, e);
    }
    return [...byName.values()].sort((a, b) => b.y - a.y);
  };

  const warnings = [...new Set([...rMonth.warnings, ...rYear.warnings])];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}
      >
        <p style={{ fontSize: 13.5, color: "var(--muted)", textTransform: "capitalize" }}>
          {monthName} de {year} ·{" "}
          {regime === "CAIXA" ? "regime de caixa (recebido/pago)" : "regime de competência (fato gerador)"} · Simples
          Nacional
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={`/api/financial/export?month=${month}&year=${year}`}>
            <Button variant="outline" size="sm">
              <Download size={15} /> CSV do mês
            </Button>
          </a>
          <a href={`/api/financial/export?year=${year}`}>
            <Button variant="outline" size="sm">
              <Download size={15} /> CSV do ano
            </Button>
          </a>
        </div>
      </div>

      {/* Seletor de regime */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Regime:</span>
        {(["COMPETENCIA", "CAIXA"] as const).map((rg) => (
          <Link
            key={rg}
            href={`/admin/dre?month=${month}&year=${year}&regime=${rg}`}
            style={{
              padding: "5px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              border: `1px solid ${regime === rg ? "var(--brand)" : "var(--line)"}`,
              background: regime === rg ? "var(--brand)" : "var(--card)",
              color: regime === rg ? "#fff" : "var(--ink-2)",
            }}
          >
            {rg === "COMPETENCIA" ? "Competência" : "Caixa"}
          </Link>
        ))}
      </div>

      {/* Navegação de mês */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {Array.from({ length: 12 }, (_, i) => {
          const m = i + 1;
          const label = new Date(year, i).toLocaleString("pt-BR", { month: "short" }).replace(".", "");
          const active = m === month;
          return (
            <Link
              key={m}
              href={`/admin/dre?month=${m}&year=${year}&regime=${regime}`}
              style={{
                padding: "5px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                textTransform: "capitalize",
                textDecoration: "none",
                border: `1px solid ${active ? "var(--brand)" : "var(--line)"}`,
                background: active ? "var(--brand)" : "var(--card)",
                color: active ? "#fff" : "var(--ink-2)",
              }}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {warnings.length > 0 && (
        <Card style={{ borderColor: "var(--warning, #f59e0b)", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertTriangle size={18} color="var(--warning, #f59e0b)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
            {warnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
          </div>
        </Card>
      )}

      {!hasData ? (
        <Card style={{ textAlign: "center", padding: 48 }}>
          <FileBarChart size={36} color="var(--muted)" style={{ margin: "0 auto 12px" }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Sem lançamentos em {monthName}</p>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
            Registre receitas/despesas (ou mude o regime) para popular o demonstrativo.
          </p>
        </Card>
      ) : (
        <>
          <Card pad={false}>
            <table className="gw-table">
              <thead>
                <tr>
                  <th>Demonstrativo de Resultado (DRE)</th>
                  <th style={{ textAlign: "right", textTransform: "capitalize" }}>{monthName}</th>
                  <th style={{ textAlign: "right" }}>AV%</th>
                  <th style={{ textAlign: "right" }}>Acum. {year}</th>
                  <th style={{ textAlign: "right" }}>AV%</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const vm = row.pick(rMonth);
                  const vy = row.pick(rYear);
                  const isResult = row.kind === "result";
                  const isMemo = row.kind === "memo";
                  const strong = row.kind === "subtotal" || isResult;
                  // Resultado: cor por SINAL de CADA coluna (mês pelo mês, ano pelo ano).
                  const sign = (v: number) => (v >= 0 ? "var(--success)" : "var(--danger)");
                  const labelColor = isMemo ? "var(--muted)" : "var(--ink)";
                  const mColor = isResult ? sign(vm) : isMemo ? "var(--muted)" : "var(--ink)";
                  const yColor = isResult ? sign(vy) : isMemo ? "var(--muted)" : "var(--ink)";
                  return (
                    <Fragment key={row.label}>
                      <tr
                        style={
                          isResult
                            ? { borderTop: "2px solid var(--line)" }
                            : row.kind === "subtotal"
                              ? { background: "var(--bg-2, rgba(0,0,0,0.02))" }
                              : undefined
                        }
                      >
                        <td
                          style={{
                            fontWeight: strong ? 800 : isMemo ? 500 : 600,
                            fontSize: strong ? 14 : 13,
                            color: labelColor,
                            fontStyle: isMemo ? "italic" : undefined,
                          }}
                        >
                          <div>{row.label}</div>
                          {!isMemo && (
                            <div
                              style={{
                                height: 4,
                                marginTop: 5,
                                borderRadius: 99,
                                background: "var(--line)",
                                overflow: "hidden",
                                maxWidth: 280,
                              }}
                            >
                              <div
                                style={{
                                  height: "100%",
                                  borderRadius: 99,
                                  width: `${Math.min(100, (Math.abs(vm) / dreMaxAbs) * 100)}%`,
                                  background: isResult ? "var(--brand)" : vm < 0 ? "var(--danger)" : "var(--accent)",
                                }}
                              />
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: strong ? 800 : 500, fontSize: 13, color: mColor }}>
                          {fmtCents(vm)}
                        </td>
                        <td style={{ textAlign: "right", fontSize: 12, color: "var(--muted)" }}>{av(vm, rMonth)}</td>
                        <td style={{ textAlign: "right", fontWeight: strong ? 800 : 500, fontSize: 13, color: yColor }}>
                          {fmtCents(vy)}
                        </td>
                        <td style={{ textAlign: "right", fontSize: 12, color: "var(--muted)" }}>{av(vy, rYear)}</td>
                      </tr>
                      {row.kind === "group" &&
                        leafRows(row.group ?? null).map((lf) => (
                          <tr key={row.label + lf.name}>
                            <td style={{ paddingLeft: 28, color: "var(--ink-2)", fontSize: 12.5 }}>{lf.name}</td>
                            <td style={{ textAlign: "right", fontSize: 12.5, color: "var(--ink-2)" }}>
                              {fmtCents(lf.m)}
                            </td>
                            <td></td>
                            <td style={{ textAlign: "right", fontSize: 12.5, color: "var(--ink-2)" }}>
                              {fmtCents(lf.y)}
                            </td>
                            <td></td>
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
                {(rYear.naoClassificado.receitas.length > 0 || rYear.naoClassificado.despesas.length > 0) && (
                  <tr style={{ background: "var(--warning-bg, rgba(245,158,11,0.08))" }}>
                    <td style={{ fontSize: 12.5, color: "var(--ink-2)" }} colSpan={5}>
                      ⚠ (não classificado) no ano: receitas {fmtCents(rYear.naoClassificado.receitaTotal)} · despesas{" "}
                      {fmtCents(rYear.naoClassificado.despesaTotal)} — classifique as categorias para entrarem na
                      cascata.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>

          {/* Indicadores */}
          <Card>
            <p style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 10 }}>
              Margens (sobre a receita líquida) — {monthName}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
              {(
                [
                  ["Margem bruta", rMonth.margens.bruta],
                  ["Margem operacional", rMonth.margens.operacional],
                  ["Margem EBITDA", rMonth.margens.ebitda],
                  ["Margem líquida", rMonth.margens.liquida],
                ] as const
              ).map(([label, val]) => (
                <div key={label} style={{ padding: 12, border: "1px solid var(--line)", borderRadius: 10 }}>
                  <p style={{ fontSize: 12, color: "var(--muted)" }}>{label}</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>{fmtPct(val)}</p>
                </div>
              ))}
            </div>
          </Card>

          <p style={{ fontSize: 12, color: "var(--muted)" }}>
            Classificação contábil das categorias é um <b>padrão sugerido</b> — validar com o contador (custo vs
            despesa, fixo vs variável, perfil tributário).
          </p>
        </>
      )}
    </div>
  );
}
