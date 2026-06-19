import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandler } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { ApiError } from "@/lib/api-error";
import { getEffectiveUser } from "@/lib/effective-user";
import { CreateExerciseSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";

const LevelEnum = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]);
const TypeEnum = z.enum([
  "MULTIPLE_CHOICE",
  "FILL_IN_BLANK",
  "TRUE_FALSE",
  "WRITING",
  "LISTENING",
  "WORD_MATCH",
  "TRANSLATION",
  "SENTENCE_ORDER",
  "DICTATION",
  "PRONUNCIATION",
]);

export const GET = withErrorHandler(async (req: NextRequest) => {
  // Identidade efetiva: aluno real OU admin "vendo como" aluno (read-only).
  const eff = await getEffectiveUser();
  if (!eff) throw new ApiError(401, "Não autenticado");

  const { searchParams } = new URL(req.url);
  const rawLevel = searchParams.get("level");
  const rawType = searchParams.get("type");

  // Valida enums da query → 400 (em vez de repassar lixo ao Prisma = 500).
  let level: z.infer<typeof LevelEnum> | undefined;
  if (rawLevel) {
    const r = LevelEnum.safeParse(rawLevel);
    if (!r.success) return NextResponse.json({ error: "Nível inválido" }, { status: 400 });
    level = r.data;
  }
  let type: z.infer<typeof TypeEnum> | undefined;
  if (rawType) {
    const r = TypeEnum.safeParse(rawType);
    if (!r.success) return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    type = r.data;
  }

  const profile = eff.role === "STUDENT" ? await prisma.studentProfile.findUnique({ where: { userId: eff.id } }) : null;

  const exercises = await prisma.exercise.findMany({
    where: {
      isActive: true,
      ...(level ? { level } : profile ? { level: profile.level } : {}),
      ...(type ? { type } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  // Aluno NÃO recebe gabarito na listagem — senão coleta correctAnswer de exercícios de
  // unidade (que contam na progressão) sem resolver. O gabarito vem da resposta do attempt,
  // gated por aprovação. Espelha a omissão de GET /api/exercises/[id].
  if (eff.role === "STUDENT") {
    const safe = exercises.map((ex) => {
      const { correctAnswer: _c, explanation: _e, ...rest } = ex;
      void _c;
      void _e;
      return rest;
    });
    return NextResponse.json(safe);
  }

  return NextResponse.json(exercises);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAuth();

  if (session.user.role === "STUDENT") {
    throw new ApiError(403, "Não autorizado");
  }

  const parsed = CreateExerciseSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const {
    title,
    description,
    type,
    level,
    content,
    correctAnswer,
    explanation,
    points,
    timeLimit,
    lessonId,
    unitId,
    isRequired,
    order,
  } = parsed.data;

  const exercise = await prisma.exercise.create({
    data: {
      title,
      description: description || null,
      type,
      level,
      content: content as import("@prisma/client").Prisma.InputJsonValue,
      correctAnswer:
        correctAnswer !== undefined ? (correctAnswer as import("@prisma/client").Prisma.InputJsonValue) : undefined,
      explanation: explanation || null,
      points: points ?? 10,
      timeLimit: timeLimit ?? null,
      lessonId: lessonId || null,
      unitId: unitId || null,
      isRequired: isRequired ?? true,
      order: order ?? 0,
    },
  });

  return NextResponse.json(exercise, { status: 201 });
});
