import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, Badge, Avatar } from "@/components/gw/primitives";
import { Button } from "@/components/ui/button";
import { getInitials, formatDate } from "@/lib/utils";
import { fmtCents } from "@/lib/money";
import { Plus } from "lucide-react";

const STATUS: Record<string, { label: string; tone: string }> = {
  ACTIVE: { label: "Ativa", tone: "green" },
  SUSPENDED: { label: "Suspensa", tone: "amber" },
  CANCELLED: { label: "Cancelada", tone: "red" },
  COMPLETED: { label: "Concluída", tone: "slate" },
};

export default async function EnrollmentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== "ADMIN") redirect("/login");

  const statusFilter = (await searchParams)?.status;
  const enrollments = await prisma.enrollment.findMany({
    where: statusFilter ? { status: statusFilter as never } : {},
    include: { student: true, plan: true, payments: { orderBy: { dueDate: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/admin/enrollments"><Button variant={!statusFilter ? "default" : "outline"} size="sm">Todas</Button></Link>
          {Object.entries(STATUS).map(([k, v]) => (
            <Link key={k} href={`/admin/enrollments?status=${k}`}>
              <Button variant={statusFilter === k ? "default" : "outline"} size="sm">{v.label}</Button>
            </Link>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <Link href="/admin/enrollments/new"><Button variant="accent"><Plus size={17} /> Nova matrícula</Button></Link>
      </div>

      <Card pad={false}>
        <table className="gw-table">
          <thead>
            <tr><th>Aluno</th><th>Plano</th><th>Início</th><th>Mensalidade</th><th>Últ. pgto.</th><th>Status</th></tr>
          </thead>
          <tbody>
            {enrollments.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>Nenhuma matrícula encontrada.</td></tr>
            ) : (
              enrollments.map((e) => {
                const monthly = e.plan.price - e.discount; // centavos
                const last = e.payments[0];
                return (
                  <tr key={e.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                        <Avatar initials={getInitials(e.student.name)} size={36} tone="seed" />
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{e.student.name}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>{e.student.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{e.plan.name}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{e.plan.lessonsPerMonth}x/mês · {e.plan.lessonDurationMin}min</div>
                    </td>
                    <td><span style={{ fontSize: 13, color: "var(--ink-2)" }}>{formatDate(e.startDate)}</span></td>
                    <td>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{fmtCents(monthly)}</div>
                      {e.discount > 0 && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Desc: {fmtCents(e.discount)}</div>}
                    </td>
                    <td>{last ? <Badge tone={last.status === "PAID" ? "green" : "amber"} dot>{last.month}/{last.year}</Badge> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                    <td><Badge tone={STATUS[e.status]?.tone ?? "slate"} dot>{STATUS[e.status]?.label ?? e.status}</Badge></td>
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
