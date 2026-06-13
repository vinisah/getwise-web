import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { GenerateRecurringSchema } from "@/lib/schemas";
import { monthRangeBrasilia } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/financial/recurring — gera as transações recorrentes do mês alvo
 * clonando as marcadas isRecurring do mês ANTERIOR. Idempotente: não duplica
 * (dedupe por descrição no mês alvo). Clones nascem não-pagos.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAdmin();

  const parsed = GenerateRecurringSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const { month, year } = parsed.data;

  // Mês anterior (com virada de ano).
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const prevRange = monthRangeBrasilia(prevYear, prevMonth);
  const targetRange = monthRangeBrasilia(year, month);

  const [sources, existing] = await Promise.all([
    prisma.financialTransaction.findMany({
      where: { isRecurring: true, date: { gte: prevRange.gte, lte: prevRange.lte } },
    }),
    prisma.financialTransaction.findMany({
      where: { date: { gte: targetRange.gte, lte: targetRange.lte } },
      select: { description: true },
    }),
  ]);

  const existingDescriptions = new Set(existing.map((t) => t.description));
  const toCreate = sources.filter((s) => !existingDescriptions.has(s.description));

  // Mesmo dia do mês, limitado ao último dia do mês alvo. Datas em UTC−3 (Brasília).
  const lastDayOfTarget = new Date(Date.UTC(year, month, 0)).getUTCDate();

  // Cria tudo numa única transação (atômico + 1 ida ao banco em vez de N).
  await prisma.$transaction(
    toCreate.map((s) => {
      const day = Math.min(s.date.getUTCDate(), lastDayOfTarget);
      return prisma.financialTransaction.create({
        data: {
          type: s.type,
          amount: s.amount,
          description: s.description,
          date: new Date(Date.UTC(year, month - 1, day, 3, 0, 0)),
          dueDate: s.dueDate ? new Date(Date.UTC(year, month - 1, day, 3, 0, 0)) : null,
          categoryId: s.categoryId,
          isPaid: false,
          isRecurring: true,
          paymentMethod: s.paymentMethod,
          notes: s.notes,
          createdBy: session.user.id,
        },
      });
    })
  );
  const created = toCreate.length;

  await audit({ userId: session.user.id, action: "GENERATE_RECURRING", entity: "FinancialTransaction", payload: { month, year, created, skipped: sources.length - created } });

  return NextResponse.json({ created, skipped: sources.length - created });
});
