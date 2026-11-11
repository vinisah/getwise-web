import { NextResponse } from "next/server";
import { withErrorHandler, ApiError } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { requireEffectiveStudent, PREVIEW_COOKIE } from "@/lib/effective-user";
import { prisma } from "@/lib/prisma";
import { CohortInput, ResponseInput } from "@/lib/scheduling/rules";
import { assignStudent, createCohort, respond, bookAdditionalLesson } from "@/lib/scheduling/service";

export const GET = withErrorHandler(async (req) => {
  if (req.nextUrl.searchParams.get("admin") === "true") {
    await requireAdmin("lessons");
    const [cohorts, students, teachers] = await Promise.all([
      prisma.cohort.findMany({
        include: { _count: { select: { students: true, lessons: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { role: "STUDENT", isActive: true },
        select: { id: true, name: true, studentProfile: { select: { level: true, cohortId: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({ where: { role: "TEACHER", isActive: true }, select: { id: true, name: true } }),
    ]);
    return NextResponse.json({ cohorts, students, teachers });
  }
  const user = await requireEffectiveStudent();
  const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id }, include: { cohort: true } });
  const bookings = await prisma.lessonBooking.findMany({
    where: { studentId: user.id, lesson: { scheduledAt: { gt: new Date() } } },
    include: { lesson: { include: { teacher: { select: { name: true } } } } },
    orderBy: { lesson: { scheduledAt: "asc" } },
  });
  const courseEnd = profile?.cohortId
    ? await prisma.lesson.findFirst({ where: { cohortId: profile.cohortId }, orderBy: { scheduledAt: "desc" } })
    : null;
  const available =
    courseEnd && profile
      ? await prisma.lesson.findMany({
          where: {
            cohortId: { not: null },
            level: profile.level,
            status: "SCHEDULED",
            scheduledAt: { gt: new Date(), lte: courseEnd.scheduledAt },
          },
          include: {
            teacher: { select: { name: true } },
            _count: { select: { bookings: { where: { status: { not: "CANCELLED" } } } } },
          },
          orderBy: { scheduledAt: "asc" },
        })
      : [];
  return NextResponse.json({
    profile,
    bookings,
    available: available.filter(
      (l) =>
        l._count.bookings < l.maxStudents &&
        !bookings.some(
          (b) =>
            b.status !== "CANCELLED" &&
            b.lesson.status === "SCHEDULED" &&
            b.lesson.scheduledAt.getTime() < l.scheduledAt.getTime() + l.duration * 60000 &&
            b.lesson.scheduledAt.getTime() + b.lesson.duration * 60000 > l.scheduledAt.getTime()
        )
    ),
  });
});

export const POST = withErrorHandler(async (req) => {
  const body = await req.json();
  if (body.action === "createCohort") {
    await requireAdmin("lessons");
    const input = CohortInput.safeParse(body);
    if (!input.success) throw new ApiError(400, input.error.issues[0].message);
    return NextResponse.json(await createCohort(input.data), { status: 201 });
  }
  if (body.action === "preview" && typeof body.studentId === "string") {
    await requireAdmin();
    const target = await prisma.user.findFirst({ where: { id: body.studentId, role: "STUDENT", isActive: true } });
    if (!target) throw new ApiError(404, "Aluno não encontrado");
    const response = NextResponse.json({ ok: true });
    response.cookies.set(PREVIEW_COOKIE, target.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7200,
    });
    return response;
  }
  if (body.action === "assign") {
    await requireAdmin("students");
    if (typeof body.studentId !== "string") throw new ApiError(400, "Aluno obrigatório");
    return NextResponse.json(await assignStudent(body.studentId));
  }
  const user = await requireEffectiveStudent();
  if (body.action === "book" && typeof body.lessonId === "string")
    return NextResponse.json(await bookAdditionalLesson(user.id, body.lessonId));
  if (body.action === "whatsappConsent" && typeof body.enabled === "boolean")
    return NextResponse.json(
      await prisma.studentProfile.update({ where: { userId: user.id }, data: { whatsappOptIn: body.enabled } })
    );
  const input = ResponseInput.safeParse(body);
  if (!input.success) throw new ApiError(400, input.error.issues[0].message);
  return NextResponse.json(await respond(user.id, input.data));
});
