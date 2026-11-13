import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ApiError, zodMessage } from "@/lib/api-error";
import { requireAuth, requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { UpdateLessonSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";
import { awardLesson } from "@/lib/services/gamification";
import type { Prisma } from "@prisma/client";
import { schedulingTransaction, assertTeacherSlot, assertStudentSlot } from "@/lib/scheduling/service";

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

  const parsed = UpdateLessonSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
  }
  const d = parsed.data;
  let completing = false;
  const updated = await schedulingTransaction(async (tx) => {
    const lesson = await tx.lesson.findUnique({
      where: { id },
      select: {
        id: true,
        teacherId: true,
        status: true,
        cohortId: true,
        level: true,
        scheduledAt: true,
        duration: true,
      },
    });
    if (!lesson) throw new ApiError(404, "Aula não encontrada");

    // Professor só edita a própria aula.
    if (session.user.role === "TEACHER" && lesson.teacherId !== session.user.id) {
      throw new ApiError(403, "Você só pode alterar suas próprias aulas");
    }

    if (lesson.cohortId && d.level && d.level !== lesson.level)
      throw new ApiError(409, "O nível desta aula precisa corresponder ao nível da turma.");

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

    const changesTime =
      (d.scheduledAt !== undefined && new Date(d.scheduledAt).getTime() !== lesson.scheduledAt.getTime()) ||
      (d.duration !== undefined && d.duration !== lesson.duration);
    if (changesTime) {
      if (lesson.status !== "SCHEDULED") throw new ApiError(409, "Somente aulas agendadas podem mudar de horário");
      const slot = {
        id,
        scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : lesson.scheduledAt,
        duration: d.duration ?? lesson.duration,
      };
      if (slot.scheduledAt <= new Date()) throw new ApiError(400, "Escolha uma data futura");
      await assertTeacherSlot(tx, lesson.teacherId, slot);
      const students = await tx.lessonBooking.findMany({
        where: { lessonId: id, status: { not: "CANCELLED" } },
        select: { studentId: true },
      });
      for (const student of students) await assertStudentSlot(tx, student.studentId, slot);
    }

    // Transição p/ concluída (1ª vez) → base p/ XP de aula idempotente.
    completing = d.status === "COMPLETED" && lesson.status !== "COMPLETED";

    const up = await tx.lesson.update({ where: { id }, data });
    if (changesTime) {
      await tx.lessonBooking.updateMany({
        where: { lessonId: id, status: { not: "CANCELLED" } },
        data: { confirmation: "PENDING", reminderSentAt: null },
      });
    }
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

  await schedulingTransaction(async (tx) => {
    // Exercise.lessonId é Restrict (sem cascade) — desvincula antes de apagar, senão P2003.
    await tx.exercise.updateMany({ where: { lessonId: id }, data: { lessonId: null } });
    await tx.lessonBooking.deleteMany({ where: { lessonId: id } });
    await tx.lesson.delete({ where: { id } });
  });

  await audit({ userId: session.user.id, action: "DELETE_LESSON", entity: "Lesson", entityId: id });
  return NextResponse.json({ ok: true });
});
