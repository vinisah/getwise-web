import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ApiError, zodMessage } from "@/lib/api-error";
import { requireAuth, requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { UpdateLessonSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";
import { awardLesson } from "@/lib/services/gamification";
import type { Prisma } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/lessons/[id] — editar aula OU transicionar status (cancelar/concluir).
 * Admin pode tudo; professor só a própria aula. Cancelar cascateia os bookings.
 */
export const PATCH = withErrorHandler(async (req: NextRequest, ctx) => {
  const session = await requireAuth("lessons");
  const { id } = await (ctx as Ctx).params;

  if (session.user.role !== "ADMIN" && session.user.role !== "TEACHER") {
    throw new ApiError(403, "Não autorizado");
  }

  const lesson = await prisma.lesson.findUnique({ where: { id }, select: { id: true, teacherId: true, status: true, cohortId: true, level: true } });
  if (!lesson) return NextResponse.json({ error: "Aula não encontrada" }, { status: 404 });

  // Professor só edita a própria aula.
  if (session.user.role === "TEACHER" && lesson.teacherId !== session.user.id) {
    throw new ApiError(403, "Você só pode alterar suas próprias aulas");
  }

  const parsed = UpdateLessonSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
  }
  const d = parsed.data;
  if (lesson.cohortId && d.level && d.level !== lesson.level) throw new ApiError(409, "O nível desta aula precisa corresponder ao nível da turma.");

  // Estados terminais (COMPLETED/CANCELLED) são finais: não reabrir. Sem isso, alternar
  // COMPLETED→SCHEDULED→COMPLETED via API crua reprocessaria XP de aula a cada ciclo.
  if (
    d.status !== undefined &&
    d.status !== lesson.status &&
    (lesson.status === "COMPLETED" || lesson.status === "CANCELLED")
  ) {
    throw new ApiError(400, "Aula já finalizada — não é possível alterar o status.");
  }

  const data: Prisma.LessonUpdateInput = {};
  if (d.title !== undefined) data.title = d.title;
  if (d.description !== undefined) data.description = d.description || null;
  if (d.scheduledAt) data.scheduledAt = new Date(d.scheduledAt);
  if (d.duration !== undefined) data.duration = d.duration;
  if (d.meetingUrl !== undefined) data.meetingUrl = d.meetingUrl || null;
  if (d.level !== undefined) data.level = d.level;
  if (d.status !== undefined) data.status = d.status;
  if (d.notes !== undefined) data.notes = d.notes || null;

  // Transição p/ concluída (1ª vez) → base p/ XP de aula idempotente.
  const completing = d.status === "COMPLETED" && lesson.status !== "COMPLETED";

  const updated = await prisma.$transaction(async (tx) => {
    const up = await tx.lesson.update({ where: { id }, data });
    // Cancelar a aula cancela também as reservas dos alunos.
    if (d.status === "CANCELLED") {
      await tx.lessonBooking.updateMany({ where: { lessonId: id }, data: { status: "CANCELLED" } });
    }
    // Concluir a aula conclui as reservas não canceladas (espelha o status).
    if (completing) {
      await tx.lessonBooking.updateMany({
        where: { lessonId: id, status: { not: "CANCELLED" } },
        data: { status: "COMPLETED" },
      });
    }
    return up;
  });

  // Gamificação: XP de aula só na transição p/ COMPLETED e só a quem NÃO foi marcado ausente
  // (attendance != false → presente ou ainda não marcado). Best-effort.
  if (completing) {
    const bookings = await prisma.lessonBooking.findMany({
      where: { lessonId: id, status: "COMPLETED", attendance: { not: false } },
      select: { studentId: true },
    });
    await Promise.all(bookings.map((b) => awardLesson(b.studentId).catch(() => {})));
  }

  await audit({
    userId: session.user.id,
    action: "UPDATE_LESSON",
    entity: "Lesson",
    entityId: id,
    payload: { status: d.status },
  });
  return NextResponse.json(updated);
});

/**
 * DELETE /api/lessons/[id] — admin remove a aula e suas reservas.
 */
export const DELETE = withErrorHandler(async (_req: NextRequest, ctx) => {
  const session = await requireAdmin("lessons");
  const { id } = await (ctx as Ctx).params;

  const lesson = await prisma.lesson.findUnique({ where: { id }, select: { id: true } });
  if (!lesson) return NextResponse.json({ error: "Aula não encontrada" }, { status: 404 });

  await prisma.$transaction([
    // Exercise.lessonId é Restrict (sem cascade) — desvincula antes de apagar, senão P2003.
    prisma.exercise.updateMany({ where: { lessonId: id }, data: { lessonId: null } }),
    prisma.lessonBooking.deleteMany({ where: { lessonId: id } }),
    prisma.lesson.delete({ where: { id } }),
  ]);

  await audit({ userId: session.user.id, action: "DELETE_LESSON", entity: "Lesson", entityId: id });
  return NextResponse.json({ ok: true });
});
