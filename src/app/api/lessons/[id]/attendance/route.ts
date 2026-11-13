import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandler, ApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { schedulingTransaction } from "@/lib/scheduling/service";

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
  const session = await requireAuth("lessons");
  const { id } = await (ctx as Ctx).params;

  if (session.user.role !== "ADMIN" && session.user.role !== "TEACHER") {
    throw new ApiError(403, "Não autorizado");
  }

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Dados inválidos");
  await schedulingTransaction(async (tx) => {
    const lesson = await tx.lesson.findUnique({ where: { id }, select: { id: true, teacherId: true, status: true } });
    if (!lesson) throw new ApiError(404, "Aula não encontrada");
    if (session.user.role === "TEACHER" && lesson.teacherId !== session.user.id) {
      throw new ApiError(403, "Você só marca presença nas suas próprias aulas");
    }
    if (lesson.status === "CANCELLED") throw new ApiError(409, "Aula cancelada: atualize a agenda");

    const results = await Promise.all(
      parsed.data.entries.map((e) =>
        tx.lessonBooking.updateMany({
          where: { lessonId: id, studentId: e.studentId, status: { not: "CANCELLED" } },
          data: {
            attendance: e.attendance,
            ...(e.rating !== undefined ? { rating: e.rating } : {}),
            ...(e.feedback !== undefined ? { feedback: e.feedback || null } : {}),
          },
        })
      )
    );
    if (results.some((result) => result.count !== 1)) {
      throw new ApiError(409, "A lista de alunos mudou. Atualize a agenda antes de salvar a presença.");
    }
  });

  await audit({
    userId: session.user.id,
    action: "MARK_ATTENDANCE",
    entity: "Lesson",
    entityId: id,
    payload: { count: parsed.data.entries.length },
  });
  return NextResponse.json({ ok: true });
});
