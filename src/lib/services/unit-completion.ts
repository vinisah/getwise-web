import { prisma } from "../prisma";
import { completeUnit } from "./progress";

export interface RequiredStatus {
  requiredTotal: number;
  requiredPassed: number;
  allPassed: boolean;
}

/**
 * Verifica se todos os exercícios obrigatórios de uma unidade foram aprovados
 * (melhor tentativa do usuário com passed=true).
 */
export async function checkRequiredExercises(userId: string, unitId: string): Promise<RequiredStatus> {
  const required = await prisma.exercise.findMany({
    where: { unitId, isRequired: true, isActive: true },
    select: { id: true },
  });

  if (required.length === 0) {
    return { requiredTotal: 0, requiredPassed: 0, allPassed: true };
  }

  const passedAttempts = await prisma.exerciseAttempt.findMany({
    where: { studentId: userId, exerciseId: { in: required.map((e) => e.id) }, passed: true },
    select: { exerciseId: true },
    distinct: ["exerciseId"],
  });

  const passedSet = new Set(passedAttempts.map((a) => a.exerciseId));
  const requiredPassed = required.filter((e) => passedSet.has(e.id)).length;

  return {
    requiredTotal: required.length,
    requiredPassed,
    allPassed: requiredPassed === required.length,
  };
}

/**
 * Verifica regra de vídeo: assistido >= 90%.
 */
export async function isVideoWatched(userId: string, unitId: string): Promise<boolean> {
  const vp = await prisma.unitVideoProgress.findUnique({
    where: { userId_unitId: { userId, unitId } },
  });
  return (vp?.watchedPercent ?? 0) >= 90;
}

/**
 * Recomputa a conclusão de uma unidade após uma ação (exercício aprovado ou vídeo assistido).
 * Conclui automaticamente quando:
 *  - todos os exercícios obrigatórios aprovados, E
 *  - se a unidade é VIDEO/MIXED com vídeo, assistido >= 90%.
 *
 * Dispara `completeUnit` (que recomputa progresso do curso + emite certificado a 100%).
 * Idempotente.
 */
export async function recomputeUnitCompletion(
  userId: string,
  userName: string,
  unitId: string
): Promise<{ completed: boolean }> {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) return { completed: false };

  const { allPassed } = await checkRequiredExercises(userId, unitId);
  if (!allPassed) return { completed: false };

  // Regra de vídeo (só aplica se a unidade tem vídeo)
  const needsVideo = (unit.type === "VIDEO" || unit.type === "MIXED") && !!unit.videoUrl;
  if (needsVideo && !(await isVideoWatched(userId, unitId))) {
    return { completed: false };
  }

  // Tudo cumprido → conclui (idempotente; completeUnit ignora se já concluída)
  await completeUnit(userId, userName, unitId);
  return { completed: true };
}
