import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, zodMessage } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { CreateTransactionSchema, MonthYearQuerySchema } from "@/lib/schemas";
import { monthRangeBrasilia } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin();

  const { searchParams } = new URL(req.url);
  const parsed = MonthYearQuerySchema.safeParse({
    month: searchParams.get("month") ?? undefined,
    year: searchParams.get("year") ?? undefined,
    type: searchParams.get("type") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Parâmetros inválidos" },
      { status: 400 }
    );
  }

  const now = new Date();
  const filterYear = parsed.data.year ?? now.getFullYear();
  const filterMonth = parsed.data.month ?? now.getMonth() + 1;
  const { gte, lte } = monthRangeBrasilia(filterYear, filterMonth);

  const where: Prisma.FinancialTransactionWhereInput = {
    date: { gte, lte },
    ...(parsed.data.type ? { type: parsed.data.type } : {}),
  };

  const [transactions, summary] = await Promise.all([
    prisma.financialTransaction.findMany({
      where,
      include: { category: true },
      orderBy: { date: "desc" },
    }),
    prisma.financialTransaction.groupBy({
      by: ["type"],
      where: { date: { gte, lte }, isPaid: true },
      _sum: { amount: true },
    }),
  ]);

  // Valores em centavos (Int) — soma exata, sem erro de ponto flutuante.
  const income = summary.find((s) => s.type === "INCOME")?._sum.amount ?? 0;
  const expenses = summary.find((s) => s.type === "EXPENSE")?._sum.amount ?? 0;

  return NextResponse.json({
    transactions,
    summary: {
      income,
      expenses,
      balance: income - expenses,
    },
  });
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAdmin();

  const parsed = CreateTransactionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
  }

  const { type, amount, description, date, dueDate, categoryId, isPaid, isRecurring, paymentMethod, reference, notes, userId } = parsed.data;

  const transaction = await prisma.financialTransaction.create({
    data: {
      type,
      amount,
      description,
      date: new Date(date),
      dueDate: dueDate ? new Date(dueDate) : null,
      categoryId: categoryId || null,
      isPaid: isPaid ?? false,
      isRecurring: isRecurring ?? false,
      paidAt: isPaid ? new Date() : null,
      paymentMethod: paymentMethod || null,
      reference: reference || null,
      notes: notes || null,
      userId: userId || null,
      createdBy: session.user.id,
    },
    include: { category: true },
  });

  await audit({ userId: session.user.id, action: "CREATE_TRANSACTION", entity: "FinancialTransaction", entityId: transaction.id });

  return NextResponse.json(transaction, { status: 201 });
});
