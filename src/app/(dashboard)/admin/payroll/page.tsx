import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, Badge } from "@/components/gw/primitives";
import { fmtCents } from "@/lib/money";
import { calcPayroll, PAYMENT_TYPE_LABEL, type SalaryPaymentType } from "@/lib/payroll";
import { MonthYearQuerySchema } from "@/lib/schemas";
import { PayrollPayButton } from "./pay-button";
import { Banknote, PiggyBank, Receipt, Wallet, AlertTriangle } from "lucide-react";

const CONTRACT_LABEL: Record<string, string> = { CLT: "CLT", PJ: "PJ", HOURLY: "Horista" };

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string }> }) {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== "ADMIN") redirect("/login");

  const now = new Date();
  const sp = await searchParams;
  const q = MonthYearQuerySchema.safeParse({ month: sp?.month, year: sp?.year });
  const month = (q.success ? q.data.month : undefined) ?? now.getMonth() + 1;
  const year = (q.success ? q.data.year : undefined) ?? now.getFullYear();

  const [employees, monthPayments] = await Promise.all([
    prisma.employee.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.salaryPayment.findMany({ where: { month, year } }),
  ]);

  const rows = employees.map((emp) => {
    const calc = calcPayroll(emp.salary, emp.dependents, emp.contractType);
    const payments = monthPayments.filter((p) => p.employeeId === emp.id);
    return { emp, calc, payments };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      gross: acc.gross + r.calc.gross,
      net: acc.net + r.calc.net,
      charges: acc.charges + r.calc.inss + r.calc.irrf + r.calc.fgts,
      provisions: acc.provisions + r.calc.provision13 + r.calc.provisionVacation,
      employerCost: acc.employerCost + r.calc.employerCost,
    }),
    { gross: 0, net: 0, charges: 0, provisions: 0, employerCost: 0 }
  );

  const monthName = new Date(year, month - 1).toLocaleString("pt-BR", { month: "long" });

  const cards = [
    { icon: Banknote, label: "Folha bruta", value: totals.gross, color: "var(--accent)" },
    { icon: Wallet, label: "Líquido a pagar", value: totals.net, color: "var(--success)" },
    { icon: Receipt, label: "Encargos (INSS+IRRF+FGTS)", value: totals.charges, color: "var(--amber)" },
    { icon: PiggyBank, label: "Provisão mensal (13º+férias)", value: totals.provisions, color: "var(--brand)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <p style={{ fontSize: 13.5, color: "var(--muted)", textTransform: "capitalize" }}>{monthName} de {year}</p>
        <p style={{ fontSize: 13.5 }}>
          Custo real do mês: <b style={{ color: "var(--ink)", fontSize: 15 }}>{fmtCents(totals.employerCost)}</b>
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--gap)" }}>
        {cards.map((c) => (
          <Card key={c.label}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <c.icon size={16} color={c.color} />
              <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>{c.label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.color, letterSpacing: "-.02em" }}>{fmtCents(c.value)}</div>
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
              href={`/admin/payroll?month=${m}&year=${year}`}
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

      <Card pad={false}>
        <table className="gw-table">
          <thead>
            <tr>
              <th>Funcionário</th><th>Contrato</th>
              <th style={{ textAlign: "right" }}>Bruto</th>
              <th style={{ textAlign: "right" }}>INSS</th>
              <th style={{ textAlign: "right" }}>IRRF</th>
              <th style={{ textAlign: "right" }}>FGTS</th>
              <th style={{ textAlign: "right" }}>Líquido</th>
              <th style={{ textAlign: "right" }}>Custo real</th>
              <th>Pago no mês</th>
              <th style={{ textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>Nenhum funcionário ativo.</td></tr>
            ) : (
              rows.map(({ emp, calc, payments }) => (
                <tr key={emp.id}>
                  <td>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{emp.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{emp.role}{emp.dependents > 0 ? ` · ${emp.dependents} dep.` : ""}</div>
                  </td>
                  <td><Badge tone={emp.contractType === "CLT" ? "blue" : "slate"}>{CONTRACT_LABEL[emp.contractType]}</Badge></td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{fmtCents(calc.gross)}</td>
                  <td style={{ textAlign: "right", color: "var(--danger)" }}>{calc.inss ? `−${fmtCents(calc.inss)}` : "—"}</td>
                  <td style={{ textAlign: "right", color: "var(--danger)" }}>{calc.irrf ? `−${fmtCents(calc.irrf)}` : "—"}</td>
                  <td style={{ textAlign: "right", color: "var(--amber)" }}>{calc.fgts ? fmtCents(calc.fgts) : "—"}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "var(--success)" }}>{fmtCents(calc.net)}</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{fmtCents(calc.employerCost)}</td>
                  <td>
                    {payments.length === 0 ? (
                      <span style={{ color: "var(--muted)", fontSize: 12.5 }}>—</span>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {payments.map((p) => (
                          <a key={p.id} href={`/api/salary-payments/${p.id}/receipt`} title="Baixar holerite PDF" style={{ textDecoration: "none" }}>
                            <Badge tone="green" dot>{PAYMENT_TYPE_LABEL[p.type as SalaryPaymentType]} ⤓</Badge>
                          </a>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <PayrollPayButton employeeId={emp.id} salaryCents={emp.salary} month={month} year={year} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <Card style={{ borderLeft: "4px solid var(--amber)" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertTriangle size={17} color="var(--amber)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
            <b>Estimativa gerencial.</b> Valores calculados com as tabelas vigentes de INSS/IRRF (2025) e FGTS 8%,
            regime Simples Nacional (sem INSS patronal de 20%). A provisão mensal de 13º e férias é a &quot;dívida invisível&quot;
            que cresce todo mês — reserve esse valor. Não substitui contador/eSocial. Tabelas em <code>src/lib/payroll-tables.ts</code>.
          </p>
        </div>
      </Card>
    </div>
  );
}
