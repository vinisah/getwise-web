import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-auth";
import { ApiError, withErrorHandler } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
const getId = async (ctx: unknown) => (await (ctx as { params: Promise<{ id: string }> }).params).id;
export const GET = withErrorHandler(async (_req, ctx) => {
  await requireAdmin("courses");
  const course = await prisma.course.findUnique({ where: { id: await getId(ctx) }, include: { schoolUnits: true } });
  if (!course) throw new ApiError(404, "Curso não encontrado.");
  const units = await prisma.schoolUnit.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 200,
  });
  return NextResponse.json({
    units,
    selected: course.schoolUnits.map((u) => u.schoolUnitId),
    version: course.updatedAt.toISOString(),
  });
});
export const PUT = withErrorHandler(async (req, ctx) => {
  await requireAdmin("courses");
  const parsed = z
    .object({ unitIds: z.array(z.string().min(1)).max(200), version: z.iso.datetime() })
    .safeParse(await req.json());
  if (!parsed.success) throw new ApiError(400, "Confira as unidades selecionadas.");
  const id = await getId(ctx);
  const version = new Date();
  await prisma.$transaction(async (tx) => {
    const updated = await tx.course.updateMany({
      where: { id, updatedAt: new Date(parsed.data.version) },
      data: { updatedAt: version },
    });
    if (!updated.count) throw new ApiError(409, "O curso mudou. Recarregue os vínculos antes de salvar.");
    const old = await tx.schoolUnitCourse.findMany({ where: { courseId: id } });
    await tx.schoolUnitCourse.deleteMany({ where: { courseId: id } });
    await tx.schoolUnitCourse.createMany({
      data: [...new Set(parsed.data.unitIds)].map((schoolUnitId) => ({ schoolUnitId, courseId: id })),
    });
    await tx.schoolUnit.updateMany({
      where: { id: { in: [...old.map((o) => o.schoolUnitId), ...parsed.data.unitIds] } },
      data: { version: { increment: 1 } },
    });
  });
  return NextResponse.json({ version: version.toISOString() });
});
