import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { MonthYearQuerySchema } from "@/lib/schemas";
import { calcPayroll } from "@/lib/payroll";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/payroll?month=&year= — folha consolidada do mês.
 * Por funcionário ativo: cálculo completo + parcelas já registradas no mês.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin("payroll");

  const { searchParams } = new URL(req.url);
  const parsed = MonthYearQuerySchema.safeParse({
    month: searchParams.get("month") ?? undefined,
    year: searchParams.get("year") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Parâmetros inválidos" }, { status: 400 });
  }

  const now = new Date();
  const month = parsed.data.month ?? now.getMonth() + 1;
  const year = parsed.data.year ?? now.getFullYear();

  const [employees, monthPayments] = await Promise.all([
    prisma.employee.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.salaryPayment.findMany({ where: { month, year } }),
  ]);

  const rows = employees.map((emp) => {
    const calc = calcPayroll(emp.salary, emp.dependents, emp.contractType);
    const payments = monthPayments.filter((p) => p.employeeId === emp.id);
    return {
      employee: {
        id: emp.id,
        name: emp.name,
        role: emp.role,
        contractType: emp.contractType,
        dependents: emp.dependents,
        salary: emp.salary,
      },
      calc,
      payments: payments.map((p) => ({ id: p.id, type: p.type, amount: p.amount, isPaid: p.isPaid })),
      salaryPaid: payments.some((p) => p.type === "SALARY"),
    };
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

  return NextResponse.json({ month, year, rows, totals });
});
