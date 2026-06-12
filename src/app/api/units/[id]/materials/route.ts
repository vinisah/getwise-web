import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAuth, requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/units/[id]/materials — lista materiais (PDF) da unidade. */
export const GET = withErrorHandler(async (_req: NextRequest, ctx) => {
  await requireAuth();
  const { id: unitId } = await (ctx as Ctx).params;

  const materials = await prisma.unitMaterial.findMany({
    where: { unitId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(materials);
});

/** POST /api/units/[id]/materials — admin adiciona material (PDF) à unidade. */
export const POST = withErrorHandler(async (req: NextRequest, ctx) => {
  const session = await requireAdmin();
  const { id: unitId } = await (ctx as Ctx).params;

  const body = await req.json();
  const fileName = String(body.fileName ?? "").trim();
  const fileUrl = String(body.fileUrl ?? "").trim();
  if (!fileName || !fileUrl) {
    return NextResponse.json({ error: "Nome e URL do arquivo são obrigatórios" }, { status: 400 });
  }

  const material = await prisma.unitMaterial.create({
    data: { unitId, fileName, fileUrl, fileType: String(body.fileType ?? "pdf") },
  });

  await audit({ userId: session.user.id, action: "CREATE_UNIT", entity: "UnitMaterial", entityId: material.id });
  return NextResponse.json(material, { status: 201 });
});

/** DELETE /api/units/[id]/materials?materialId=... — admin remove material. */
export const DELETE = withErrorHandler(async (req: NextRequest, ctx) => {
  await requireAdmin();
  await (ctx as Ctx).params;
  const materialId = req.nextUrl.searchParams.get("materialId");
  if (!materialId) return NextResponse.json({ error: "materialId obrigatório" }, { status: 400 });

  await prisma.unitMaterial.delete({ where: { id: materialId } });
  return NextResponse.json({ ok: true });
});
