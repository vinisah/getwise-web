import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { renderPayslipPdf } from "@/lib/services/receipts";
import type { SalaryPaymentType } from "@/lib/payroll";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/salary-payments/[id]/receipt — holerite simplificado em PDF.
 */
export const GET = withErrorHandler(async (_req: NextRequest, ctx) => {
  await requireAdmin("payroll");
  const { id } = await (ctx as Ctx).params;

  const sp = await prisma.salaryPayment.findUnique({
    where: { id },
    include: { employee: { select: { name: true, role: true } } },
  });
  if (!sp) return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 });

  const pdf = await renderPayslipPdf({
    salaryPaymentId: sp.id,
    employeeName: sp.employee.name,
    employeeRole: sp.employee.role,
    type: sp.type as SalaryPaymentType,
    month: sp.month,
    year: sp.year,
    grossAmount: sp.grossAmount,
    inssAmount: sp.inssAmount,
    irrfAmount: sp.irrfAmount,
    fgtsAmount: sp.fgtsAmount,
    netAmount: sp.amount,
    paidAt: sp.paidAt,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="holerite-${sp.month}-${sp.year}-${sp.id.slice(-6)}.pdf"`,
    },
  });
});
