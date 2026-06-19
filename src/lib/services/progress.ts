import { prisma } from "../prisma";
import { ApiError } from "../api-error";
import { issueCertificate } from "./certificate";
import { awardUnit } from "./gamification";
import { getOrderedUnits, getCompletedUnitIds, isUnitUnlocked, isCourseUnlocked } from "./unlock";

export interface CompleteUnitResult {
  unitId: string;
  courseId: string;
  progressPercent: number;
  courseCompleted: boolean;
  certificateId?: string;
}

/**
 * Marca uma unidade como concluída (idempotente) e recomputa o progresso do curso.
 *
 * Guard clauses:
 *  - unidade existe
 *  - curso desbloqueado (prerequisitos) → senão 403
 *  - unidade desbloqueada (sequencial) → senão 403
 *
 * Se 100% das unidades concluídas → emite certificado automaticamente.
 * Salva `lastAccess` (progresso em tempo real).
 */
export async function completeUnit(userId: string, userName: string, unitId: string): Promise<CompleteUnitResult> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { module: { include: { course: true } } },
  });
  if (!unit) throw new ApiError(404, "Unidade não encontrada");

  const course = unit.module.course;

  // Guard: prerequisitos do curso
  if (!(await isCourseUnlocked(userId, course.id))) {
    throw new ApiError(403, "Curso bloqueado: conclua os pré-requisitos primeiro");
  }

  const ordered = await getOrderedUnits(course.id);
  const completed = await getCompletedUnitIds(userId, course.id);

  // Guard: unlock sequencial
  if (!isUnitUnlocked(unitId, ordered, completed)) {
    throw new ApiError(403, "Conclua a unidade anterior antes desta");
  }

  // Guard: exercícios obrigatórios pendentes bloqueiam conclusão (regra de negócio)
  const requiredPending = await prisma.exercise.count({
    where: {
      unitId,
      isRequired: true,
      isActive: true,
      attempts: { none: { studentId: userId, passed: true } },
    },
  });
  if (requiredPending > 0) {
    throw new ApiError(403, "Conclua todos os exercícios obrigatórios antes de finalizar a unidade");
  }

  // Transição p/ concluída? (antes de gravar) — base p/ XP idempotente.
  const prior = await prisma.userUnitProgress.findUnique({
    where: { userId_unitId: { userId, unitId } },
    select: { completed: true },
  });
  const newlyCompleted = !prior?.completed;

  // Idempotente: upsert completed=true
  await prisma.userUnitProgress.upsert({
    where: { userId_unitId: { userId, unitId } },
    update: { completed: true, completedAt: new Date(), lastAccess: new Date() },
    create: {
      userId,
      unitId,
      courseId: course.id,
      completed: true,
      completedAt: new Date(),
    },
  });

  // Gamificação: XP de unidade só na 1ª conclusão. Best-effort.
  if (newlyCompleted) {
    try {
      await awardUnit(userId);
    } catch {
      // ignore — gamificação é secundária à conclusão
    }
  }

  // Recompute progresso
  completed.add(unitId);
  const total = ordered.length;
  const doneCount = ordered.filter((u) => completed.has(u.id)).length;
  const progressPercent = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  const courseCompleted = total > 0 && doneCount === total;

  let certificateId: string | undefined;
  if (courseCompleted) {
    const cert = await issueCertificate({
      userId,
      courseId: course.id,
      courseName: course.title,
      studentName: userName,
    });
    certificateId = cert.certificateId;
  }

  return { unitId, courseId: course.id, progressPercent, courseCompleted, certificateId };
}

/**
 * Registra acesso à unidade (lastAccess) sem marcar como concluída.
 * Real-time tracking de "último acesso".
 */
export async function touchUnitAccess(userId: string, unitId: string, courseId: string): Promise<void> {
  await prisma.userUnitProgress.upsert({
    where: { userId_unitId: { userId, unitId } },
    update: { lastAccess: new Date() },
    create: { userId, unitId, courseId, completed: false },
  });
}
