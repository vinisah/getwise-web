import { NextResponse } from "next/server";
import { withErrorHandler, ApiError } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { SchoolUnitSchema } from "@/lib/pre-enrollment/schema";
export const PUT = withErrorHandler(async (req, ctx) => {
  await requireAdmin("school-units");
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  const raw = await req.json();
  const parsed = SchoolUnitSchema.safeParse(raw);
  if (!parsed.success)
    return NextResponse.json(
      {
        error: parsed.error.issues[0].message,
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 400 }
    );
  if (!Number.isInteger(raw.version)) throw new ApiError(400, "Versão ausente.");
  const { courseIds, ...data } = parsed.data;
  await prisma.$transaction(async (tx) => {
    const changed = await tx.schoolUnit.updateMany({
      where: { id, version: raw.version },
      data: { ...data, version: { increment: 1 } },
    });
    if (!changed.count) throw new ApiError(409, "Esta unidade mudou. Recarregue antes de salvar.");
    const old = await tx.schoolUnitCourse.findMany({ where: { schoolUnitId: id } });
    await tx.course.updateMany({
      where: { id: { in: [...old.map((o) => o.courseId), ...courseIds] } },
      data: { updatedAt: new Date() },
    });
    await tx.schoolUnitCourse.deleteMany({ where: { schoolUnitId: id } });
    await tx.schoolUnitCourse.createMany({
      data: [...new Set(courseIds)].map((courseId) => ({ schoolUnitId: id, courseId })),
    });
  });
  return NextResponse.json({ ok: true });
});
