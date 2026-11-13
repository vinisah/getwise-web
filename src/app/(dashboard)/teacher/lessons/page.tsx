import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEffectiveUser } from "@/lib/effective-user";
import { roleHome } from "@/lib/roles";
import { Card, Badge } from "@/components/gw/primitives";
import { formatDateTime, safeHttpUrl } from "@/lib/utils";
import { Headphones } from "lucide-react";
import { AttendanceForm } from "./attendance-form";
import { AgendaRefresh } from "@/components/scheduling/agenda-refresh";

const STATUS: Record<string, { label: string; tone: string }> = {
  SCHEDULED: { label: "Agendada", tone: "blue" },
  IN_PROGRESS: { label: "Em andamento", tone: "amber" },
  COMPLETED: { label: "Concluída", tone: "green" },
  CANCELLED: { label: "Cancelada", tone: "red" },
};

export default async function TeacherLessonsPage() {
  const eff = await getEffectiveUser();
  if (!eff) redirect("/login");
  if (eff.role !== "TEACHER") redirect(roleHome(eff.role));

  const lessons = await prisma.lesson.findMany({
    where: { teacherId: eff.id },
    include: { bookings: { include: { student: { select: { id: true, name: true } } } } },
    orderBy: { scheduledAt: "desc" },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <AgendaRefresh />
      <p style={{ fontSize: 13.5, color: "var(--muted)" }}>
        Acompanhe confirmações, ausências e remarcações. Marque a presença dos participantes de cada aula.
      </p>

      {lessons.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>Nenhuma aula sua ainda.</Card>
      ) : (
        lessons.map((l) => {
          const st = STATUS[l.status] ?? STATUS.SCHEDULED;
          const active = l.bookings.filter((b) => b.status !== "CANCELLED");
          const declined = l.bookings.filter(
            (b) => b.status === "CANCELLED" && ["DECLINED", "RESCHEDULED"].includes(b.confirmation)
          );
          return (
            <Card key={l.id}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{l.title}</h3>
                    <Badge tone={st.tone} dot>
                      {st.label}
                    </Badge>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>
                    {formatDateTime(l.scheduledAt)} · {active.length}/{l.maxStudents} alunos ·{" "}
                    {l.meetingUrl ? "Online" : "Presencial"}
                  </div>
                </div>
                {safeHttpUrl(l.meetingUrl) && l.status === "SCHEDULED" && (
                  <a href={safeHttpUrl(l.meetingUrl)} target="_blank" rel="noopener noreferrer">
                    <button
                      className="gw-btn"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--accent)",
                        background: "var(--accent-soft)",
                        border: "none",
                        borderRadius: "var(--r-sm)",
                        padding: "8px 14px",
                        cursor: "pointer",
                      }}
                    >
                      <Headphones size={15} /> Entrar
                    </button>
                  </a>
                )}
              </div>

              {active.length > 0 && (
                <p style={{ marginTop: 12, fontSize: 13 }}>
                  {active.filter((b) => b.confirmation === "CONFIRMED").length} participação(ões) confirmada(s)
                </p>
              )}
              {declined.length > 0 && (
                <details style={{ marginTop: 12, fontSize: 13 }}>
                  <summary>Ausências e remarcações ({declined.length})</summary>
                  {declined.map((b) => (
                    <p key={b.id}>
                      {b.student.name} · {b.confirmation === "RESCHEDULED" ? "Remarcou a aula" : "Justificou ausência"}
                      {b.absenceReason ? ` · ${b.absenceReason}` : ""}
                    </p>
                  ))}
                </details>
              )}
              {l.status !== "CANCELLED" && active.length > 0 && (
                <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                  <AttendanceForm
                    lessonId={l.id}
                    students={active.map((b) => ({
                      studentId: b.studentId,
                      name: b.student.name,
                      attendance: b.attendance,
                    }))}
                  />
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
