import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, zodMessage } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { UpdateTransactionSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandler(async (_req: NextRequest, ctx) => {
  await requireAdmin("financial");
  const { id } = await (ctx as Ctx).params;

  const transaction = await prisma.financialTransaction.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!transaction) return NextResponse.json({ error: "Transação não encontrada" }, { status: 404 });
  return NextResponse.json(transaction);
});

export const PUT = withErrorHandler(async (req: NextRequest, ctx) => {
  const session = await requireAdmin("financial");
  const { id } = await (ctx as Ctx).params;

  const parsed = UpdateTransactionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
  }
  const d = parsed.data;

  const existing = await prisma.financialTransaction.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Transação não encontrada" }, { status: 404 });

  // paidAt acompanha isPaid: marca a data ao virar pago, limpa ao virar pendente.
  let paidAt = existing.paidAt;
  if (d.isPaid !== undefined) {
    paidAt = d.isPaid ? existing.paidAt ?? new Date() : null;
  }

  const transaction = await prisma.financialTransaction.update({
    where: { id },
    data: {
      ...(d.type !== undefined ? { type: d.type } : {}),
      ...(d.amount !== undefined ? { amount: d.amount } : {}),
      ...(d.description !== undefined ? { description: d.description } : {}),
      ...(d.date !== undefined ? { date: new Date(d.date) } : {}),
      ...(d.dueDate !== undefined ? { dueDate: d.dueDate ? new Date(d.dueDate) : null } : {}),
      ...(d.categoryId !== undefined ? { categoryId: d.categoryId || null } : {}),
      ...(d.isPaid !== undefined ? { isPaid: d.isPaid, paidAt } : {}),
      ...(d.isRecurring !== undefined ? { isRecurring: d.isRecurring } : {}),
      ...(d.paymentMethod !== undefined ? { paymentMethod: d.paymentMethod || null } : {}),
      ...(d.reference !== undefined ? { reference: d.reference || null } : {}),
      ...(d.notes !== undefined ? { notes: d.notes || null } : {}),
    },
    include: { category: true },
  });

  await audit({ userId: session.user.id, action: "UPDATE_TRANSACTION", entity: "FinancialTransaction", entityId: id });
  return NextResponse.json(transaction);
});

export const DELETE = withErrorHandler(async (_req: NextRequest, ctx) => {
  const session = await requireAdmin("financial");
  const { id } = await (ctx as Ctx).params;

  await prisma.financialTransaction.delete({ where: { id } });

  await audit({ userId: session.user.id, action: "DELETE_TRANSACTION", entity: "FinancialTransaction", entityId: id });
  return NextResponse.json({ ok: true });
});
