import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireRole } from "@/lib/api-auth";
import { VideoProgressSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";
import { recomputeUnitCompletion } from "@/lib/services/unit-completion";
import { canAccessUnit } from "@/lib/services/unlock";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/units/[id]/video-progress — salva posição/percent do vídeo (real-time).
 * Edge case: resume após fechar o navegador. Dispara conclusão se >=90%.
 */
export const POST = withErrorHandler(async (req: NextRequest, ctx) => {
  const session = await requireRole("STUDENT");
  const { id: unitId } = await (ctx as Ctx).params;

  const parsed = VideoProgressSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const { positionSeconds, watchedPercent } = parsed.data;

  const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { id: true } });
  if (!unit) return NextResponse.json({ error: "Unidade não encontrada" }, { status: 404 });

  // Gate de conteúdo: aluno só registra progresso em unidade desbloqueada (simetria com exercises/attempt).
  if (session.user.role === "STUDENT") {
    const ok = await canAccessUnit(session.user.id, unitId);
    if (!ok) return NextResponse.json({ error: "Unidade bloqueada" }, { status: 403 });
  }

  // Não regredir watchedPercent (mantém o máximo já assistido)
  const existing = await prisma.unitVideoProgress.findUnique({
    where: { userId_unitId: { userId: session.user.id, unitId } },
  });
  const maxWatched = Math.max(existing?.watchedPercent ?? 0, watchedPercent);

  await prisma.unitVideoProgress.upsert({
    where: { userId_unitId: { userId: session.user.id, unitId } },
    update: { positionSeconds, watchedPercent: maxWatched },
    create: { userId: session.user.id, unitId, positionSeconds, watchedPercent: maxWatched },
  });

  let unitCompleted = false;
  if (maxWatched >= 90) {
    const rc = await recomputeUnitCompletion(session.user.id, session.user.name, unitId);
    unitCompleted = rc.completed;
  }

  return NextResponse.json({ ok: true, watchedPercent: maxWatched, unitCompleted });
});
