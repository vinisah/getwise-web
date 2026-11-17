import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ApiError, withErrorHandler } from "@/lib/api-error";
import { z } from "zod";
import { schoolDayStart } from "@/lib/pre-enrollment/schema";
import { requireAdmin } from "@/lib/api-auth";
import { applicantSession } from "@/lib/pre-enrollment/session";
import { prisma } from "@/lib/prisma";
export const GET = withErrorHandler(async (req) => {
  const p = req.nextUrl.searchParams;
  const admin = p.get("scope") === "admin";
  const session = admin ? await requireAdmin("pre-enrollments") : await applicantSession();
  const page = Math.floor(Math.max(1, Math.min(100000, Number(p.get("page")) || 1)));
  const from = p.get("from");
  const to = p.get("to");
  if (
    (from && !z.iso.date().safeParse(from).success) ||
    (to && !z.iso.date().safeParse(to).success) ||
    (from && to && from > to)
  )
    throw new ApiError(400, "Confira o período de envio.");
  const nextDay = to ? new Date(Date.parse(`${to}T00:00:00Z`) + 86400000).toISOString().slice(0, 10) : null;
  const where: Prisma.PreEnrollmentWhereInput = {
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: schoolDayStart(from) } : {}),
            ...(nextDay ? { lt: schoolDayStart(nextDay) } : {}),
          },
        }
      : {}),
    ...(!admin ? { applicantId: session.user.id } : {}),
    ...(p.get("status") ? { status: p.get("status")! } : {}),
    ...(p.get("unit") ? { schoolUnitId: p.get("unit")! } : {}),
    ...(p.get("course") ? { courseId: p.get("course")! } : {}),
    ...(p.get("q") ? { studentName: { contains: p.get("q")!.slice(0, 100), mode: "insensitive" } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.preEnrollment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 20,
      take: 20,
      select: {
        id: true,
        protocol: true,
        studentName: true,
        status: true,
        feedback: true,
        createdAt: true,
        studentId: true,
        schoolUnit: { select: { name: true } },
        course: { select: { title: true } },
      },
    }),
    prisma.preEnrollment.count({ where }),
  ]);
  return NextResponse.json({ items, total, page });
});
