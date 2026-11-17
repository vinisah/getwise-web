import { NextResponse } from "next/server";
import { withErrorHandler, ApiError } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { SchoolUnitSchema } from "@/lib/pre-enrollment/schema";
export const GET = withErrorHandler(async () => {
  await requireAdmin("school-units");
  return NextResponse.json(
    await prisma.schoolUnit.findMany({
      orderBy: { name: "asc" },
      include: { courses: { include: { course: { select: { id: true, title: true } } } } },
      take: 200,
    })
  );
});
export const POST = withErrorHandler(async (req) => {
  await requireAdmin("school-units");
  const parsed = SchoolUnitSchema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json(
      {
        error: parsed.error.issues[0].message,
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 400 }
    );
  const { courseIds, ...data } = parsed.data;
  if (new Set(courseIds).size !== courseIds.length) throw new ApiError(400, "Curso repetido.");
  return NextResponse.json(
    await prisma.schoolUnit.create({
      data: { ...data, courses: { create: courseIds.map((courseId) => ({ courseId })) } },
    }),
    { status: 201 }
  );
});
