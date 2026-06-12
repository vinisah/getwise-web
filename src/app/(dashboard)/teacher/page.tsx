import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, SectionHeader, Badge } from "@/components/gw/primitives";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { Calendar, Users, Headphones } from "lucide-react";

export default async function TeacherDashboard() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; name?: string; role?: string } | undefined;
  if (!user || user.role !== "TEACHER") redirect("/login");

  const now = new Date();
  const [upcomingLessons, totalStudents] = await Promise.all([
    prisma.lesson.findMany({
      where: { teacherId: user.id, scheduledAt: { gte: now }, status: "SCHEDULED" },
      include: { bookings: { include: { student: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 10,
    }),
    prisma.lessonBooking.groupBy({ by: ["studentId"], where: { lesson: { teacherId: user.id } } }),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div style={{ display: "flex", gap: "var(--gap)" }}>
        <Card style={{ flex: 1, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: "var(--r-sm)", background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)" }}>{totalStudents.length}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>alunos no total</div>
          </div>
        </Card>
        <Card style={{ flex: 1, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: "var(--r-sm)", background: "var(--success-soft)", color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Calendar size={22} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)" }}>{upcomingLessons.length}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>aulas agendadas</div>
          </div>
        </Card>
      </div>

      <Card>
        <SectionHeader title="Próximas aulas" />
        <div className="gw-list">
          {upcomingLessons.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Nenhuma aula agendada.</p>
          ) : (
            upcomingLessons.map((l) => (
              <div key={l.id} className="gw-row">
                <div style={{ width: 44, height: 44, borderRadius: "var(--r-sm)", background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Calendar size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{l.title}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{l.bookings.map((b) => b.student.name).join(", ") || "Sem alunos"}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{formatDateTime(l.scheduledAt)}</div>
                  {l.meetingUrl && (
                    <a href={l.meetingUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="accent" size="sm" style={{ marginTop: 4 }}><Headphones size={14} /> Entrar</Button>
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
