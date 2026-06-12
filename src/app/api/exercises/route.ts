import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { ApiError } from "@/lib/api-error";
import { CreateExerciseSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAuth();

  const { searchParams } = new URL(req.url);
  const level = searchParams.get("level");
  const type = searchParams.get("type");

  const profile = session.user.role === "STUDENT"
    ? await prisma.studentProfile.findUnique({ where: { userId: session.user.id } })
    : null;

  const exercises = await prisma.exercise.findMany({
    where: {
      isActive: true,
      ...(level ? { level: level as any } : profile ? { level: profile.level } : {}),
      ...(type ? { type: type as any } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(exercises);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAuth();

  if (session.user.role === "STUDENT") {
    throw new ApiError(403, "Não autorizado");
  }

  const parsed = CreateExerciseSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }

  const { title, description, type, level, content, correctAnswer, explanation, points, timeLimit, lessonId, unitId, isRequired, order } = parsed.data;

  const exercise = await prisma.exercise.create({
    data: {
      title,
      description: description || null,
      type,
      level,
      content: content as import("@prisma/client").Prisma.InputJsonValue,
      correctAnswer: correctAnswer !== undefined ? (correctAnswer as import("@prisma/client").Prisma.InputJsonValue) : undefined,
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
