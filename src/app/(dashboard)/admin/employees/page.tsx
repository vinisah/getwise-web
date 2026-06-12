import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, Badge, Avatar } from "@/components/gw/primitives";
import { Button } from "@/components/ui/button";
import { getInitials, formatDate } from "@/lib/utils";
import { fmtCents } from "@/lib/money";
import { calcPayroll } from "@/lib/payroll";
import { Plus, Banknote } from "lucide-react";

const CONTRACT_LABEL: Record<string, string> = { CLT: "CLT", PJ: "PJ", HOURLY: "Horista" };

export default async function EmployeesPage() {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== "ADMIN") redirect("/login");

  const employees = await prisma.employee.findMany({
    orderBy: { name: "asc" },
    include: { salaryPayments: { orderBy: [{ year: "desc" }, { month: "desc" }], take: 1 } },
  });

  // Folha real (com encargos e provisões), não só salários somados.
  const totalCost = employees
    .filter((e) => e.isActive)
    .reduce((s, e) => s + calcPayroll(e.salary, e.dependents, e.contractType).employerCost, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <p style={{ fontSize: 13.5, color: "var(--muted)" }}>
          {employees.filter((e) => e.isActive).length} ativo(s) · Custo real da folha (c/ encargos e provisões): <b style={{ color: "var(--ink)" }}>{fmtCents(totalCost)}</b>
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/admin/payroll"><Button variant="outline"><Banknote size={17} /> Folha do mês</Button></Link>
          <Link href="/admin/employees/new"><Button variant="accent"><Plus size={17} /> Novo funcionário</Button></Link>
        </div>
      </div>

      <Card pad={false}>
        <table className="gw-table">
          <thead>
            <tr><th>Funcionário</th><th>Cargo</th><th>Contrato</th><th>Salário</th><th>Custo real</th><th>Admissão</th><th>Últ. pgto.</th><th>Status</th></tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>Nenhum funcionário cadastrado.</td></tr>
            ) : (
              employees.map((emp) => {
                const last = emp.salaryPayments[0];
                const cost = calcPayroll(emp.salary, emp.dependents, emp.contractType).employerCost;
                return (
                  <tr key={emp.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                        <Avatar initials={getInitials(emp.name)} size={36} tone="seed" />
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{emp.name}</div>
                          {emp.email && <div style={{ fontSize: 12, color: "var(--muted)" }}>{emp.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td><span style={{ fontSize: 13, color: "var(--ink-2)" }}>{emp.role}</span></td>
                    <td><Badge tone={emp.contractType === "CLT" ? "blue" : "slate"}>{CONTRACT_LABEL[emp.contractType]}</Badge></td>
                    <td><span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{fmtCents(emp.salary)}</span></td>
                    <td><span style={{ fontSize: 14, fontWeight: 700, color: "var(--brand)" }}>{fmtCents(cost)}</span></td>
                    <td><span style={{ fontSize: 13, color: "var(--ink-2)" }}>{formatDate(emp.startDate)}</span></td>
                    <td>{last ? <Badge tone={last.isPaid ? "green" : "amber"} dot>{last.month}/{last.year}</Badge> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                    <td><Badge tone={emp.isActive ? "green" : "slate"} dot>{emp.isActive ? "Ativo" : "Inativo"}</Badge></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
