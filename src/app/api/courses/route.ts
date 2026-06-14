import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, zodMessage } from "@/lib/api-error";
import { requireAuth, requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { CreateCourseSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";

export const GET = withErrorHandler(async (_req: NextRequest) => {
  const session = await requireAuth();

  const courses = await prisma.course.findMany({
    // Aluno só vê cursos ativos; staff vê todos (inclui arquivados p/ gestão).
    where: session.user.role === "STUDENT" ? { isActive: true } : {},
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
    return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
  }

  const { title, description, level, coverImage, order, isActive } = parsed.data;
  const course = await prisma.course.create({
    data: { title, description: description || null, level, coverImage: coverImage || null, order, isActive },
  });

  await audit({ userId: session.user.id, action: "CREATE_COURSE", entity: "Course", entityId: course.id });

  return NextResponse.json(course, { status: 201 });
});
