import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandler } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { ApiError } from "@/lib/api-error";
import { audit } from "@/lib/audit";
import { CreateLessonSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const LessonStatusEnum = z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);

export const GET = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAuth();

  const { searchParams } = new URL(req.url);
  const rawStatus = searchParams.get("status");
  let status: z.infer<typeof LessonStatusEnum> | undefined;
  if (rawStatus) {
    const r = LessonStatusEnum.safeParse(rawStatus);
    if (!r.success) return NextResponse.json({ error: "Status inválido" }, { status: 400 });
    status = r.data;
  }

  let where: Prisma.LessonWhereInput = {};

  if (session.user.role === "STUDENT") {
    where = {
      bookings: { some: { studentId: session.user.id } },
      ...(status ? { status } : {}),
    };
  } else if (session.user.role === "TEACHER") {
    where = {
      teacherId: session.user.id,
      ...(status ? { status } : {}),
    };
  } else {
    where = status ? { status } : {};
  }

  const lessons = await prisma.lesson.findMany({
    where,
    include: {
      teacher: true,
      bookings: { include: { student: true } },
      materials: true,
      exercises: true,
    },
    orderBy: { scheduledAt: "asc" },
  });

  return NextResponse.json(lessons);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAuth();

  if (session.user.role !== "ADMIN" && session.user.role !== "TEACHER") {
    throw new ApiError(403, "Não autorizado");
  }

  const parsed = CreateLessonSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }

  const { teacherId, title, description, scheduledAt, duration, meetingUrl, level, maxStudents, studentIds } = parsed.data;

  // TEACHER só cria aula em seu próprio nome; ADMIN pode designar outro professor.
  const finalTeacherId = session.user.role === "ADMIN" ? (teacherId ?? session.user.id) : session.user.id;

  // Valida que todos os studentIds são alunos existentes (evita IDOR/lixo).
  if (studentIds?.length) {
    const validCount = await prisma.user.count({ where: { id: { in: studentIds }, role: "STUDENT" } });
    if (validCount !== studentIds.length) {
      throw new ApiError(400, "Um ou mais alunos são inválidos");
    }
  }

  const lesson = await prisma.lesson.create({
    data: {
      teacherId: finalTeacherId,
      title,
      description: description || null,
      scheduledAt: new Date(scheduledAt),
      duration: duration ?? 50,
      meetingUrl: meetingUrl || null,
      level,
      maxStudents: maxStudents ?? 1,
      bookings: studentIds?.length
        ? {
            create: (studentIds as string[]).map((sid) => ({ studentId: sid })),
          }
        : undefined,
    },
    include: { teacher: true, bookings: { include: { student: true } } },
  });

  await audit({ userId: session.user.id, action: "CREATE_LESSON", entity: "Lesson", entityId: lesson.id });

  return NextResponse.json(lesson, { status: 201 });
});
