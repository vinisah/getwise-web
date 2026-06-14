import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, Badge } from "@/components/gw/primitives";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { Plus, Users } from "lucide-react";
import { LessonActions } from "./lesson-actions";

const STATUS: Record<string, { label: string; tone: string }> = {
  SCHEDULED: { label: "Agendada", tone: "blue" },
  IN_PROGRESS: { label: "Em andamento", tone: "amber" },
  COMPLETED: { label: "Concluída", tone: "green" },
  CANCELLED: { label: "Cancelada", tone: "red" },
};

const LEVEL: Record<string, string> = {
  A1: "A1 — Iniciante",
  A2: "A2 — Básico",
  B1: "B1 — Intermediário",
  B2: "B2 — Inter. Avançado",
  C1: "C1 — Avançado",
  C2: "C2 — Proficiente",
};

export default async function LessonsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== "ADMIN") redirect("/login");

  const statusFilter = (await searchParams)?.status;
  const lessons = await prisma.lesson.findMany({
    where: statusFilter ? { status: statusFilter as never } : {},
    include: { teacher: true, bookings: { include: { student: true } } },
    orderBy: { scheduledAt: "desc" },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/admin/lessons"><Button variant={!statusFilter ? "default" : "outline"} size="sm">Todas</Button></Link>
          {Object.entries(STATUS).map(([k, v]) => (
            <Link key={k} href={`/admin/lessons?status=${k}`}><Button variant={statusFilter === k ? "default" : "outline"} size="sm">{v.label}</Button></Link>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <Link href="/admin/lessons/new"><Button variant="accent"><Plus size={17} /> Nova aula</Button></Link>
      </div>

      <Card pad={false}>
        <table className="gw-table">
          <thead>
            <tr><th>Aula</th><th>Professor</th><th>Data/Hora</th><th>Alunos</th><th>Nível</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {lessons.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>Nenhuma aula encontrada.</td></tr>
            ) : (
              lessons.map((l) => (
                <tr key={l.id}>
                  <td>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{l.title}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{l.duration}min</div>
                  </td>
                  <td><span style={{ fontSize: 13, color: "var(--ink-2)" }}>{l.teacher.name}</span></td>
                  <td><span style={{ fontSize: 13, color: "var(--ink-2)" }}>{formatDateTime(l.scheduledAt)}</span></td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-2)" }}>
                      <Users size={13} color="var(--muted)" /> {l.bookings.length}/{l.maxStudents}
                    </span>
                  </td>
                  <td><Badge tone="slate">{LEVEL[l.level]}</Badge></td>
                  <td><Badge tone={STATUS[l.status]?.tone ?? "slate"} dot>{STATUS[l.status]?.label ?? l.status}</Badge></td>
                  <td style={{ textAlign: "right" }}><LessonActions lessonId={l.id} status={l.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
