import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEffectiveUser } from "@/lib/effective-user";
import { roleHome } from "@/lib/roles";
import Link from "next/link";
import { Card, SectionHeader, Badge, MiniStat } from "@/components/gw/primitives";
import { QuickAction } from "@/components/gw/interactive";
import { Ring } from "@/components/gw/charts";
import { Button } from "@/components/ui/button";
import { fmtNum, formatDateTime } from "@/lib/utils";
import { Bot, PenLine, Calendar, Flame, Sparkles, Check, RefreshCw, Play, Headphones } from "lucide-react";

const SKILL_LABELS: Record<string, string> = {
  listening: "Listening",
  speaking: "Speaking",
  reading: "Reading",
  writing: "Writing",
};

export default async function StudentDashboard() {
  // effective user: aluno real OU admin em "ver como" (read-only).
  const eff = await getEffectiveUser();
  if (!eff) redirect("/login");
  // Papel efetivo errado (ex.: admin sem preview, cookie expirado) → própria home, não /login.
  if (eff.role !== "STUDENT") redirect(roleHome(eff.role));
  const user = { id: eff.id, name: eff.name };

  const [upcomingLessons, recentAttempts, profile, enrollment, weekAttempts] = await Promise.all([
    prisma.lessonBooking.findMany({
      where: { studentId: user.id, status: { not: "CANCELLED" }, lesson: { scheduledAt: { gte: new Date() }, status: "SCHEDULED" } },
      include: { lesson: { include: { teacher: true } } },
      orderBy: { lesson: { scheduledAt: "asc" } },
      take: 3,
    }),
    prisma.exerciseAttempt.findMany({
      where: { studentId: user.id },
      include: { exercise: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.studentProfile.findUnique({ where: { userId: user.id } }),
    prisma.enrollment.findFirst({ where: { studentId: user.id, status: "ACTIVE" }, include: { plan: true } }),
    prisma.exerciseAttempt.findMany({
      where: { studentId: user.id, createdAt: { gte: new Date(Date.now() - 7 * 864e5) } },
    }),
  ]);

  const xp = profile?.xp ?? 0;
  const streak = profile?.streak ?? 0;
  const rank = profile?.rank ?? "Bronze";
  const weeklyGoal = profile?.weeklyGoal ?? 3;
  const skills = (profile?.skills as Record<string, number> | null) ?? {
    listening: 0,
    speaking: 0,
    reading: 0,
    writing: 0,
  };

  const weeklyDone = weekAttempts.length > 0 ? Math.min(weeklyGoal, Math.ceil(weekAttempts.length / 3)) : 0;
  const weekCorrect = weekAttempts.filter((a) => a.isCorrect).length;
  const weekAccuracy = weekAttempts.length ? Math.round((weekCorrect / weekAttempts.length) * 100) : 0;
  const weekXp = weekAttempts.reduce((s, a) => s + a.score, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      {/* Hero */}
      <div className="gw-hero">
        <div style={{ position: "relative", zIndex: 1, flex: 1 }}>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,.65)",
            }}
          >
            Seu progresso
          </span>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-.02em", marginTop: 6 }}>
            Você está a caminho da fluência ⚡
          </h2>
          <p style={{ fontSize: 13.5, color: "rgba(255,255,255,.75)", marginTop: 6, maxWidth: 420 }}>
            {weeklyDone} de {weeklyGoal} aulas concluídas esta semana
            {enrollment ? ` · Plano ${enrollment.plan.name}` : ""}.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <Link href="/student/tutor">
              <Button variant="accent">
                <Bot size={17} /> Praticar com Tutor IA
              </Button>
            </Link>
            <Link href="/student/lessons">
              <Button variant="ghost" style={{ color: "#fff", border: "1px solid rgba(255,255,255,.25)" }}>
                <Play size={17} /> Minhas aulas
              </Button>
            </Link>
          </div>
        </div>
        <div className="gw-hero-stats">
          <div className="gw-hero-stat">
            <Flame size={20} color="#FFB24D" />
            <div>
              <b>{streak}</b>
              <span>dias seguidos</span>
            </div>
          </div>
          <div className="gw-hero-stat">
            <Sparkles size={20} color="#9FB4FF" />
            <div>
              <b>{fmtNum(xp)}</b>
              <span>XP · {rank}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="gw-stats-grid gw-quick-grid">
        <QuickAction
          icon={<Bot size={22} />}
          tone="violet"
          title="Tutor IA"
          desc="Pratique inglês agora"
          href="/student/tutor"
        />
        <QuickAction
          icon={<PenLine size={22} />}
          tone="green"
          title="Exercícios"
          desc="Vocabulário & gramática"
          href="/student/exercises"
        />
        <QuickAction
          icon={<Calendar size={22} />}
          tone="blue"
          title="Minhas Aulas"
          desc="Ver agendamentos"
          href="/student/lessons"
        />
      </div>

      <div className="gw-two-col">
        {/* Próximas aulas */}
        <Card>
          <SectionHeader title="Próximas aulas" />
          <div className="gw-list">
            {upcomingLessons.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>Nenhuma aula agendada.</p>
            ) : (
              upcomingLessons.map(({ lesson }) => (
                <div key={lesson.id} className="gw-row">
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
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: "var(--ink)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {lesson.title}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      Prof. {lesson.teacher.name} · {formatDateTime(lesson.scheduledAt)}
                    </div>
                  </div>
                  {lesson.meetingUrl ? (
                    <a href={lesson.meetingUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="accent" size="sm">
                        <Headphones size={15} /> Entrar
                      </Button>
                    </a>
                  ) : (
                    <Badge tone="slate">Presencial</Badge>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Skills */}
        <Card>
          <SectionHeader title="Suas habilidades" sub="Evolução nas 4 competências" />
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 4 }}>
            {Object.entries(SKILL_LABELS).map(([key, label]) => (
              <div key={key}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{skills[key] ?? 0}%</span>
                </div>
                <div className="gw-meter lg">
                  <span style={{ width: `${skills[key] ?? 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="gw-two-col">
        {/* Resumo semana */}
        <Card>
          <SectionHeader title="Resumo da semana" />
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <Ring
              value={(weeklyDone / weeklyGoal) * 100}
              label={`${weeklyDone}/${weeklyGoal}`}
              sub="aulas"
              color="var(--accent)"
            />
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <MiniStat value={String(weekAttempts.length)} label="Exercícios" tone="green" />
              <MiniStat value={`${weekAccuracy}%`} label="Acerto" tone="blue" />
              <MiniStat value={fmtNum(xp)} label="XP total" tone="violet" />
              <MiniStat value={`+${weekXp}`} label="XP na semana" tone="amber" />
            </div>
          </div>
        </Card>

        {/* Últimos exercícios */}
        <Card>
          <SectionHeader
            title="Últimos exercícios"
            action={
              <Link href="/student/exercises">
                <Button variant="ghost" size="sm">
                  Praticar
                </Button>
              </Link>
            }
          />
          <div className="gw-list">
            {recentAttempts.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>Nenhuma tentativa ainda.</p>
            ) : (
              recentAttempts.map((a) => (
                <div key={a.id} className="gw-row">
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: "var(--r-sm)",
                      background: a.isCorrect ? "var(--success-soft)" : "var(--danger-soft)",
                      color: a.isCorrect ? "var(--success)" : "var(--danger)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {a.isCorrect ? <Check size={18} strokeWidth={2} /> : <RefreshCw size={18} strokeWidth={2} />}
                  </div>
                  <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
                    {a.exercise.title}
                  </div>
                  <Badge tone={a.isCorrect ? "green" : "red"}>{a.isCorrect ? `+${a.score} pts` : "Refazer"}</Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
