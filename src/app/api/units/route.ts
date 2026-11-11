import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { CreateUnitSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAdmin("courses");

  const parsed = CreateUnitSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const { moduleId, title, content, order, type, videoUrl, thumbnailUrl, videoDurationSeconds, durationMinutes } = parsed.data;
  const unit = await prisma.unit.create({
    data: {
      moduleId, title, content, order, type,
      videoUrl: videoUrl || null,
      thumbnailUrl: thumbnailUrl || null,
      videoDurationSeconds: videoDurationSeconds ?? null,
      durationMinutes: durationMinutes ?? null,
    },
  });

  await audit({ userId: session.user.id, action: "CREATE_UNIT", entity: "Unit", entityId: unit.id });
  return NextResponse.json(unit, { status: 201 });
});
