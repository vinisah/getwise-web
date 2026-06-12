import { NextRequest, NextResponse } from "next/server";
import { ApiError, withErrorHandler } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { CreateSalaryPaymentSchema, MonthYearQuerySchema } from "@/lib/schemas";
import { monthRangeBrasilia } from "@/lib/utils";
import { calcPaymentBreakdown, PAYMENT_TYPE_LABEL } from "@/lib/payroll";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin();

  const { searchParams } = new URL(req.url);
  const parsed = MonthYearQuerySchema.safeParse({
    month: searchParams.get("month") ?? undefined,
    year: searchParams.get("year") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Parâmetros inválidos" }, { status: 400 });
  }

  const where: Prisma.SalaryPaymentWhereInput = {
    ...(parsed.data.month ? { month: parsed.data.month } : {}),
    ...(parsed.data.year ? { year: parsed.data.year } : {}),
  };

  const payments = await prisma.salaryPayment.findMany({
    where,
    include: { employee: true },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  return NextResponse.json(payments);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAdmin();

  const parsed = CreateSalaryPaymentSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const { employeeId, month, year, type, isPaid, notes } = parsed.data;

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new ApiError(404, "Funcionário não encontrado");

  // Base do cálculo: bruto informado ou salário cadastrado.
  // O SERVIDOR calcula descontos/encargos — nunca confia em líquido do client.
  const baseGross = parsed.data.grossAmount ?? employee.salary;
  const b = calcPaymentBreakdown(
    type,
    baseGross,
    employee.dependents,
    employee.contractType
  );

  const paidAt = isPaid ? new Date() : null;
  const label = PAYMENT_TYPE_LABEL[type];
  const ref = `${String(month).padStart(2, "0")}/${year}`;
  // Despesa ancorada no mês de competência (Brasília).
  const expenseDate = monthRangeBrasilia(year, month).gte;
  const charges = b.inss + b.irrf + b.fgts;

  // Atômico: parcela da folha + despesa(s) no fluxo de caixa.
  const salaryPayment = await prisma.$transaction(async (tx) => {
    const sp = await tx.salaryPayment.create({
      data: {
        employeeId,
        type,
        month,
        year,
        amount: b.net,
        grossAmount: b.grossPaid,
        inssAmount: b.inss,
        irrfAmount: b.irrf,
        fgtsAmount: b.fgts,
        isPaid,
        paidAt,
        notes: notes || null,
      },
    });

    // Líquido pago ao funcionário.
    await tx.financialTransaction.create({
      data: {
        type: "EXPENSE",
        amount: b.net,
        description: `${label} líquido ${employee.name} — ${ref}`,
        date: expenseDate,
        isPaid,
        paidAt,
        reference: `salary:${sp.id}`,
        createdBy: session.user.id,
      },
    });

    // Guias (FGTS + INSS retido + IRRF retido) — saem do caixa da empresa.
    if (charges > 0) {
      await tx.financialTransaction.create({
        data: {
          type: "EXPENSE",
          amount: charges,
          description: `Encargos ${label} (FGTS+INSS+IRRF) ${employee.name} — ${ref}`,
          date: expenseDate,
          isPaid,
          paidAt,
          reference: `salary-charges:${sp.id}`,
          createdBy: session.user.id,
        },
      });
    }

    return sp;
  });

  await audit({ userId: session.user.id, action: "CREATE_SALARY_PAYMENT", entity: "SalaryPayment", entityId: salaryPayment.id, payload: { type, gross: b.grossPaid, net: b.net } });
  return NextResponse.json(salaryPayment, { status: 201 });
});
