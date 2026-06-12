import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { UpdateModuleSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = withErrorHandler(async (req: NextRequest, ctx) => {
  const session = await requireAdmin();
  const { id } = await (ctx as Ctx).params;

  const parsed = UpdateModuleSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
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
  const session = await requireAdmin();
  const { id } = await (ctx as Ctx).params;

  await prisma.module.delete({ where: { id } });

  await audit({ userId: session.user.id, action: "DELETE_MODULE", entity: "Module", entityId: id });
  return NextResponse.json({ ok: true });
});
