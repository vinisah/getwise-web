import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, Badge } from "@/components/gw/primitives";
import { Button } from "@/components/ui/button";
import { formatDate, monthRangeBrasilia } from "@/lib/utils";
import { fmtCents } from "@/lib/money";
import { MonthYearQuerySchema } from "@/lib/schemas";
import { TransactionActions } from "./transaction-actions";
import { GenerateRecurringButton } from "./generate-recurring-button";
import { TrendingUp, TrendingDown, Wallet, Plus, RefreshCw } from "lucide-react";

const METHOD_LABEL: Record<string, string> = {
  PIX: "Pix",
  CREDIT_CARD: "Crédito",
  DEBIT_CARD: "Débito",
  BOLETO: "Boleto",
};

export default async function FinancialPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; type?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== "ADMIN") redirect("/login");

  const now = new Date();
  const sp = await searchParams;
  // Parâmetros inválidos → fallback para o mês atual (não quebra a página).
  const q = MonthYearQuerySchema.safeParse({
    month: sp?.month,
    year: sp?.year,
    type: sp?.type,
  });
  const month = (q.success ? q.data.month : undefined) ?? now.getMonth() + 1;
  const year = (q.success ? q.data.year : undefined) ?? now.getFullYear();
  const typeFilter = q.success ? q.data.type : undefined;

  const { gte, lte } = monthRangeBrasilia(year, month);

  const [transactions, incomeSum, expenseSum] = await Promise.all([
    prisma.financialTransaction.findMany({
      where: { date: { gte, lte }, ...(typeFilter ? { type: typeFilter } : {}) },
      include: { category: true },
      orderBy: { date: "desc" },
    }),
    prisma.financialTransaction.aggregate({
      where: { date: { gte, lte }, type: "INCOME", isPaid: true },
      _sum: { amount: true },
    }),
    prisma.financialTransaction.aggregate({
      where: { date: { gte, lte }, type: "EXPENSE", isPaid: true },
      _sum: { amount: true },
    }),
  ]);

  // Valores em centavos (Int) — soma exata.
  const income = incomeSum._sum.amount ?? 0;
  const expenses = expenseSum._sum.amount ?? 0;
  const balance = income - expenses;
  const monthName = new Date(year, month - 1).toLocaleString("pt-BR", { month: "long" });

  const summary = [
    { icon: TrendingUp, label: "Receitas", value: income, color: "var(--success)", border: "var(--success)" },
    { icon: TrendingDown, label: "Despesas", value: expenses, color: "var(--danger)", border: "var(--danger)" },
    {
      icon: Wallet,
      label: "Saldo",
      value: balance,
      color: balance >= 0 ? "var(--accent)" : "var(--amber)",
      border: balance >= 0 ? "var(--accent)" : "var(--amber)",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}
      >
        <p style={{ fontSize: 13.5, color: "var(--muted)", textTransform: "capitalize" }}>
          {monthName} de {year}
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <GenerateRecurringButton month={month} year={year} />
          <Link href="/admin/financial/new">
            <Button variant="accent">
              <Plus size={17} /> Nova transação
            </Button>
          </Link>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--gap)" }}>
        {summary.map((s) => (
          <Card key={s.label} style={{ borderLeft: `4px solid ${s.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <s.icon size={16} color={s.color} />
              <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, letterSpacing: "-.02em" }}>
              {fmtCents(s.value)}
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {Array.from({ length: 12 }, (_, i) => {
          const m = i + 1;
          const label = new Date(year, i).toLocaleString("pt-BR", { month: "short" }).replace(".", "");
          const active = m === month;
          return (
            <Link
              key={m}
              href={`/admin/financial?month=${m}&year=${year}${typeFilter ? `&type=${typeFilter}` : ""}`}
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

      <div style={{ display: "flex", gap: 8 }}>
        <Link href={`/admin/financial?month=${month}&year=${year}`}>
          <Button variant={!typeFilter ? "default" : "outline"} size="sm">
            Todos
          </Button>
        </Link>
        <Link href={`/admin/financial?month=${month}&year=${year}&type=INCOME`}>
          <Button variant={typeFilter === "INCOME" ? "success" : "outline"} size="sm">
            Receitas
          </Button>
        </Link>
        <Link href={`/admin/financial?month=${month}&year=${year}&type=EXPENSE`}>
          <Button variant={typeFilter === "EXPENSE" ? "destructive" : "outline"} size="sm">
            Despesas
          </Button>
        </Link>
      </div>

      <Card pad={false}>
        <table className="gw-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Tipo</th>
              <th>Método</th>
              <th style={{ textAlign: "right" }}>Valor</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
                  Nenhuma transação no período.
                </td>
              </tr>
            ) : (
              transactions.map((t) => (
                <tr key={t.id}>
                  <td>
                    <span style={{ fontSize: 13, color: "var(--ink-2)" }}>{formatDate(t.date)}</span>
                  </td>
                  <td>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: "var(--ink)",
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                      }}
                    >
                      {t.description}
                      {t.isRecurring && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: "var(--amber)",
                            background: "color-mix(in srgb, var(--amber) 12%, transparent)",
                            padding: "1px 6px",
                            borderRadius: 6,
                          }}
                        >
                          <RefreshCw size={10} /> recorrente
                        </span>
                      )}
                    </div>
                    {t.reference && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Ref: {t.reference}</div>}
                  </td>
                  <td>
                    {t.category ? (
                      <Badge tone="slate">{t.category.name}</Badge>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>—</span>
                    )}
                  </td>
                  <td>
                    <Badge tone={t.type === "INCOME" ? "green" : "red"}>
                      {t.type === "INCOME" ? "Receita" : "Despesa"}
                    </Badge>
                  </td>
                  <td>
                    <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
                      {t.paymentMethod ? (METHOD_LABEL[t.paymentMethod] ?? t.paymentMethod) : "—"}
                    </span>
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      fontWeight: 700,
                      color: t.type === "INCOME" ? "var(--success)" : "var(--danger)",
                    }}
                  >
                    {t.type === "INCOME" ? "+" : "-"}
                    {fmtCents(t.amount)}
                  </td>
                  <td>
                    <Badge tone={t.isPaid ? "green" : "amber"} dot>
                      {t.isPaid ? "Pago" : "Pendente"}
                    </Badge>
                  </td>
                  <td>
                    <TransactionActions id={t.id} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
