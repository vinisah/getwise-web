import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/materials/[id]/download — registra download (rastreio com datetime)
 * e retorna a URL do arquivo. Edge: re-download atualiza o timestamp (upsert).
 */
export const POST = withErrorHandler(async (_req: NextRequest, ctx) => {
  const session = await requireAuth();
  const { id: materialId } = await (ctx as Ctx).params;

  const material = await prisma.unitMaterial.findUnique({ where: { id: materialId } });
  if (!material) return NextResponse.json({ error: "Material não encontrado" }, { status: 404 });

  await prisma.materialDownload.upsert({
    where: { userId_materialId: { userId: session.user.id, materialId } },
    update: { downloadedAt: new Date() },
    create: { userId: session.user.id, materialId },
  });

  return NextResponse.json({ ok: true, fileUrl: material.fileUrl, fileName: material.fileName });
});
