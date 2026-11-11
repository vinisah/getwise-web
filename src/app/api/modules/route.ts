import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { CreateModuleSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAdmin("courses");

  const parsed = CreateModuleSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const { courseId, title, description, order } = parsed.data;
  const mod = await prisma.module.create({
    data: { courseId, title, description: description || null, order },
  });

  await audit({ userId: session.user.id, action: "CREATE_MODULE", entity: "Module", entityId: mod.id });
  return NextResponse.json(mod, { status: 201 });
});
