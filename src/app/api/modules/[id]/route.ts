import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ApiError, zodMessage } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { UpdateModuleSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = withErrorHandler(async (req: NextRequest, ctx) => {
  const session = await requireAdmin("courses");
  const { id } = await (ctx as Ctx).params;

  const parsed = UpdateModuleSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
  }

  const data = parsed.data;
  const mod = await prisma.module.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.order !== undefined ? { order: data.order } : {}),
    },
  });

  await audit({ userId: session.user.id, action: "UPDATE_MODULE", entity: "Module", entityId: mod.id });
  return NextResponse.json(mod);
});

export const DELETE = withErrorHandler(async (_req: NextRequest, ctx) => {
  const session = await requireAdmin("courses");
  const { id } = await (ctx as Ctx).params;

  // Protege histórico do aluno: excluir o módulo cascateia units→exercises→tentativas/progresso.
  // Se já houver progresso/tentativa nas unidades, bloqueia (arquive o curso em vez de excluir).
  const units = await prisma.unit.findMany({ where: { moduleId: id }, select: { id: true } });
  const unitIds = units.map((u) => u.id);
  if (unitIds.length) {
    const [progress, attempts] = await Promise.all([
      prisma.userUnitProgress.count({ where: { unitId: { in: unitIds } } }),
      prisma.exerciseAttempt.count({ where: { exercise: { unitId: { in: unitIds } } } }),
    ]);
    if (progress + attempts > 0) {
      throw new ApiError(409, "Este módulo tem histórico de alunos. Arquive o curso em vez de excluir o módulo.");
    }
  }

  await prisma.module.delete({ where: { id } });

  await audit({ userId: session.user.id, action: "DELETE_MODULE", entity: "Module", entityId: id });
  return NextResponse.json({ ok: true });
});
