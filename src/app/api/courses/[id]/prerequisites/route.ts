import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { CoursePrereqSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withErrorHandler(async (req: NextRequest, ctx) => {
  const session = await requireAdmin("courses");
  const { id: courseId } = await (ctx as Ctx).params;

  const parsed = CoursePrereqSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const { requiredCourseId } = parsed.data;

  // Guard: curso não pode exigir a si mesmo
  if (requiredCourseId === courseId) {
    return NextResponse.json({ error: "Um curso não pode exigir a si mesmo" }, { status: 400 });
  }

  const prereq = await prisma.coursePrerequisite.create({
    data: { courseId, requiredCourseId },
  });

  await audit({ userId: session.user.id, action: "ADD_PREREQUISITE", entity: "Course", entityId: courseId });
  return NextResponse.json(prereq, { status: 201 });
});

export const DELETE = withErrorHandler(async (req: NextRequest, ctx) => {
  const session = await requireAdmin("courses");
  const { id: courseId } = await (ctx as Ctx).params;
  const requiredCourseId = req.nextUrl.searchParams.get("requiredCourseId");

  if (!requiredCourseId) {
    return NextResponse.json({ error: "requiredCourseId obrigatório" }, { status: 400 });
  }

  await prisma.coursePrerequisite.deleteMany({ where: { courseId, requiredCourseId } });

  await audit({ userId: session.user.id, action: "REMOVE_PREREQUISITE", entity: "Course", entityId: courseId });
  return NextResponse.json({ ok: true });
});
