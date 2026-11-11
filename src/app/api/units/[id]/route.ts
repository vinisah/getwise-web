import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAuth, requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { UpdateUnitSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";
import { getOrderedUnits, getCompletedUnitIds, isUnitUnlocked, isCourseUnlocked } from "@/lib/services/unlock";
import { ApiError } from "@/lib/api-error";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandler(async (_req: NextRequest, ctx) => {
  const session = await requireAuth("courses");
  const { id } = await (ctx as Ctx).params;

  const unit = await prisma.unit.findUnique({
    where: { id },
    include: { module: { include: { course: true } } },
  });
  if (!unit) return NextResponse.json({ error: "Unidade não encontrada" }, { status: 404 });

  const courseId = unit.module.courseId;

  // Aluno: aplicar guards de bloqueio (admin/teacher veem tudo)
  if (session.user.role === "STUDENT") {
    if (!(await isCourseUnlocked(session.user.id, courseId))) {
      throw new ApiError(403, "Curso bloqueado: conclua os pré-requisitos");
    }
    const ordered = await getOrderedUnits(courseId);
    const completed = await getCompletedUnitIds(session.user.id, courseId);
    if (!isUnitUnlocked(id, ordered, completed)) {
      throw new ApiError(403, "Conclua a unidade anterior antes desta");
    }
    // Real-time: registra acesso
    await prisma.userUnitProgress.upsert({
      where: { userId_unitId: { userId: session.user.id, unitId: id } },
      update: { lastAccess: new Date() },
      create: { userId: session.user.id, unitId: id, courseId, completed: false },
    });
  }

  const progress = session.user.role === "STUDENT"
    ? await prisma.userUnitProgress.findUnique({
        where: { userId_unitId: { userId: session.user.id, unitId: id } },
      })
    : null;

  return NextResponse.json({ ...unit, completed: progress?.completed ?? false });
});

export const PUT = withErrorHandler(async (req: NextRequest, ctx) => {
  const session = await requireAdmin("courses");
  const { id } = await (ctx as Ctx).params;

  const parsed = UpdateUnitSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const data = parsed.data;
  const unit = await prisma.unit.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.order !== undefined ? { order: data.order } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.videoUrl !== undefined ? { videoUrl: data.videoUrl || null } : {}),
      ...(data.thumbnailUrl !== undefined ? { thumbnailUrl: data.thumbnailUrl || null } : {}),
      ...(data.videoDurationSeconds !== undefined ? { videoDurationSeconds: data.videoDurationSeconds } : {}),
      ...(data.durationMinutes !== undefined ? { durationMinutes: data.durationMinutes } : {}),
    },
  });

  await audit({ userId: session.user.id, action: "UPDATE_UNIT", entity: "Unit", entityId: unit.id });
  return NextResponse.json(unit);
});

export const DELETE = withErrorHandler(async (_req: NextRequest, ctx) => {
  const session = await requireAdmin("courses");
  const { id } = await (ctx as Ctx).params;

  await prisma.unit.delete({ where: { id } });

  await audit({ userId: session.user.id, action: "DELETE_UNIT", entity: "Unit", entityId: id });
  return NextResponse.json({ ok: true });
});
