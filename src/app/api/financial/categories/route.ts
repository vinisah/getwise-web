import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAuth, requireAdmin } from "@/lib/api-auth";
import { CreateCategorySchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";

export const GET = withErrorHandler(async (_req: NextRequest) => {
  await requireAuth();

  const categories = await prisma.financialCategory.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(categories);
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAdmin();

  const parsed = CreateCategorySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }

  const { name, type, color, icon } = parsed.data;

  const category = await prisma.financialCategory.create({ data: { name, type, color, icon } });
  return NextResponse.json(category, { status: 201 });
});
