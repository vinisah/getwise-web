import { prisma } from "../prisma";
import type { Prisma } from "@prisma/client";

/**
 * Gamificação viva: XP / streak / rank / skills no StudentProfile.
 * Campos já existem no schema — esta camada é só a LÓGICA que atualiza.
 *
 * Idempotência (não dar XP 2x pelo mesmo fato):
 *  - exercício: XP só na 1ª APROVAÇÃO de cada exercício (priorPassed === 0);
 *  - unidade: XP só na 1ª conclusão (chamador detecta a transição);
 *  - aula: XP só na transição p/ COMPLETED (chamador detecta).
 * streak/rank são DERIVADOS (recomputados da fonte de verdade) → sempre seguros de re-rodar.
 */

export const XP = { EXERCISE_BASE: 10, UNIT: 50, LESSON: 30 } as const;
const SKILL_STEP = 4; // pontos por exercício novo aprovado (cap 100)

const SKILLS = ["listening", "speaking", "reading", "writing"] as const;
type Skill = (typeof SKILLS)[number];

/** Tipo de exercício → habilidade exercitada. */
const SKILL_BY_TYPE: Record<string, Skill> = {
  LISTENING: "listening",
  DICTATION: "listening",
  PRONUNCIATION: "speaking",
  WRITING: "writing",
  TRANSLATION: "writing",
  MULTIPLE_CHOICE: "reading",
  FILL_IN_BLANK: "reading",
  TRUE_FALSE: "reading",
  WORD_MATCH: "reading",
  SENTENCE_ORDER: "reading",
};

/** Faixas de rank por XP acumulado (rótulo string, sem enum no schema). */
export function rankForXp(xp: number): string {
  if (xp >= 15000) return "Platina";
  if (xp >= 5000) return "Ouro";
  if (xp >= 1000) return "Prata";
  return "Bronze";
}

/** Normaliza o JSON de skills (null/lixo → base 0; clampa 0-100). */
function normalizeSkills(raw: unknown): Record<Skill, number> {
  const base: Record<Skill, number> = { listening: 0, speaking: 0, reading: 0, writing: 0 };
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const k of SKILLS) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === "number" && Number.isFinite(v)) base[k] = Math.max(0, Math.min(100, v));
    }
  }
  return base;
}

/** Dia no fuso Brasília como "YYYY-MM-DD" (bucket de streak). */
function brasiliaDay(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * Streak = dias consecutivos com atividade (tentativas) terminando hoje, fuso Brasília.
 * Derivado de ExerciseAttempt → idempotente (não acumula sozinho ao re-rodar).
 */
async function computeStreak(studentId: string): Promise<number> {
  // Janela de 365 dias: cobre streaks de até ~1 ano (cap documentado; school real não passa disso).
  const since = new Date(Date.now() - 365 * 864e5);
  const attempts = await prisma.exerciseAttempt.findMany({
    where: { studentId, createdAt: { gte: since } },
    select: { createdAt: true },
  });
  const days = new Set(attempts.map((a) => brasiliaDay(a.createdAt)));
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    if (days.has(brasiliaDay(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return streak;
}

/**
 * Aplica XP via increment ATÔMICO (evita lost-update entre awards concorrentes — xp é
 * acumulador real). `streak` só é gravado quando o chamador passa (caminho de exercício);
 * unidade/aula NÃO mexem no streak (senão zerariam num dia sem tentativa). rank é derivado
 * do xp já incrementado. Sem perfil → no-op (não quebra a operação principal).
 */
async function applyXp(studentId: string, xp: number, opts: { skill?: Skill; streak?: number } = {}): Promise<void> {
  const profile = await prisma.studentProfile.findUnique({ where: { userId: studentId }, select: { skills: true } });
  if (!profile) return;

  const data: Prisma.StudentProfileUpdateInput = { xp: { increment: xp } };
  if (opts.streak !== undefined) data.streak = opts.streak;
  if (opts.skill) {
    const skills = normalizeSkills(profile.skills);
    skills[opts.skill] = Math.min(100, skills[opts.skill] + SKILL_STEP);
    data.skills = skills as Prisma.InputJsonValue;
  }

  const updated = await prisma.studentProfile.update({ where: { userId: studentId }, data, select: { xp: true } });
  await prisma.studentProfile.update({ where: { userId: studentId }, data: { rank: rankForXp(updated.xp) } });
}

/**
 * Tentativa de exercício: XP + skill só na 1ª APROVAÇÃO daquele exercício;
 * streak/rank recomputam em qualquer tentativa (praticou hoje).
 */
export async function awardExercise(
  studentId: string,
  exerciseId: string,
  exerciseType: string,
  points: number,
  attemptId: string,
  passed: boolean
): Promise<void> {
  // streak recomputado SÓ aqui (atividade do dia = tentativa, já criada antes deste award).
  const streak = await computeStreak(studentId);
  let xp = 0;
  let skill: Skill | undefined;
  if (passed) {
    const priorPassed = await prisma.exerciseAttempt.count({
      where: { studentId, exerciseId, passed: true, id: { not: attemptId } },
    });
    if (priorPassed === 0) {
      xp = points > 0 ? points : XP.EXERCISE_BASE;
      skill = SKILL_BY_TYPE[exerciseType];
    }
  }
  await applyXp(studentId, xp, { skill, streak });
}

/** Conclusão de unidade (1ª vez — chamador detecta a transição). Não mexe no streak. */
export async function awardUnit(studentId: string): Promise<void> {
  await applyXp(studentId, XP.UNIT);
}

/** Conclusão de aula (transição p/ COMPLETED — chamador detecta). Não mexe no streak. */
export async function awardLesson(studentId: string): Promise<void> {
  await applyXp(studentId, XP.LESSON);
}
