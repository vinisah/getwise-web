import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const GET = withErrorHandler(async (_req: NextRequest) => {
  await requireAuth("lessons");

  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(teachers);
});
