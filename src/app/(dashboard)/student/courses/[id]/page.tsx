import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isCourseUnlocked, getOrderedUnits, getCompletedUnitIds, isUnitUnlocked } from "@/lib/services/unlock";
import { Card, Badge, SectionHeader } from "@/components/gw/primitives";
import { Button } from "@/components/ui/button";
import { Lock, CheckCircle, PlayCircle, ArrowLeft } from "lucide-react";

const LEVEL_LABELS: Record<string, string> = {
  A1: "A1 — Iniciante", A2: "A2 — Básico", B1: "B1 — Intermediário",
  B2: "B2 — Inter. Avançado", C1: "C1 — Avançado", C2: "C2 — Proficiente",
};

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id: string } | undefined;
  if (!user) redirect("/login");

  const { id } = await params;
  // Independentes entre si → uma única ida ao banco em vez de 3 em série.
  const [course, unlocked, ordered, completed] = await Promise.all([
    prisma.course.findUnique({
      where: { id },
      include: { modules: { orderBy: { order: "asc" }, include: { units: { orderBy: { order: "asc" } } } } },
    }),
    isCourseUnlocked(user.id, id),
    getOrderedUnits(id),
    getCompletedUnitIds(user.id, id),
  ]);
  if (!course) notFound();
  if (!course.isActive) notFound(); // curso arquivado não existe para o aluno

  if (!unlocked) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
        <Link href="/student/courses"><Button variant="ghost" size="sm"><ArrowLeft size={15} /> Catálogo</Button></Link>
        <Card style={{ textAlign: "center", padding: 48 }}>
          <Lock size={40} color="var(--amber)" style={{ margin: "0 auto 16px" }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>Curso bloqueado</h2>
          <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 8 }}>Conclua os cursos pré-requisitos para liberar.</p>
        </Card>
      </div>
    );
  }

  const doneCount = ordered.filter((u) => completed.has(u.id)).length;
  const progress = ordered.length ? Math.round((doneCount / ordered.length) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <Link href="/student/courses"><Button variant="ghost" size="sm"><ArrowLeft size={15} /> Catálogo</Button></Link>

      <Card>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <Badge tone="slate">{LEVEL_LABELS[course.level]}</Badge>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.02em", marginTop: 8 }}>{course.title}</h1>
            {course.description && <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 6, maxWidth: 560 }}>{course.description}</p>}
          </div>
          <div style={{ textAlign: "right", minWidth: 120 }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: progress === 100 ? "var(--success)" : "var(--accent)" }}>{progress}%</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{doneCount}/{ordered.length} unidades</div>
          </div>
        </div>
        <div className="gw-meter lg" style={{ marginTop: 16 }}>
          <span style={{ width: `${progress}%`, background: progress === 100 ? "var(--success)" : "var(--accent)" }} />
        </div>
      </Card>

      {course.modules.map((mod, mi) => (
        <Card key={mod.id}>
          <SectionHeader title={`Módulo ${mi + 1}: ${mod.title}`} sub={mod.description ?? undefined} />
          <div className="gw-list">
            {mod.units.map((unit) => {
              const isDone = completed.has(unit.id);
              const isUnlocked = isUnitUnlocked(unit.id, ordered, completed);
              const row = (
                <div className="gw-row" style={{ opacity: isUnlocked ? 1 : 0.55 }}>
                  <div style={{ width: 38, height: 38, borderRadius: "var(--r-sm)", background: isDone ? "var(--success-soft)" : isUnlocked ? "var(--accent-soft)" : "var(--bg)", color: isDone ? "var(--success)" : isUnlocked ? "var(--accent)" : "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {isDone ? <CheckCircle size={18} /> : isUnlocked ? <PlayCircle size={18} /> : <Lock size={16} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{unit.title}</p>
                  </div>
                  {isDone && <Badge tone="green">Concluída</Badge>}
                  {!isDone && !isUnlocked && <Badge tone="slate">Bloqueada</Badge>}
                </div>
              );
              return isUnlocked ? (
                <Link key={unit.id} href={`/student/courses/${id}/units/${unit.id}`} style={{ textDecoration: "none" }}>{row}</Link>
              ) : (
                <div key={unit.id}>{row}</div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
