import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, ApiError } from "@/lib/api-error";
import { getEffectiveUser } from "@/lib/effective-user";
import { prisma } from "@/lib/prisma";

export type SearchHit = { type: string; id: string; title: string; sub?: string; href: string };

/**
 * GET /api/search?q= — busca global ROLE-SCOPED (via effective user: admin "vendo como"
 * busca no escopo do papel da visão). Read-only. Cada papel só vê o que pode acessar.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const eff = await getEffectiveUser();
  if (!eff) throw new ApiError(401, "Não autenticado");

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const ci = { contains: q, mode: "insensitive" as const };
  const hits: SearchHit[] = [];

  if (eff.role === "ADMIN") {
    const [students, courses, lessons, plans, employees] = await Promise.all([
      prisma.user.findMany({
        where: { role: "STUDENT", OR: [{ name: ci }, { email: ci }] },
        select: { id: true, name: true, email: true },
        take: 5,
      }),
      prisma.course.findMany({
        where: { OR: [{ title: ci }, { description: ci }] },
        select: { id: true, title: true, level: true },
        take: 5,
      }),
      prisma.lesson.findMany({ where: { title: ci }, select: { id: true, title: true }, take: 5 }),
      prisma.plan.findMany({
        where: { OR: [{ name: ci }, { description: ci }] },
        select: { id: true, name: true },
        take: 5,
      }),
      prisma.employee.findMany({
        where: { OR: [{ name: ci }, { role: ci }] },
        select: { id: true, name: true, role: true },
        take: 5,
      }),
    ]);
    students.forEach((s) =>
      hits.push({ type: "Aluno", id: s.id, title: s.name, sub: s.email, href: `/admin/students/${s.id}` })
    );
    courses.forEach((c) =>
      hits.push({ type: "Curso", id: c.id, title: c.title, sub: c.level, href: `/admin/courses/${c.id}` })
    );
    lessons.forEach((l) => hits.push({ type: "Aula", id: l.id, title: l.title, href: `/admin/lessons/${l.id}/edit` }));
    plans.forEach((p) => hits.push({ type: "Plano", id: p.id, title: p.name, href: `/admin/plans` }));
    employees.forEach((e) =>
      hits.push({ type: "Funcionário", id: e.id, title: e.name, sub: e.role, href: `/admin/employees` })
    );
  } else if (eff.role === "STUDENT") {
    const [courses, lessons] = await Promise.all([
      prisma.course.findMany({
        where: { isActive: true, title: ci },
        select: { id: true, title: true, level: true },
        take: 6,
      }),
      prisma.lesson.findMany({
        where: { title: ci, bookings: { some: { studentId: eff.id } } },
        select: { id: true, title: true },
        take: 6,
      }),
    ]);
    courses.forEach((c) =>
      hits.push({ type: "Curso", id: c.id, title: c.title, sub: c.level, href: `/student/courses/${c.id}` })
    );
    lessons.forEach((l) => hits.push({ type: "Aula", id: l.id, title: l.title, href: `/student/lessons` }));
  } else if (eff.role === "TEACHER") {
    const lessons = await prisma.lesson.findMany({
      where: { title: ci, teacherId: eff.id },
      select: { id: true, title: true },
      take: 8,
    });
    lessons.forEach((l) => hits.push({ type: "Aula", id: l.id, title: l.title, href: `/teacher/lessons` }));
  }

  return NextResponse.json({ results: hits });
});
