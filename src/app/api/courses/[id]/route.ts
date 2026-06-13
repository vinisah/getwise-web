import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAuth, requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { UpdateCourseSchema } from "@/lib/schemas";
import { isCourseUnlocked, getOrderedUnits, getCompletedUnitIds, isUnitUnlocked } from "@/lib/services/unlock";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandler(async (_req: NextRequest, ctx) => {
  const session = await requireAuth();
  const { id } = await (ctx as Ctx).params;

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      modules: { orderBy: { order: "asc" }, include: { units: { orderBy: { order: "asc" } } } },
      prerequisites: { include: { requiredCourse: { select: { id: true, title: true } } } },
    },
  });

  if (!course) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 });

  // Aluno: oculta o conteúdo de unidades bloqueadas (gate de conteúdo).
  if (session.user.role === "STUDENT") {
    const [unlocked, ordered, completed] = await Promise.all([
      isCourseUnlocked(session.user.id, id),
      getOrderedUnits(id),
      getCompletedUnitIds(session.user.id, id),
    ]);
    course.modules.forEach((m) =>
      m.units.forEach((u) => {
        if (!unlocked || !isUnitUnlocked(u.id, ordered, completed)) u.content = "";
      })
    );
  }

  return NextResponse.json(course);
});

export const PUT = withErrorHandler(async (req: NextRequest, ctx) => {
  const session = await requireAdmin();
  const { id } = await (ctx as Ctx).params;

  const parsed = UpdateCourseSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const data = parsed.data;
  const course = await prisma.course.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.level !== undefined ? { level: data.level } : {}),
      ...(data.coverImage !== undefined ? { coverImage: data.coverImage || null } : {}),
      ...(data.order !== undefined ? { order: data.order } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });

  await audit({ userId: session.user.id, action: "UPDATE_COURSE", entity: "Course", entityId: course.id });
  return NextResponse.json(course);
});

export const DELETE = withErrorHandler(async (_req: NextRequest, ctx) => {
  const session = await requireAdmin();
  const { id } = await (ctx as Ctx).params;

  await prisma.course.delete({ where: { id } });

  await audit({ userId: session.user.id, action: "DELETE_COURSE", entity: "Course", entityId: id });
  return NextResponse.json({ ok: true });
});
