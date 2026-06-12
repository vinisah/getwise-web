import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { CompleteUnitSchema } from "@/lib/schemas";
import { completeUnit } from "@/lib/services/progress";

/**
 * POST /api/progress — marca unidade como concluída (real-time save).
 * Lógica de unlock/prereq/certificado delegada à camada de serviço.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAuth();

  const parsed = CompleteUnitSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const result = await completeUnit(session.user.id, session.user.name, parsed.data.unitId);

  await audit({
    userId: session.user.id,
    action: "COMPLETE_UNIT",
    entity: "Unit",
    entityId: parsed.data.unitId,
    payload: { progressPercent: result.progressPercent, courseCompleted: result.courseCompleted },
  });

  if (result.certificateId) {
    await audit({
      userId: session.user.id,
      action: "ISSUE_CERTIFICATE",
      entity: "Certificate",
      entityId: result.certificateId,
      payload: { courseId: result.courseId },
    });
  }

  return NextResponse.json(result);
});
