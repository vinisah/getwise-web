import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireEffectiveStudent } from "@/lib/effective-user";
import { audit } from "@/lib/audit";
import { CompleteUnitSchema } from "@/lib/schemas";
import { completeUnit } from "@/lib/services/progress";

/**
 * POST /api/progress — marca unidade como concluída (real-time save).
 * Opera sobre o ALUNO EFETIVO (aluno real OU admin "vendo como" aluno) — necessário pro
 * fluxo funcionar com login passwordless. Unlock/prereq/certificado na camada de serviço.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const eff = await requireEffectiveStudent();

  const parsed = CompleteUnitSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const result = await completeUnit(eff.id, eff.name, parsed.data.unitId);

  await audit({
    userId: eff.id,
    action: "COMPLETE_UNIT",
    entity: "Unit",
    entityId: parsed.data.unitId,
    payload: { progressPercent: result.progressPercent, courseCompleted: result.courseCompleted },
  });

  if (result.certificateId) {
    await audit({
      userId: eff.id,
      action: "ISSUE_CERTIFICATE",
      entity: "Certificate",
      entityId: result.certificateId,
      payload: { courseId: result.courseId },
    });
  }

  return NextResponse.json(result);
});
