import { NextRequest, NextResponse } from "next/server";
import { ApiError, withErrorHandler } from "@/lib/api-error";
import { requireAuth, requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { CreateMaterialSchema } from "@/lib/schemas";
import { canAccessUnit } from "@/lib/services/unlock";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/units/[id]/materials — lista materiais (PDF) da unidade. */
export const GET = withErrorHandler(async (_req: NextRequest, ctx) => {
  const session = await requireAuth("courses");
  const { id: unitId } = await (ctx as Ctx).params;

  // Aluno só vê materiais de unidade desbloqueada (gate).
  if (session.user.role === "STUDENT" && !(await canAccessUnit(session.user.id, unitId))) {
    throw new ApiError(403, "Unidade bloqueada");
  }

  const materials = await prisma.unitMaterial.findMany({
    where: { unitId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(materials);
});

/** POST /api/units/[id]/materials — admin adiciona material (PDF) à unidade. */
export const POST = withErrorHandler(async (req: NextRequest, ctx) => {
  const session = await requireAdmin("courses");
  const { id: unitId } = await (ctx as Ctx).params;

  const parsed = CreateMaterialSchema.omit({ unitId: true }).safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const { fileName, fileUrl, fileType } = parsed.data;

  const material = await prisma.unitMaterial.create({
    data: { unitId, fileName, fileUrl, fileType },
  });

  await audit({ userId: session.user.id, action: "CREATE_UNIT", entity: "UnitMaterial", entityId: material.id });
  return NextResponse.json(material, { status: 201 });
});

/** DELETE /api/units/[id]/materials?materialId=... — admin remove material. */
export const DELETE = withErrorHandler(async (req: NextRequest, ctx) => {
  await requireAdmin("courses");
  await (ctx as Ctx).params;
  const materialId = req.nextUrl.searchParams.get("materialId");
  if (!materialId) return NextResponse.json({ error: "materialId obrigatório" }, { status: 400 });

  await prisma.unitMaterial.delete({ where: { id: materialId } });
  return NextResponse.json({ ok: true });
});
