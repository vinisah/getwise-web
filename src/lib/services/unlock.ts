import { prisma } from "../prisma";

/**
 * Unidade ordenada globalmente dentro do curso (módulo.order → unidade.order).
 */
export interface OrderedUnit {
  id: string;
  moduleOrder: number;
  unitOrder: number;
}

/**
 * Retorna unidades de um curso em ordem global (módulo, depois unidade).
 */
export async function getOrderedUnits(courseId: string): Promise<OrderedUnit[]> {
  const modules = await prisma.module.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
    include: { units: { orderBy: { order: "asc" } } },
  });

  const ordered: OrderedUnit[] = [];
  for (const m of modules) {
    for (const u of m.units) {
      ordered.push({ id: u.id, moduleOrder: m.order, unitOrder: u.order });
    }
  }
  return ordered;
}

/**
 * Conjunto de IDs de unidades concluídas pelo usuário em um curso.
 */
export async function getCompletedUnitIds(userId: string, courseId: string): Promise<Set<string>> {
  const rows = await prisma.userUnitProgress.findMany({
    where: { userId, courseId, completed: true },
    select: { unitId: true },
  });
  return new Set(rows.map((r) => r.unitId));
}

/**
 * Regra: "aluno só pode acessar a unidade seguinte após concluir a anterior."
 * A primeira unidade está sempre desbloqueada. As demais exigem a anterior concluída.
 */
export function isUnitUnlocked(
  unitId: string,
  ordered: OrderedUnit[],
  completed: Set<string>
): boolean {
  const idx = ordered.findIndex((u) => u.id === unitId);
  if (idx <= 0) return true; // primeira (ou não encontrada → permissiva no topo)
  const prev = ordered[idx - 1];
  return completed.has(prev.id);
}

/**
 * Regra de prerequisito: curso só desbloqueia se TODOS os cursos exigidos
 * tiverem certificado emitido (100% concluído).
 */
export async function isCourseUnlocked(userId: string, courseId: string): Promise<boolean> {
  const prereqs = await prisma.coursePrerequisite.findMany({
    where: { courseId },
    select: { requiredCourseId: true },
  });
  if (prereqs.length === 0) return true;

  const certs = await prisma.certificate.findMany({
    where: { userId, courseId: { in: prereqs.map((p) => p.requiredCourseId) } },
    select: { courseId: true },
  });
  const done = new Set(certs.map((c) => c.courseId));
  return prereqs.every((p) => done.has(p.requiredCourseId));
}
