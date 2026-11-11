import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

const StatusFilter = z.enum(["PENDING", "PAID", "FAILED", "REFUNDED"]);

export type AgingBucket = "1-30" | "31-60" | "61-90" | "90+";

function daysOverdue(dueDate: Date, now: Date): number {
  return Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000);
}

function bucketOf(days: number): AgingBucket | null {
  if (days <= 0) return null;
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

/**
 * GET /api/payments?status= — mensalidades com aging de inadimplência.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin("receivables");

  const { searchParams } = new URL(req.url);
  const rawStatus = searchParams.get("status");
  let status: z.infer<typeof StatusFilter> | undefined;
  if (rawStatus) {
    const parsed = StatusFilter.safeParse(rawStatus);
    if (!parsed.success) {
      return NextResponse.json({ error: "Status inválido" }, { status: 400 });
    }
    status = parsed.data;
  }

  const where: Prisma.PaymentWhereInput = status ? { status } : {};

  const payments = await prisma.payment.findMany({
    where,
    include: {
      student: { select: { id: true, name: true, email: true } },
      enrollment: { include: { plan: { select: { name: true } } } },
    },
    orderBy: { dueDate: "asc" },
    take: 2000, // cap de segurança (paginação real fica p/ quando o volume exigir)
  });

  const now = new Date();
  const list = payments.map((p) => {
    const days = p.status === "PENDING" ? daysOverdue(p.dueDate, now) : 0;
    return { ...p, daysOverdue: Math.max(0, days), agingBucket: p.status === "PENDING" ? bucketOf(days) : null };
  });

  // Totais de inadimplência por bucket (só PENDING vencidas).
  const aging: Record<AgingBucket, { amount: number; count: number }> = {
    "1-30": { amount: 0, count: 0 },
    "31-60": { amount: 0, count: 0 },
    "61-90": { amount: 0, count: 0 },
    "90+": { amount: 0, count: 0 },
  };
  let overdueTotal = 0;
  for (const p of list) {
    if (p.agingBucket) {
      aging[p.agingBucket].amount += p.amount;
      aging[p.agingBucket].count += 1;
      overdueTotal += p.amount;
    }
  }

  return NextResponse.json({ payments: list, aging, overdueTotal });
});
