import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withErrorHandler } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { MarkPaymentSchema } from "@/lib/schemas";
import { calcLateCharges } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

/** Dias de atraso contados em dias-calendário de Brasília (UTC−3). */
function daysOverdueBrasilia(dueDate: Date, now: number): number {
  const dayMs = 86_400_000;
  const offset = 3 * 3_600_000;
  const dueDay = Math.floor((dueDate.getTime() - offset) / dayMs);
  const nowDay = Math.floor((now - offset) / dayMs);
  return nowDay - dueDay;
}

/**
 * PATCH /api/payments/[id] — marcar mensalidade paga/pendente.
 * PAID → grava paidAt + amountPaid (com multa/juros) + receita idempotente (reference @unique).
 * PENDING → limpa paidAt/amountPaid + remove a receita.
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

  if (status === "PAID") {
    // Já paga → no-op idempotente (não recalcula juros nem duplica receita).
    if (payment.status === "PAID" && payment.amountPaid != null) {
      return NextResponse.json(payment);
    }
    const days = daysOverdueBrasilia(payment.dueDate, Date.now());
    const charges = calcLateCharges(payment.amount, days);
    const hasCharges = charges.total > payment.amount;

    const result = await prisma.$transaction(async (tx) => {
      // Transição condicional (anti-race): só efetiva se a baixa ainda NÃO ocorreu.
      // Duas requisições simultâneas → só a 1ª casa o WHERE; a 2ª vê count 0 e vira no-op,
      // evitando amountPaid divergente (juros recalculados em instantes diferentes).
      const res = await tx.payment.updateMany({
        where: { id, status: { not: "PAID" } },
        data: { status: "PAID", paidAt: new Date(), amountPaid: charges.total, ...(method ? { method } : {}) },
      });
      if (res.count === 0) {
        return { changed: false as const, payment: await tx.payment.findUnique({ where: { id } }) };
      }
      // Receita idempotente: reference é @unique → P2002 = já existe (no-op).
      try {
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
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      }
      return { changed: true as const, payment: await tx.payment.findUnique({ where: { id } }) };
    });

    if (!result.payment) return NextResponse.json({ error: "Mensalidade não encontrada" }, { status: 404 });
    if (result.changed) {
      await audit({
        userId: session.user.id,
        action: "PAYMENT_UPDATED",
        entity: "Payment",
        entityId: id,
        payload: { status, amountPaid: charges.total },
      });
    }
    return NextResponse.json(result.payment);
  }

  // Volta a PENDENTE: limpa baixa + remove a receita vinculada. Também zera os campos de boleto
  // (chargeId/boletoUrl/boletoLine) — senão a mensalidade nunca seria re-cobrada pelo gerador
  // (filtra chargeId:null) e um reenvio do webhook do Asaas re-daria baixa (acha por chargeId).
  const updated = await prisma.$transaction(async (tx) => {
    const up = await tx.payment.update({
      where: { id },
      data: { status: "PENDING", paidAt: null, amountPaid: null, chargeId: null, boletoUrl: null, boletoLine: null },
    });
    await tx.financialTransaction.deleteMany({ where: { reference } });
    return up;
  });

  await audit({
    userId: session.user.id,
    action: "PAYMENT_UPDATED",
    entity: "Payment",
    entityId: id,
    payload: { status },
  });
  return NextResponse.json(updated);
});
