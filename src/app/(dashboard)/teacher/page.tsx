import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getEffectiveUser } from "@/lib/effective-user";
import { roleHome } from "@/lib/roles";
import { teacherClassFrequency, teacherAvgRating } from "@/lib/services/attendance";
import { Card, SectionHeader, MiniStat } from "@/components/gw/primitives";
import { Button } from "@/components/ui/button";
import { formatDateTime, safeHttpUrl } from "@/lib/utils";
import { Calendar, Star, Headphones, ClipboardCheck } from "lucide-react";
import { AgendaRefresh } from "@/components/scheduling/agenda-refresh";

/** Mesmo dia-calendário no fuso Brasília. */
function sameDayBR(a: Date, b: Date): boolean {
  const f = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return f(a) === f(b);
}

export default async function TeacherDashboard() {
  // effective user: professor real OU admin "vendo como" professor (read-only).
  const eff = await getEffectiveUser();
  if (!eff) redirect("/login");
  if (eff.role !== "TEACHER") redirect(roleHome(eff.role));
  const user = { id: eff.id, name: eff.name };

  const now = new Date();
  const [lessons, classFreq, rating] = await Promise.all([
    prisma.lesson.findMany({
      where: { teacherId: user.id },
      include: {
        bookings: {
          where: { status: { not: "CANCELLED" } },
          include: { student: { select: { id: true, name: true } } },
        },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    teacherClassFrequency(user.id),
    teacherAvgRating(user.id),
  ]);

  const upcoming = lessons.filter((l) => l.scheduledAt.getTime() >= now.getTime() && l.status === "SCHEDULED");
  const next = upcoming[0];
  // "Hoje" = todas as aulas do dia (passadas/futuras/em andamento), exceto canceladas —
  // não derivar de `upcoming` (senão as da manhã somem ao avançar o dia).
  const todayLessons = lessons.filter((l) => l.status !== "CANCELLED" && sameDayBR(l.scheduledAt, now));
  const nextUrl = safeHttpUrl(next?.meetingUrl);
  const totalStudents = new Set(lessons.flatMap((l) => l.bookings.map((b) => b.studentId))).size;
  const ratingLabel = rating.avg !== null ? `${rating.avg.toFixed(1)} ★` : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      {/* Hero — agenda do dia */}
      <div className="gw-hero">
        <div style={{ position: "relative", zIndex: 2, flex: 1, minWidth: 240 }}>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,.6)",
            }}
          >
            Sua agenda
          </span>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: "#fff", letterSpacing: "-.03em", marginTop: 10 }}>
            {todayLessons.length > 0 ? (
              <>
                Você tem {todayLessons.length} {todayLessons.length === 1 ? "aula" : "aulas"} hoje
              </>
            ) : (
              "Sem aulas hoje"
            )}
          </h1>
          {next && (
            <p style={{ fontSize: 14, color: "rgba(255,255,255,.72)", marginTop: 8 }}>
              Próxima: {formatDateTime(next.scheduledAt)} · {next.title}
            </p>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            {nextUrl ? (
              <a href={nextUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="accent">
                  <Headphones size={17} /> Iniciar próxima aula
                </Button>
              </a>
            ) : (
              <Button variant="accent" disabled>
                <Headphones size={17} /> Iniciar próxima aula
              </Button>
            )}
            <Link href="/teacher/lessons">
              <Button variant="ghost" style={{ color: "#fff", borderColor: "rgba(255,255,255,.25)" }}>
                <Calendar size={17} /> Ver agenda
              </Button>
            </Link>
          </div>
        </div>
        <div style={{ position: "relative", zIndex: 2, display: "flex", gap: 12 }}>
          <div
            style={{
              background: "rgba(255,255,255,.12)",
              border: "1px solid rgba(255,255,255,.16)",
              borderRadius: "var(--r-sm)",
              padding: "12px 16px",
              color: "#fff",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 20, fontWeight: 800 }}>
              <Star size={18} color="#FFB24D" /> {ratingLabel}
            </div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.66)", marginTop: 2 }}>avaliação média</div>
          </div>
        </div>
      </div>

      <AgendaRefresh />
      {/* KPIs */}
      <div className="gw-stats-grid">
        <MiniStat label="Aulas hoje" value={String(todayLessons.length)} tone="blue" />
        <MiniStat label="Alunos" value={String(totalStudents)} tone="green" />
        <MiniStat label="Agendadas" value={String(upcoming.length)} tone="violet" />
        <MiniStat label="Avaliação" value={ratingLabel} tone="amber" />
      </div>

      <div className="gw-two-col">
        {/* Aulas de hoje */}
        <Card>
          <SectionHeader title="Aulas de hoje" sub={`${todayLessons.length} agendada(s)`} />
          <div className="gw-list">
            {todayLessons.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>Nenhuma aula agendada para hoje.</p>
            ) : (
              todayLessons.map((l) => (
                <div key={l.id} className="gw-row">
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "var(--r-sm)",
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Calendar size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{l.title}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {formatDateTime(l.scheduledAt)} · {l.bookings.length}/{l.maxStudents} alunos ·{" "}
                      {l.meetingUrl ? "Online" : "Presencial"}
                    </div>
                  </div>
                  {safeHttpUrl(l.meetingUrl) && (
                    <a href={safeHttpUrl(l.meetingUrl)} target="_blank" rel="noopener noreferrer">
                      <Button variant="accent" size="sm">
                        <Headphones size={14} /> Entrar
                      </Button>
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Turmas & presença */}
        <Card>
          <SectionHeader
            title="Turmas & presença"
            sub="Frequência das aulas concluídas"
            action={
              <Link href="/teacher/lessons">
                <Button variant="ghost" size="sm">
                  <ClipboardCheck size={14} /> Marcar
                </Button>
              </Link>
            }
          />
          {classFreq.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>
              Conclua aulas e marque presença para ver a frequência.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {classFreq.map((c) => (
                <div key={c.lessonId}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--ink-2)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 220,
                      }}
                    >
                      {c.title}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                      {c.percent === null ? "—" : `${c.percent}%`}
                    </span>
                  </div>
                  <div className="gw-meter">
                    <span
                      style={{
                        width: `${c.percent ?? 0}%`,
                        background: (c.percent ?? 0) >= 90 ? "var(--success)" : "var(--amber)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
