import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAuth, requireAdmin } from "@/lib/api-auth";
import { CreatePlanSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";

export const GET = withErrorHandler(async (_req: NextRequest) => {
  await requireAuth("plans");

  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { price: "asc" },
  });

  return NextResponse.json(plans);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin("plans");

  const parsed = CreatePlanSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }

  const { name, description, price, lessonsPerMonth, lessonDurationMin, features } = parsed.data;

  const plan = await prisma.plan.create({
    data: {
      name,
      description: description || null,
      price,
      lessonsPerMonth,
      lessonDurationMin: lessonDurationMin ?? 50,
      features: features ? (features as import("@prisma/client").Prisma.InputJsonValue) : undefined,
    },
  });

  return NextResponse.json(plan, { status: 201 });
});
