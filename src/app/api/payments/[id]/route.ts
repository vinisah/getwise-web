import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { MarkPaymentSchema } from "@/lib/schemas";
import { calcLateCharges } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/payments/[id] — marcar mensalidade paga/pendente.
 * PAID → grava paidAt + cria receita no financeiro (idempotente via reference).
 * PENDING → limpa paidAt + remove a receita correspondente.
 */
export const PATCH = withErrorHandler(async (req: NextRequest, ctx) => {
  const session = await requireAdmin();
  const { id } = await (ctx as Ctx).params;

  const parsed = MarkPaymentSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const { status, method } = parsed.data;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { student: { select: { name: true } } },
  });
  if (!payment) return NextResponse.json({ error: "Mensalidade não encontrada" }, { status: 404 });

  const reference = `payment:${id}`;
  const ref = `${String(payment.month).padStart(2, "0")}/${payment.year}`;

  // Multa 2% + juros 1% a.m. pro-rata se vencida (calculado no momento da baixa).
  const daysOverdue = Math.floor((Date.now() - payment.dueDate.getTime()) / 86_400_000);
  const charges = calcLateCharges(payment.amount, daysOverdue);
  const hasCharges = charges.total > payment.amount;

  const updated = await prisma.$transaction(async (tx) => {
    if (status === "PAID") {
      const up = await tx.payment.update({
        where: { id },
        data: { status: "PAID", paidAt: new Date(), ...(method ? { method } : {}) },
      });
      // Idempotente: só cria a receita se ainda não existe.
      const existing = await tx.financialTransaction.findFirst({ where: { reference } });
      if (!existing) {
        await tx.financialTransaction.create({
          data: {
            type: "INCOME",
            amount: charges.total,
            description: `Mensalidade ${payment.student.name} — ${ref}${hasCharges ? " (c/ multa e juros)" : ""}`,
            date: new Date(),
            isPaid: true,
            paidAt: new Date(),
            paymentMethod: method ?? null,
            reference,
            createdBy: session.user.id,
          },
        });
      }
      return up;
    }
    // Volta a PENDENTE: remove a receita vinculada.
    const up = await tx.payment.update({
      where: { id },
      data: { status: "PENDING", paidAt: null },
    });
    await tx.financialTransaction.deleteMany({ where: { reference } });
    return up;
  });

  await audit({ userId: session.user.id, action: "PAYMENT_UPDATED", entity: "Payment", entityId: id, payload: { status } });
  return NextResponse.json(updated);
});
