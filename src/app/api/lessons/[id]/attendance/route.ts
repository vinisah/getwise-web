import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandler, ApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

const Schema = z.object({
  entries: z
    .array(
      z.object({
        studentId: z.string().min(1),
        attendance: z.boolean().nullable(),
        rating: z.number().int().min(1).max(5).nullable().optional(),
        feedback: z.string().max(2000).nullable().optional(),
      })
    )
    .min(1)
    .max(100),
});

/**
 * POST /api/lessons/[id]/attendance — marca presença/avaliação por aluno.
 * Admin marca qualquer aula; professor só as próprias. IDOR-safe: updateMany por
 * (lessonId, studentId) só toca bookings reais desta aula (id estranho atualiza 0 linhas).
 */
export const POST = withErrorHandler(async (req: NextRequest, ctx) => {
  const session = await requireAuth();
  const { id } = await (ctx as Ctx).params;

  if (session.user.role !== "ADMIN" && session.user.role !== "TEACHER") {
    throw new ApiError(403, "Não autorizado");
  }

  const lesson = await prisma.lesson.findUnique({ where: { id }, select: { id: true, teacherId: true } });
  if (!lesson) return NextResponse.json({ error: "Aula não encontrada" }, { status: 404 });
  if (session.user.role === "TEACHER" && lesson.teacherId !== session.user.id) {
    throw new ApiError(403, "Você só marca presença nas suas próprias aulas");
  }

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  await prisma.$transaction(
    parsed.data.entries.map((e) =>
      prisma.lessonBooking.updateMany({
        where: { lessonId: id, studentId: e.studentId },
        data: {
          attendance: e.attendance,
          ...(e.rating !== undefined ? { rating: e.rating } : {}),
          ...(e.feedback !== undefined ? { feedback: e.feedback || null } : {}),
        },
      })
    )
  );

  await audit({
    userId: session.user.id,
    action: "MARK_ATTENDANCE",
    entity: "Lesson",
    entityId: id,
    payload: { count: parsed.data.entries.length },
  });
  return NextResponse.json({ ok: true });
});
