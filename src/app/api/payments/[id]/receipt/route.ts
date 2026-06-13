import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { renderTuitionReceiptPdf } from "@/lib/services/receipts";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/payments/[id]/receipt — recibo PDF da mensalidade PAGA.
 * Acesso: admin ou o próprio aluno dono da mensalidade.
 */
export const GET = withErrorHandler(async (_req: NextRequest, ctx) => {
  const session = await requireAuth();
  const { id } = await (ctx as Ctx).params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, name: true } },
      enrollment: { include: { plan: { select: { name: true } } } },
    },
  });
  if (!payment) return NextResponse.json({ error: "Mensalidade não encontrada" }, { status: 404 });

  if (session.user.role !== "ADMIN" && payment.studentId !== session.user.id) {
    throw new ApiError(403, "Acesso negado");
  }
  if (payment.status !== "PAID") {
    throw new ApiError(400, "Recibo disponível apenas para mensalidade paga");
  }

  const pdf = await renderTuitionReceiptPdf({
    paymentId: payment.id,
    studentName: payment.student.name,
    planName: payment.enrollment?.plan.name ?? null,
    month: payment.month,
    year: payment.year,
    amount: payment.amountPaid ?? payment.amount, // valor efetivamente recebido (c/ multa/juros)
    paidAt: payment.paidAt,
    method: payment.method,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="recibo-${payment.month}-${payment.year}-${payment.id.slice(-6)}.pdf"`,
    },
  });
});
