import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/gw/primitives";
import { formatDateTime } from "@/lib/utils";
import { Calendar, Video, Clock } from "lucide-react";

const STATUS: Record<string, { label: string; tone: string }> = {
  SCHEDULED: { label: "Agendada", tone: "blue" },
  IN_PROGRESS: { label: "Em andamento", tone: "amber" },
  COMPLETED: { label: "Concluída", tone: "green" },
  CANCELLED: { label: "Cancelada", tone: "red" },
};

export default async function StudentLessonsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user) redirect("/login");

  const lessons = await prisma.lesson.findMany({
    where: { bookings: { some: { studentId: user.id } } },
    include: { teacher: { select: { name: true } } },
    orderBy: { scheduledAt: "desc" },
  });

  const now = Date.now();
  const upcoming = lessons
    .filter((l) => l.scheduledAt.getTime() >= now && l.status !== "CANCELLED" && l.status !== "COMPLETED")
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  const past = lessons.filter((l) => !upcoming.includes(l));

  const renderRow = (l: (typeof lessons)[number]) => {
    const st = STATUS[l.status] ?? STATUS.SCHEDULED;
    return (
      <div key={l.id} className="gw-row">
        <div style={{ width: 44, height: 44, borderRadius: "var(--r-sm)", background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Calendar size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.title}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            Prof. {l.teacher.name} · <Clock size={11} style={{ display: "inline", verticalAlign: "-1px" }} /> {l.duration}min
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{formatDateTime(l.scheduledAt)}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {l.meetingUrl && l.status === "SCHEDULED" && (
              <a href={l.meetingUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
                <Video size={13} /> Entrar
              </a>
            )}
            <Badge tone={st.tone} dot>{st.label}</Badge>
          </span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>Próximas aulas</div>
        <div className="gw-list">
          {upcoming.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Nenhuma aula agendada.</p>
          ) : (
            upcoming.map(renderRow)
          )}
        </div>
      </Card>

      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>Histórico</div>
        <div className="gw-list">
          {past.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Nenhuma aula anterior.</p>
          ) : (
            past.map(renderRow)
          )}
        </div>
      </Card>
    </div>
  );
}
