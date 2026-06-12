import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { CreateEmployeeSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";

export const GET = withErrorHandler(async (_req: NextRequest) => {
  await requireAdmin();

  const employees = await prisma.employee.findMany({
    orderBy: { name: "asc" },
    include: {
      salaryPayments: {
        orderBy: { year: "desc" },
        take: 3,
      },
    },
  });

  return NextResponse.json(employees);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAdmin();

  const parsed = CreateEmployeeSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }

  const { name, email, phone, role, cpf, salary, contractType, dependents, startDate, notes } = parsed.data;

  const employee = await prisma.employee.create({
    data: {
      name,
      email: email || null,
      phone: phone || null,
      role,
      cpf: cpf || null,
      salary,
      contractType,
      dependents,
      startDate: new Date(startDate),
      notes: notes || null,
    },
  });

  await audit({ userId: session.user.id, action: "CREATE_EMPLOYEE", entity: "Employee", entityId: employee.id });

  return NextResponse.json(employee, { status: 201 });
});
