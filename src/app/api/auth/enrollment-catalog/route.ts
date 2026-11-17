import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
export const GET = withErrorHandler(async () =>
  NextResponse.json(
    await prisma.schoolUnit.findMany({
      where: { isActive: true, enrollmentOpen: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        consultants: true,
        courses: {
          where: { course: { isActive: true } },
          select: { course: { select: { id: true, title: true, level: true } } },
        },
      },
    })
  )
);
