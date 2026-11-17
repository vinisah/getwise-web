import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
export const GET = withErrorHandler(async () => {
  await requireAdmin("school-units", "courses");
  return NextResponse.json(
    await prisma.course.findMany({
      select: { id: true, title: true, isActive: true },
      orderBy: { title: "asc" },
      take: 200,
    })
  );
});
