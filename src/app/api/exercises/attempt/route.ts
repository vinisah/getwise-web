import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireRole } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { ExerciseAttemptSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";
import { gradeAnswer } from "@/lib/services/grading";
import { recomputeUnitCompletion } from "@/lib/services/unit-completion";
import { awardExercise } from "@/lib/services/gamification";
import { canAccessUnit } from "@/lib/services/unlock";
import { acquireLock, releaseLock, submissionKey } from "@/lib/submission-lock";

export const POST = withErrorHandler(async (req: NextRequest) => {
  // Só ALUNO real submete (admin/professor — inclusive admin em "ver como" — não escreve dado de aluno).
  const session = await requireRole("STUDENT");

  const parsed = ExerciseAttemptSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const { exerciseId, answer, timeSpent } = parsed.data;

  // Edge case: impedir submissões simultâneas do mesmo exercício
  const lockKey = submissionKey(session.user.id, exerciseId);
  if (!(await acquireLock(lockKey))) {
    return NextResponse.json({ error: "Submissão em processamento. Aguarde." }, { status: 409 });
  }

  try {
    const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });
    if (!exercise) return NextResponse.json({ error: "Exercício não encontrado" }, { status: 404 });

    // Gate de conteúdo: aluno só submete em exercício de unidade desbloqueada.
    // Sem isso, qualquer aluno enumera ids (GET /api/exercises) e colhe gabarito de unidades bloqueadas.
    if (session.user.role === "STUDENT" && exercise.unitId) {
      const ok = await canAccessUnit(session.user.id, exercise.unitId);
      if (!ok) return NextResponse.json({ error: "Unidade bloqueada" }, { status: 403 });
    }

    const result = gradeAnswer(
      { type: exercise.type, correctAnswer: exercise.correctAnswer, points: exercise.points },
      answer
    );

    // Tipos de voz/áudio ainda não suportados server-side
    if (result.stub) {
      return NextResponse.json(
        { error: "Este tipo de exercício estará disponível em breve.", stub: true },
        { status: 501 }
      );
    }

    const score = result.passed ? exercise.points : 0;

    const attempt = await prisma.exerciseAttempt.create({
      data: {
        exerciseId,
        studentId: session.user.id,
        answer: answer as import("@prisma/client").Prisma.InputJsonValue,
        isCorrect: result.isCorrect,
        score,
        scorePercent: result.scorePercent,
        passed: result.passed,
        timeSpent: timeSpent ?? null,
      },
    });

    await audit({
      userId: session.user.id,
      action: "ATTEMPT_EXERCISE",
      entity: "ExerciseAttempt",
      entityId: attempt.id,
    });

    // best_score_wins: melhor scorePercent entre todas tentativas
    const best = await prisma.exerciseAttempt.aggregate({
      where: { studentId: session.user.id, exerciseId },
      _max: { scorePercent: true },
    });
    const bestScorePercent = best._max.scorePercent ?? result.scorePercent;

    // Gamificação: XP+skill na 1ª aprovação do exercício; streak/rank sempre recomputam.
    // Best-effort — falha aqui NÃO derruba a submissão.
    try {
      await awardExercise(session.user.id, exerciseId, exercise.type, exercise.points, attempt.id, result.passed);
    } catch {
      // ignore — gamificação é secundária ao registro da tentativa
    }

    // Se exercício pertence a uma unidade e foi aprovado, recomputa conclusão
    let unitCompleted = false;
    if (exercise.unitId && result.passed) {
      const rc = await recomputeUnitCompletion(session.user.id, session.user.name, exercise.unitId);
      unitCompleted = rc.completed;
    }

    // Revela gabarito quando: staff; OU aluno acertou (passed); OU exercício de prática pura
    // (sem unitId — não conta em progressão, feedback didático ok). Exercício de UNIDADE só
    // revela ao aprovar, senão aluno burlaria a conclusão da unidade colhendo a resposta.
    const reveal = session.user.role !== "STUDENT" || result.passed || !exercise.unitId;

    return NextResponse.json({
      isCorrect: result.isCorrect,
      scorePercent: result.scorePercent,
      passed: result.passed,
      bestScorePercent,
      ...(reveal ? { correctAnswer: exercise.correctAnswer, explanation: exercise.explanation } : {}),
      unitCompleted,
    });
  } finally {
    await releaseLock(lockKey);
  }
});
