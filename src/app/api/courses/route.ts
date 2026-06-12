import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAuth, requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { CreateCourseSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";

export const GET = withErrorHandler(async (_req: NextRequest) => {
  await requireAuth();

  const courses = await prisma.course.findMany({
    orderBy: [{ order: "asc" }, { level: "asc" }],
    include: {
      _count: { select: { modules: true } },
      prerequisites: { include: { requiredCourse: { select: { id: true, title: true } } } },
    },
  });

  return NextResponse.json(courses);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAdmin();

  const parsed = CreateCourseSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const { title, description, level, coverImage, order, isActive } = parsed.data;
  const course = await prisma.course.create({
    data: { title, description: description || null, level, coverImage: coverImage || null, order, isActive },
  });

  await audit({ userId: session.user.id, action: "CREATE_COURSE", entity: "Course", entityId: course.id });

  return NextResponse.json(course, { status: 201 });
});
