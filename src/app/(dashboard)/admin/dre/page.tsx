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
import { Download, FileBarChart } from "lucide-react";

/**
 * DRE simplificado (regime de caixa): receitas e despesas PAGAS por categoria,
 * no mês selecionado + acumulado do ano.
 */
export default async function DrePage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string }> }) {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== "ADMIN") redirect("/login");

  const now = new Date();
  const sp = await searchParams;
  const q = MonthYearQuerySchema.safeParse({ month: sp?.month, year: sp?.year });
  const month = (q.success ? q.data.month : undefined) ?? now.getMonth() + 1;
  const year = (q.success ? q.data.year : undefined) ?? now.getFullYear();

  const monthRange = monthRangeBrasilia(year, month);
  const yearRange = { gte: monthRangeBrasilia(year, 1).gte, lte: monthRangeBrasilia(year, 12).lte };

  const [monthTx, yearTx] = await Promise.all([
    prisma.financialTransaction.findMany({
      where: { isPaid: true, date: { gte: monthRange.gte, lte: monthRange.lte } },
      include: { category: true },
    }),
    prisma.financialTransaction.findMany({
      where: { isPaid: true, date: { gte: yearRange.gte, lte: yearRange.lte } },
      select: { type: true, amount: true, categoryId: true, category: { select: { name: true } } },
    }),
  ]);

  type Group = Map<string, { month: number; year: number }>;
  const groups: Record<"INCOME" | "EXPENSE", Group> = { INCOME: new Map(), EXPENSE: new Map() };

  for (const t of yearTx) {
    const key = t.category?.name ?? "Sem categoria";
    const g = groups[t.type].get(key) ?? { month: 0, year: 0 };
    g.year += t.amount;
    groups[t.type].set(key, g);
  }
  for (const t of monthTx) {
    const key = t.category?.name ?? "Sem categoria";
    const g = groups[t.type].get(key) ?? { month: 0, year: 0 };
    g.month += t.amount;
    groups[t.type].set(key, g);
  }

  const sum = (g: Group, field: "month" | "year") => [...g.values()].reduce((s, v) => s + v[field], 0);
  const incomeMonth = sum(groups.INCOME, "month");
  const incomeYear = sum(groups.INCOME, "year");
  const expenseMonth = sum(groups.EXPENSE, "month");
  const expenseYear = sum(groups.EXPENSE, "year");

  const monthName = new Date(year, month - 1).toLocaleString("pt-BR", { month: "long" });

  const section = (title: string, g: Group, sign: string, color: string) => (
    <>
      <tr style={{ background: "var(--bg-2, rgba(0,0,0,0.02))" }}>
        <td style={{ fontWeight: 700, color: "var(--ink)" }}>{title}</td>
        <td style={{ textAlign: "right", fontWeight: 700, color }}>{sign}{fmtCents(sum(g, "month"))}</td>
        <td style={{ textAlign: "right", fontWeight: 700, color }}>{sign}{fmtCents(sum(g, "year"))}</td>
      </tr>
      {[...g.entries()].sort((a, b) => b[1].year - a[1].year).map(([name, v]) => (
        <tr key={title + name}>
          <td style={{ paddingLeft: 28, color: "var(--ink-2)", fontSize: 13 }}>{name}</td>
          <td style={{ textAlign: "right", fontSize: 13 }}>{fmtCents(v.month)}</td>
          <td style={{ textAlign: "right", fontSize: 13 }}>{fmtCents(v.year)}</td>
        </tr>
      ))}
    </>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <p style={{ fontSize: 13.5, color: "var(--muted)", textTransform: "capitalize" }}>
          {monthName} de {year} · regime de caixa (só pagos)
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={`/api/financial/export?month=${month}&year=${year}`}>
            <Button variant="outline" size="sm"><Download size={15} /> CSV do mês</Button>
          </a>
          <a href={`/api/financial/export?year=${year}`}>
            <Button variant="outline" size="sm"><Download size={15} /> CSV do ano</Button>
          </a>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {Array.from({ length: 12 }, (_, i) => {
          const m = i + 1;
          const label = new Date(year, i).toLocaleString("pt-BR", { month: "short" }).replace(".", "");
          const active = m === month;
          return (
            <Link key={m} href={`/admin/dre?month=${m}&year=${year}`}
              style={{
                padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                textTransform: "capitalize", textDecoration: "none",
                border: `1px solid ${active ? "var(--brand)" : "var(--line)"}`,
                background: active ? "var(--brand)" : "var(--card)",
                color: active ? "#fff" : "var(--ink-2)",
              }}>
              {label}
            </Link>
          );
        })}
      </div>

      {groups.INCOME.size === 0 && groups.EXPENSE.size === 0 ? (
        <Card style={{ textAlign: "center", padding: 48 }}>
          <FileBarChart size={36} color="var(--muted)" style={{ margin: "0 auto 12px" }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Sem lançamentos pagos em {monthName}</p>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
            O DRE mostra receitas e despesas <b>pagas</b> (regime de caixa). Marque mensalidades como pagas
            ou registre despesas para popular o demonstrativo.
          </p>
        </Card>
      ) : (
        <Card pad={false}>
          <table className="gw-table">
            <thead>
              <tr>
                <th>Demonstrativo de Resultado</th>
                <th style={{ textAlign: "right", textTransform: "capitalize" }}>{monthName}</th>
                <th style={{ textAlign: "right" }}>Acumulado {year}</th>
              </tr>
            </thead>
            <tbody>
              {section("Receitas", groups.INCOME, "+", "var(--success)")}
              {section("(−) Despesas", groups.EXPENSE, "−", "var(--danger)")}
              <tr style={{ borderTop: "2px solid var(--line)" }}>
                <td style={{ fontWeight: 800, fontSize: 14.5, color: "var(--ink)" }}>= Resultado</td>
                <td style={{ textAlign: "right", fontWeight: 800, fontSize: 14.5, color: incomeMonth - expenseMonth >= 0 ? "var(--success)" : "var(--danger)" }}>
                  {fmtCents(incomeMonth - expenseMonth)}
                </td>
                <td style={{ textAlign: "right", fontWeight: 800, fontSize: 14.5, color: incomeYear - expenseYear >= 0 ? "var(--success)" : "var(--danger)" }}>
                  {fmtCents(incomeYear - expenseYear)}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
