import { getCachedSession } from "@/lib/effective-user";

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/gw/primitives";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CourseEditor } from "./course-editor";

const LEVEL_LABELS: Record<string, string> = {
  A1: "A1 — Iniciante", A2: "A2 — Básico", B1: "B1 — Intermediário",
  B2: "B2 — Inter. Avançado", C1: "C1 — Avançado", C2: "C2 — Proficiente",
};

export default async function AdminCourseEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCachedSession();
  if ((session?.user as { role?: string })?.role !== "ADMIN") redirect("/login");

  const { id } = await params;
  const [course, others] = await Promise.all([
    prisma.course.findUnique({
      where: { id },
      include: {
        modules: {
          orderBy: { order: "asc" },
          include: {
            units: {
              orderBy: { order: "asc" },
              include: { exercises: { orderBy: { order: "asc" }, select: { id: true, title: true, type: true, points: true, isRequired: true } } },
            },
          },
        },
        prerequisites: { include: { requiredCourse: { select: { id: true, title: true } } } },
      },
    }),
    prisma.course.findMany({ where: { id: { not: id } }, select: { id: true, title: true }, orderBy: { order: "asc" } }),
  ]);

  if (!course) notFound();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/admin/courses"><Button variant="ghost" size="icon"><ArrowLeft size={16} /></Button></Link>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)" }}>{course.title}</h1>
            <Badge tone="slate">{LEVEL_LABELS[course.level]}</Badge>
            <Badge tone={course.isActive ? "green" : "slate"} dot>{course.isActive ? "Ativo" : "Inativo"}</Badge>
          </div>
        </div>
      </div>

      <CourseEditor course={course} others={others} />
    </div>
  );
}
