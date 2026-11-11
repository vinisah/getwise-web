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
 * estável ancorada na RAIZ (`recurring:<rootId>:<MM/YYYY>` + @unique) — re-rodar
 * ou gerar fora de ordem não duplica, pois a chave não depende do mês predecessor.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAdmin("financial");

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
    // Vencimento: preserva o DIA do dueDate original (não a data de competência),
    // clampeado ao último dia do mês alvo. Ex.: lançado dia 05 / vence dia 10 → clone vence dia 10.
    const dueDate = s.dueDate
      ? new Date(Date.UTC(year, month - 1, Math.min(s.dueDate.getUTCDate(), lastDayOfTarget), 3, 0, 0))
      : null;
    // Idempotência ancorada na RAIZ da recorrência (não no id do mês anterior).
    // Sem isso, o clone do mês N vira fonte do mês N+1 e a chave de dedupe muda a cada mês,
    // permitindo duplicação em geração fora de ordem. O clone segue isRecurring:true para propagar.
    const rootId = s.reference?.startsWith("recurring:") ? s.reference.split(":")[1] || s.id : s.id;
    try {
      await prisma.financialTransaction.create({
        data: {
          type: s.type,
          amount: s.amount,
          description: s.description,
          date,
          dueDate,
          categoryId: s.categoryId,
          isPaid: false,
          isRecurring: true,
          paymentMethod: s.paymentMethod,
          notes: s.notes,
          reference: `recurring:${rootId}:${ref}`, // dedupe estável por raiz (idempotente via @unique)
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
