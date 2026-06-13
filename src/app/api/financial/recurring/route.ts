import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withErrorHandler } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { GenerateRecurringSchema } from "@/lib/schemas";
import { monthRangeBrasilia } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/financial/recurring — gera as transações recorrentes do mês alvo
 * clonando as marcadas isRecurring do mês ANTERIOR. Idempotente via `reference`
 * estável (`recurring:<sourceId>:<MM/YYYY>` + @unique) — re-rodar não duplica.
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

  const sources = await prisma.financialTransaction.findMany({
    where: { isRecurring: true, date: { gte: prevRange.gte, lte: prevRange.lte } },
  });

  const ref = `${String(month).padStart(2, "0")}/${year}`;
  const lastDayOfTarget = new Date(Date.UTC(year, month, 0)).getUTCDate();

  let created = 0;
  for (const s of sources) {
    const day = Math.min(s.date.getUTCDate(), lastDayOfTarget);
    const date = new Date(Date.UTC(year, month - 1, day, 3, 0, 0));
    try {
      await prisma.financialTransaction.create({
        data: {
          type: s.type,
          amount: s.amount,
          description: s.description,
          date,
          dueDate: s.dueDate ? date : null,
          categoryId: s.categoryId,
          isPaid: false,
          isRecurring: true,
          paymentMethod: s.paymentMethod,
          notes: s.notes,
          reference: `recurring:${s.id}:${ref}`, // dedupe estável (idempotente via @unique)
          createdBy: session.user.id,
        },
      });
      created += 1;
    } catch (e) {
      // P2002 = já gerada para este mês → pula (idempotente).
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }

  await audit({ userId: session.user.id, action: "GENERATE_RECURRING", entity: "FinancialTransaction", payload: { month, year, created, skipped: sources.length - created } });

  return NextResponse.json({ created, skipped: sources.length - created });
});
