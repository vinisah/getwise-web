import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isCourseUnlocked } from "@/lib/services/unlock";
import { getCourseProgress } from "@/lib/services/progress";
import { Card, Badge, SectionHeader } from "@/components/gw/primitives";
import { BookOpen, Lock, CheckCircle, ArrowRight } from "lucide-react";

const LEVEL_LABELS: Record<string, string> = {
  A1: "A1 — Iniciante", A2: "A2 — Básico", B1: "B1 — Intermediário",
  B2: "B2 — Inter. Avançado", C1: "C1 — Avançado", C2: "C2 — Proficiente",
};

export default async function StudentCoursesPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id: string; role: string } | undefined;
  if (!user) redirect("/login");

  const courses = await prisma.course.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }, { level: "asc" }],
    include: {
      _count: { select: { modules: true } },
      prerequisites: { include: { requiredCourse: { select: { title: true } } } },
    },
  });

  // Computa unlock + progresso por curso
  const enriched = await Promise.all(
    courses.map(async (c) => ({
      course: c,
      unlocked: await isCourseUnlocked(user.id, c.id),
      progress: await getCourseProgress(user.id, c.id),
    }))
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <SectionHeader title="Catálogo de cursos" sub="Conclua um curso para desbloquear o próximo nível" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: "var(--gap)" }}>
        {enriched.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--muted)" }}>Nenhum curso disponível ainda.</p>
        ) : (
          enriched.map(({ course, unlocked, progress }) => {
            const completed = progress === 100;
            const inner = (
              <Card
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  height: "100%",
                  opacity: unlocked ? 1 : 0.65,
                  cursor: unlocked ? "pointer" : "not-allowed",
                  transition: "transform .15s, box-shadow .15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "var(--r-sm)", background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {unlocked ? <BookOpen size={22} /> : <Lock size={20} />}
                  </div>
                  <Badge tone="slate">{LEVEL_LABELS[course.level]}</Badge>
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{course.title}</h3>
                  {course.description && (
                    <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>{course.description}</p>
                  )}
                </div>

                {!unlocked && course.prerequisites.length > 0 && (
                  <p style={{ fontSize: 12, color: "var(--amber)", display: "flex", alignItems: "center", gap: 6 }}>
                    <Lock size={13} /> Requer: {course.prerequisites.map((p) => p.requiredCourse.title).join(", ")}
                  </p>
                )}

                <div style={{ marginTop: "auto" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                    <span style={{ color: "var(--muted)" }}>{course._count.modules} módulo(s)</span>
                    <span style={{ fontWeight: 700, color: completed ? "var(--success)" : "var(--ink)" }}>{progress}%</span>
                  </div>
                  <div className="gw-meter"><span style={{ width: `${progress}%`, background: completed ? "var(--success)" : "var(--accent)" }} /></div>
                </div>

                {unlocked && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: completed ? "var(--success)" : "var(--accent)", fontSize: 13, fontWeight: 600 }}>
                    {completed ? <><CheckCircle size={15} /> Concluído</> : <>Continuar <ArrowRight size={15} /></>}
                  </div>
                )}
              </Card>
            );
            return unlocked ? (
              <Link key={course.id} href={`/student/courses/${course.id}`} style={{ textDecoration: "none" }}>{inner}</Link>
            ) : (
              <div key={course.id}>{inner}</div>
            );
          })
        )}
      </div>
    </div>
  );
}
