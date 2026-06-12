import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { AdjustPlansSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/plans/adjust — reajuste em lote de TODOS os planos ativos.
 * Afeta apenas mensalidades futuras (matrículas novas e Payments gerados depois);
 * matrículas existentes mantêm o preço do plano vigente via relação.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAdmin();

  const parsed = AdjustPlansSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const { percent } = parsed.data;
  const factor = 1 + percent / 100;

  const plans = await prisma.plan.findMany({ where: { isActive: true } });

  const updated = await prisma.$transaction(
    plans.map((p) =>
      prisma.plan.update({
        where: { id: p.id },
        data: { price: Math.round(p.price * factor) },
      })
    )
  );

  await audit({
    userId: session.user.id,
    action: "ADJUST_PLANS",
    entity: "Plan",
    payload: { percent, plansUpdated: updated.length },
  });

  return NextResponse.json({
    updated: updated.map((p) => ({ id: p.id, name: p.name, price: p.price })),
  });
});
