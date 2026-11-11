import { getCachedSession } from "@/lib/effective-user";

import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/gw/primitives";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight, Layers, BookOpen, Lock } from "lucide-react";
import { CourseArchiveButton } from "./course-archive-button";

export default async function AdminCoursesPage() {
  const session = await getCachedSession();
  if ((session?.user as { role?: string })?.role !== "ADMIN") redirect("/login");

  const courses = await prisma.course.findMany({
    orderBy: [{ order: "asc" }, { level: "asc" }],
    include: {
      _count: { select: { modules: true } },
      prerequisites: { include: { requiredCourse: { select: { title: true } } } },
    },
  });
  // Unidades relacionam a module, não a course → soma por curso.
  const moduleUnitCounts = await prisma.module.findMany({
    where: { courseId: { in: courses.map((c) => c.id) } },
    select: { courseId: true, _count: { select: { units: true } } },
  });
  const unitsByCourse = new Map<string, number>();
  for (const m of moduleUnitCounts)
    unitsByCourse.set(m.courseId, (unitsByCourse.get(m.courseId) ?? 0) + m._count.units);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Link href="/admin/courses/new">
          <Button variant="accent">
            <Plus size={17} /> Novo curso
          </Button>
        </Link>
      </div>

      {courses.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>Nenhum curso cadastrado.</Card>
      ) : (
        <div className="gw-cards-grid">
          {courses.map((c) => (
            <div key={c.id} className="gw-card gw-course-card">
              <div
                className="gw-course-cover"
                style={{ background: "linear-gradient(135deg, var(--brand-2), var(--brand))" }}
              >
                {c.coverImage ? (
                  // <img> (atributo escapado por React) em vez de background-image inline —
                  // url() cru permitiria CSS-injection armazenado + quebra com espaço/")".
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.coverImage}
                    alt=""
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <Layers size={26} />
                )}
                <div style={{ position: "absolute", top: 12, right: 12, zIndex: 1 }}>
                  <Badge tone="slate">{c.level}</Badge>
                </div>
                {!c.isActive && (
                  <span className="gw-course-archived" style={{ zIndex: 1 }}>
                    Arquivado
                  </span>
                )}
              </div>
              <div style={{ padding: "14px 16px 16px" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{c.title}</div>
                {c.description && (
                  <p
                    style={{
                      fontSize: 12.5,
                      color: "var(--muted)",
                      marginTop: 6,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {c.description}
                  </p>
                )}
                <div style={{ display: "flex", gap: 14, marginTop: 11, fontSize: 12.5, color: "var(--ink-2)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <Layers size={14} color="var(--muted)" /> {c._count.modules} mód.
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <BookOpen size={14} color="var(--muted)" /> {unitsByCourse.get(c.id) ?? 0} un.
                  </span>
                </div>
                {c.prerequisites.length > 0 && (
                  <div
                    style={{
                      marginTop: 11,
                      fontSize: 11.5,
                      color: "var(--muted)",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Lock size={13} /> Requer: {c.prerequisites.map((pr) => pr.requiredCourse.title).join(", ")}
                  </div>
                )}
                <div
                  style={{ display: "flex", justifyContent: "flex-end", gap: 4, marginTop: 14, alignItems: "center" }}
                >
                  <CourseArchiveButton courseId={c.id} isActive={c.isActive} />
                  <Link href={`/admin/courses/${c.id}`}>
                    <button className="gw-icon-btn sm" aria-label="Gerenciar curso">
                      <ChevronRight size={18} />
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
