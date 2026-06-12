import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAuth, requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/exercises/[id] — detalhe do exercício (sem revelar correctAnswer ao aluno). */
export const GET = withErrorHandler(async (_req: NextRequest, ctx) => {
  const session = await requireAuth();
  const { id } = await (ctx as Ctx).params;

  const exercise = await prisma.exercise.findUnique({ where: { id } });
  if (!exercise) return NextResponse.json({ error: "Exercício não encontrado" }, { status: 404 });

  // Aluno não recebe o gabarito
  if (session.user.role === "STUDENT") {
    const { correctAnswer: _omit, ...safe } = exercise;
    void _omit;
    return NextResponse.json(safe);
  }
  return NextResponse.json(exercise);
});

/** DELETE /api/exercises/[id] — admin remove exercício. */
export const DELETE = withErrorHandler(async (_req: NextRequest, ctx) => {
  const session = await requireAdmin();
  const { id } = await (ctx as Ctx).params;

  // Remove tentativas associadas primeiro (sem cascade no schema)
  await prisma.exerciseAttempt.deleteMany({ where: { exerciseId: id } });
  await prisma.exercise.delete({ where: { id } });

  await audit({ userId: session.user.id, action: "DELETE_UNIT", entity: "Exercise", entityId: id });
  return NextResponse.json({ ok: true });
});
