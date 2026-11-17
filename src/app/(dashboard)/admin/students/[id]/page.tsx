import { getCachedSession } from "@/lib/effective-user";

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, Badge, Avatar } from "@/components/gw/primitives";
import { Button } from "@/components/ui/button";
import { getInitials, formatDateTime } from "@/lib/utils";
import { fmtCents } from "@/lib/money";
import { studentFrequency } from "@/lib/services/attendance";
import { ArrowLeft, Mail, Phone, GraduationCap, Calendar, Receipt } from "lucide-react";

const LEVEL_LABELS: Record<string, string> = {
  A1: "A1 — Iniciante",
  A2: "A2 — Básico",
  B1: "B1 — Intermediário",
  B2: "B2 — Inter. Avançado",
  C1: "C1 — Avançado",
  C2: "C2 — Proficiente",
};

const PAY_TONE: Record<string, { label: string; tone: string }> = {
  PAID: { label: "Pago", tone: "green" },
  PENDING: { label: "Pendente", tone: "amber" },
  FAILED: { label: "Falhou", tone: "red" },
  REFUNDED: { label: "Estornado", tone: "slate" },
};

const LESSON_TONE: Record<string, { label: string; tone: string }> = {
  SCHEDULED: { label: "Agendada", tone: "blue" },
  IN_PROGRESS: { label: "Em andamento", tone: "amber" },
  COMPLETED: { label: "Concluída", tone: "green" },
  CANCELLED: { label: "Cancelada", tone: "red" },
};

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCachedSession();
  if ((session?.user as { role?: string })?.role !== "ADMIN") redirect("/login");

  const { id } = await params;
  const student = await prisma.user.findUnique({
    where: { id },
    include: {
      approvedApplications: {
        select: {
          id: true,
          schoolUnit: { select: { name: true } },
          course: { select: { title: true } },
          applicant: { select: { name: true, email: true, phone: true } },
        },
        take: 10,
      },
      studentProfile: true,
      enrollments: {
        include: {
          plan: true,
          payments: { orderBy: [{ year: "desc" }, { month: "desc" }], take: 6 },
        },
        orderBy: { createdAt: "desc" },
      },
      lessonBookings: {
        include: { lesson: { include: { teacher: { select: { name: true } } } } },
        orderBy: { lesson: { scheduledAt: "desc" } },
        take: 8,
      },
    },
  });

  if (!student || student.role !== "STUDENT") notFound();

  const freq = await studentFrequency(id);
  const activeEnrollment = student.enrollments.find((e) => e.status === "ACTIVE");
  const recentPayments = student.enrollments
    .flatMap((e) => e.payments)
    .sort((a, b) => b.year - a.year || b.month - a.month)
    .slice(0, 6);

  const labelStyle = { fontSize: 12, color: "var(--muted)", fontWeight: 600 } as const;
  const valueStyle = { fontSize: 13.5, color: "var(--ink)" } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/admin/students">
          <Button variant="ghost" size="icon">
            <ArrowLeft size={16} />
          </Button>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar initials={getInitials(student.name)} size={44} tone="seed" />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>{student.name}</h1>
              {student.studentProfile && (
                <Badge tone="slate">{LEVEL_LABELS[student.studentProfile.level] ?? student.studentProfile.level}</Badge>
              )}
              <Badge tone={student.isActive ? "green" : "red"} dot>
                {student.isActive ? "Ativo" : "Inativo"}
              </Badge>
              {freq.percent != null && (
                <Badge tone={freq.percent >= 75 ? "green" : "amber"}>Freq. {freq.percent}%</Badge>
              )}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
              Aluno desde {new Intl.DateTimeFormat("pt-BR").format(student.createdAt)}
            </div>
          </div>
        </div>
      </div>

      {student.approvedApplications.length > 0 && (
        <Card>
          <h2 style={{ fontWeight: 700, marginBottom: 12 }}>Origem da matrícula e contato</h2>
          {student.approvedApplications.map((a) => (
            <div key={a.id} style={{ marginBottom: 12 }}>
              <p>
                {a.schoolUnit.name} · {a.course.title}
              </p>
              <p style={{ color: "var(--muted)" }}>
                Conta de contato: {a.applicant.name} · {a.applicant.email} · {a.applicant.phone}
              </p>
              <Link href={`/admin/pre-enrollments/${a.id}`} style={{ color: "var(--accent)" }}>
                Ver ficha de pré-matrícula
              </Link>
            </div>
          ))}
        </Card>
      )}
      <div className="gw-two-col">
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 14 }}>Dados</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Mail size={15} color="var(--muted)" />
              <div>
                <div style={labelStyle}>E-mail</div>
                <div style={valueStyle}>
                  {student.email.endsWith("@students.getwise.invalid")
                    ? (student.approvedApplications[0]?.applicant.email ?? "Consultar responsável")
                    : student.email}
                </div>
              </div>
            </div>
            {student.phone && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Phone size={15} color="var(--muted)" />
                <div>
                  <div style={labelStyle}>Telefone</div>
                  <div style={valueStyle}>{student.phone}</div>
                </div>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <GraduationCap size={15} color="var(--muted)" />
              <div>
                <div style={labelStyle}>Plano atual</div>
                <div style={valueStyle}>
                  {activeEnrollment
                    ? `${activeEnrollment.plan.name} — ${fmtCents(activeEnrollment.plan.price - activeEnrollment.discount)}/mês`
                    : "Sem matrícula ativa"}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              fontWeight: 700,
              color: "var(--ink)",
              marginBottom: 14,
            }}
          >
            <Receipt size={15} color="var(--muted)" /> Pagamentos recentes
          </div>
          {recentPayments.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Nenhum pagamento registrado.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentPayments.map((p) => {
                const st = PAY_TONE[p.status] ?? PAY_TONE.PENDING;
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
                      {String(p.month).padStart(2, "0")}/{p.year}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>
                        {fmtCents(p.amountPaid ?? p.amount)}
                      </span>
                      <Badge tone={st.tone} dot>
                        {st.label}
                      </Badge>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card pad={false}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            fontWeight: 700,
            color: "var(--ink)",
            padding: "16px 16px 0",
          }}
        >
          <Calendar size={15} color="var(--muted)" /> Aulas
        </div>
        <table className="gw-table">
          <thead>
            <tr>
              <th>Aula</th>
              <th>Professor</th>
              <th>Data/Hora</th>
              <th>Presença</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {student.lessonBookings.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
                  Nenhuma aula vinculada.
                </td>
              </tr>
            ) : (
              student.lessonBookings.map((b) => {
                const st = LESSON_TONE[b.lesson.status] ?? LESSON_TONE.SCHEDULED;
                return (
                  <tr key={b.id}>
                    <td>
                      <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{b.lesson.title}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: 13, color: "var(--ink-2)" }}>{b.lesson.teacher.name}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
                        {formatDateTime(b.lesson.scheduledAt)}
                      </span>
                    </td>
                    <td>
                      {b.attendance == null ? (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      ) : (
                        <Badge tone={b.attendance ? "green" : "red"}>{b.attendance ? "Presente" : "Ausente"}</Badge>
                      )}
                    </td>
                    <td>
                      <Badge tone={st.tone} dot>
                        {st.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
