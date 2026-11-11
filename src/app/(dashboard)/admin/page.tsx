import { getCachedSession } from "@/lib/effective-user";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, SectionHeader, Badge, Avatar, Legend } from "@/components/gw/primitives";
import { BarChart, Donut } from "@/components/gw/charts";
import { Button } from "@/components/ui/button";
import { fmtNum, getInitials, formatDateTime, monthRangeBrasilia } from "@/lib/utils";
import { fmtCents } from "@/lib/money";
import { calcPayroll } from "@/lib/payroll";
import { Users, GraduationCap, TrendingUp, Wallet, Calendar, ArrowRight, Repeat, AlertCircle, Banknote, Scale, FileBarChart } from "lucide-react";

const DONUT_COLORS = ["#2A5CD6", "#1C9C6B", "#C98A12", "#6A53CC", "#D2382B", "#16204E"];

const PAY_TONE: Record<string, { label: string; tone: string }> = {
  PAID: { label: "Pago", tone: "green" },
  PENDING: { label: "Pendente", tone: "amber" },
  FAILED: { label: "Falhou", tone: "red" },
  REFUNDED: { label: "Estornado", tone: "slate" },
};

export default async function AdminDashboard() {
  const session = await getCachedSession();
  if ((session?.user as { role?: string })?.role !== "ADMIN") redirect("/login");

  const now = new Date();
  const { gte: firstDay, lte: lastDay } = monthRangeBrasilia(now.getFullYear(), now.getMonth() + 1);

  // Todas as queries do dashboard são independentes → uma única ida ao banco
  // (antes: 3 Promise.all em série = 3 RTTs no caminho crítico).
  const [
    totalStudents, activeEnrollments, monthlyIncome, monthlyExpenses, upcomingLessons,
    recentPayments, sixMonthsTx, planStats,
    activeEnrollmentList, overduePayments, activeEmployees,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.enrollment.count({ where: { status: "ACTIVE" } }),
    prisma.financialTransaction.aggregate({ where: { type: "INCOME", date: { gte: firstDay, lte: lastDay }, isPaid: true }, _sum: { amount: true } }),
    prisma.financialTransaction.aggregate({ where: { type: "EXPENSE", date: { gte: firstDay, lte: lastDay }, isPaid: true }, _sum: { amount: true } }),
    prisma.lesson.findMany({
      where: { scheduledAt: { gte: now }, status: "SCHEDULED" },
      include: { teacher: true, bookings: true },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
    prisma.payment.findMany({ include: { student: true }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.financialTransaction.findMany({
      where: { date: { gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) }, isPaid: true },
      select: { type: true, amount: true, date: true },
    }),
    // Donut: nome + nº de matrículas ativas por plano numa query só (sem groupBy + lookup dependente).
    prisma.plan.findMany({ select: { id: true, name: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } } }),
    // KPIs do dono
    prisma.enrollment.findMany({ where: { status: "ACTIVE" }, select: { discount: true, plan: { select: { price: true } } } }),
    prisma.payment.aggregate({ where: { status: "PENDING", dueDate: { lt: now } }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.employee.findMany({ where: { isActive: true }, select: { salary: true, dependents: true, contractType: true } }),
  ]);

  const mrr = activeEnrollmentList.reduce((s, e) => s + (e.plan.price - e.discount), 0);
  const overdueAmount = overduePayments._sum.amount ?? 0;
  const overdueCount = overduePayments._count._all;
  const payrollCost = activeEmployees.reduce(
    (s, e) => s + calcPayroll(e.salary, e.dependents, e.contractType).employerCost, 0);
  const margin = mrr - payrollCost;

  // Valores em centavos (Int) — soma exata.
  const income = monthlyIncome._sum.amount ?? 0;
  const expenses = monthlyExpenses._sum.amount ?? 0;
  const balance = income - expenses;

  // Série 6 meses (em milhares de R$ → centavos / 100_000)
  const months: { m: string; in: number; out: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
    const inSum = sixMonthsTx
      .filter((t) => t.type === "INCOME" && t.date.getMonth() === d.getMonth() && t.date.getFullYear() === d.getFullYear())
      .reduce((s, t) => s + t.amount, 0);
    const outSum = sixMonthsTx
      .filter((t) => t.type === "EXPENSE" && t.date.getMonth() === d.getMonth() && t.date.getFullYear() === d.getFullYear())
      .reduce((s, t) => s + t.amount, 0);
    months.push({ m: label, in: Math.round(inSum / 100_000), out: Math.round(outSum / 100_000) });
  }
  const hasFinSeries = months.some((m) => m.in > 0 || m.out > 0);

  // Donut matrículas por plano (só planos com matrícula ativa)
  const donutData = planStats
    .filter((p) => p._count.enrollments > 0)
    .map((p, i) => ({
      name: p.name,
      value: p._count.enrollments,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
    }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div className="gw-stats-grid">
        <StatCard label="Total de alunos" value={fmtNum(totalStudents)} sub="cadastrados no sistema" icon={Users} tone="blue" spark={[210, 218, 224, 230, 239, totalStudents || 248]} />
        <StatCard label="Matrículas ativas" value={fmtNum(activeEnrollments)} sub="alunos matriculados" icon={GraduationCap} tone="green" spark={[170, 176, 180, 184, 188, activeEnrollments || 192]} />
        <StatCard label="Receita do mês" value={fmtCents(income)} sub="entradas confirmadas" icon={TrendingUp} tone="violet" spark={months.map((m) => m.in || 1)} />
        <StatCard label="Despesas do mês" value={fmtCents(expenses)} sub={`Saldo ${fmtCents(balance)}`} icon={Wallet} tone="amber" spark={months.map((m) => m.out || 1)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--gap)" }}>
        {[
          { icon: Repeat, label: "MRR (mensalidades ativas)", value: fmtCents(mrr), color: "var(--accent)", bg: "var(--accent-soft)", href: "/admin/enrollments" },
          { icon: AlertCircle, label: `Inadimplência (${overdueCount} venc.)`, value: fmtCents(overdueAmount), color: overdueAmount > 0 ? "var(--danger)" : "var(--success)", bg: overdueAmount > 0 ? "var(--danger-soft)" : "var(--success-soft)", href: "/admin/receivables" },
          { icon: Banknote, label: "Folha (custo real/mês)", value: fmtCents(payrollCost), color: "var(--brand)", bg: "var(--accent-soft)", href: "/admin/payroll" },
          { icon: Scale, label: "Margem (MRR − folha)", value: fmtCents(margin), color: margin >= 0 ? "var(--success)" : "var(--danger)", bg: margin >= 0 ? "var(--success-soft)" : "var(--danger-soft)", href: "/admin/financial" },
        ].map((k) => (
          <Link key={k.label} href={k.href} style={{ textDecoration: "none" }}>
            <Card className="gw-stat" style={{ padding: "var(--stat-pad)" }}>
              <div className="gw-stat-ic" style={{ background: k.bg, color: k.color }}>
                <k.icon size={20} strokeWidth={1.9} />
              </div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600, marginTop: 14 }}>{k.label}</div>
              <div className="gw-stat-val" style={{ color: k.color }}>{k.value}</div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="gw-two-col">
        <Card style={{ display: "flex", flexDirection: "column" }}>
          <SectionHeader
            title="Receita x Despesa"
            sub="Últimos 6 meses · em milhares (R$)"
            action={
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <Legend color="var(--accent)" label="Receita" />
                <Legend color="var(--line)" label="Despesa" border />
              </div>
            }
          />
          {hasFinSeries ? (
            <BarChart data={months} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, minHeight: 200, textAlign: "center", gap: 8 }}>
              <FileBarChart size={32} color="var(--muted)" />
              <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)" }}>Sem movimentação nos últimos 6 meses</p>
              <p style={{ fontSize: 12.5, color: "var(--muted)", maxWidth: 280 }}>
                Marque mensalidades como pagas ou registre transações no <Link href="/admin/financial" style={{ color: "var(--accent)" }}>Financeiro</Link> para popular o gráfico.
              </p>
            </div>
          )}
        </Card>

        <Card>
          <SectionHeader title="Matrículas por plano" sub="Distribuição ativa" />
          {donutData.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Nenhuma matrícula ativa.</p>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <Donut data={donutData} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 11 }}>
                {donutData.map((c) => (
                  <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: c.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "var(--ink-2)", flex: 1 }}>{c.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{c.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="gw-two-col">
        <Card>
          <SectionHeader title="Próximas aulas" action={<Link href="/admin/lessons"><Button variant="ghost" size="sm">Ver agenda <ArrowRight size={15} /></Button></Link>} />
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
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.title}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Prof. {l.teacher.name} · {l.bookings.length} aluno(s)</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{formatDateTime(l.scheduledAt)}</div>
                    <Badge tone="blue" style={{ marginTop: 4 }}>{l.duration}min</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <SectionHeader title="Pagamentos recentes" action={<Link href="/admin/financial"><Button variant="ghost" size="sm">Financeiro <ArrowRight size={15} /></Button></Link>} />
          <div className="gw-list">
            {recentPayments.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>Nenhum pagamento registrado.</p>
            ) : (
              recentPayments.map((p) => {
                const st = PAY_TONE[p.status] ?? PAY_TONE.PENDING;
                return (
                  <div key={p.id} className="gw-row">
                    <Avatar initials={getInitials(p.student.name)} size={40} tone="seed" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{p.student.name}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Mensalidade · {p.month}/{p.year}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{fmtCents(p.amount)}</div>
                      <Badge tone={st.tone} dot style={{ marginTop: 4 }}>{st.label}</Badge>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
