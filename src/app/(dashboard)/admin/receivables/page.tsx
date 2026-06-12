import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, Badge, Avatar } from "@/components/gw/primitives";
import { Button } from "@/components/ui/button";
import { fmtCents } from "@/lib/money";
import { getInitials, formatDate } from "@/lib/utils";
import { MarkPaidButton } from "./mark-paid-button";
import { calcLateCharges } from "@/lib/billing";
import { FileDown } from "lucide-react";

type Filter = "ALL" | "PENDING" | "OVERDUE" | "PAID";

const BUCKETS = [
  { key: "1-30", label: "1–30 dias" },
  { key: "31-60", label: "31–60 dias" },
  { key: "61-90", label: "61–90 dias" },
  { key: "90+", label: "+90 dias" },
] as const;

export default async function ReceivablesPage({ searchParams }: { searchParams: { filter?: string } }) {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== "ADMIN") redirect("/login");

  const filter: Filter = (["ALL", "PENDING", "OVERDUE", "PAID"] as const).includes(searchParams?.filter as Filter)
    ? (searchParams!.filter as Filter)
    : "ALL";

  const payments = await prisma.payment.findMany({
    include: {
      student: { select: { id: true, name: true, email: true } },
      enrollment: { include: { plan: { select: { name: true } } } },
    },
    orderBy: { dueDate: "asc" },
  });

  const now = Date.now();
  const enriched = payments.map((p) => {
    const days = p.status === "PENDING" ? Math.floor((now - p.dueDate.getTime()) / 86_400_000) : 0;
    const bucket = days <= 0 ? null : days <= 30 ? "1-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";
    return { ...p, daysOverdue: Math.max(0, days), bucket };
  });

  const aging: Record<string, { amount: number; count: number }> = {
    "1-30": { amount: 0, count: 0 }, "31-60": { amount: 0, count: 0 },
    "61-90": { amount: 0, count: 0 }, "90+": { amount: 0, count: 0 },
  };
  let overdueTotal = 0;
  for (const p of enriched) {
    if (p.bucket) {
      aging[p.bucket].amount += p.amount;
      aging[p.bucket].count += 1;
      overdueTotal += p.amount;
    }
  }

  const visible = enriched.filter((p) => {
    if (filter === "PENDING") return p.status === "PENDING";
    if (filter === "OVERDUE") return p.bucket !== null;
    if (filter === "PAID") return p.status === "PAID";
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <p style={{ fontSize: 13.5, color: "var(--muted)" }}>
          Total vencido: <b style={{ color: overdueTotal > 0 ? "var(--danger)" : "var(--success)", fontSize: 15 }}>{fmtCents(overdueTotal)}</b>
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--gap)" }}>
        {BUCKETS.map((b) => (
          <Card key={b.key} style={{ borderLeft: `4px solid ${aging[b.key].count > 0 ? "var(--danger)" : "var(--line)"}` }}>
            <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600, marginBottom: 6 }}>
              Vencidas {b.label} ({aging[b.key].count})
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: aging[b.key].count > 0 ? "var(--danger)" : "var(--ink)", letterSpacing: "-.02em" }}>
              {fmtCents(aging[b.key].amount)}
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Link href="/admin/receivables"><Button variant={filter === "ALL" ? "default" : "outline"} size="sm">Todas</Button></Link>
        <Link href="/admin/receivables?filter=PENDING"><Button variant={filter === "PENDING" ? "default" : "outline"} size="sm">Pendentes</Button></Link>
        <Link href="/admin/receivables?filter=OVERDUE"><Button variant={filter === "OVERDUE" ? "destructive" : "outline"} size="sm">Vencidas</Button></Link>
        <Link href="/admin/receivables?filter=PAID"><Button variant={filter === "PAID" ? "success" : "outline"} size="sm">Pagas</Button></Link>
      </div>

      <Card pad={false}>
        <table className="gw-table">
          <thead>
            <tr><th>Aluno</th><th>Plano</th><th>Referência</th><th style={{ textAlign: "right" }}>Valor</th><th>Vencimento</th><th>Atraso</th><th>Status</th><th style={{ textAlign: "right" }}>Ações</th></tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>Nenhuma mensalidade aqui.</td></tr>
            ) : (
              visible.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <Avatar initials={getInitials(p.student.name)} size={36} tone="seed" />
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{p.student.name}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>{p.student.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><span style={{ fontSize: 13, color: "var(--ink-2)" }}>{p.enrollment?.plan.name ?? "—"}</span></td>
                  <td><span style={{ fontSize: 13, color: "var(--ink-2)" }}>{String(p.month).padStart(2, "0")}/{p.year}</span></td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>
                    {fmtCents(p.amount)}
                    {p.daysOverdue > 0 && (
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--danger)" }} title="Valor original + multa 2% + juros 1% a.m. pro-rata">
                        atualizado: {fmtCents(calcLateCharges(p.amount, p.daysOverdue).total)}
                      </div>
                    )}
                  </td>
                  <td><span style={{ fontSize: 13, color: "var(--ink-2)" }}>{formatDate(p.dueDate)}</span></td>
                  <td>
                    {p.daysOverdue > 0
                      ? <Badge tone={p.daysOverdue > 60 ? "red" : "amber"} dot>{p.daysOverdue}d</Badge>
                      : <span style={{ color: "var(--muted)" }}>—</span>}
                  </td>
                  <td>
                    <Badge tone={p.status === "PAID" ? "green" : p.bucket ? "red" : "amber"} dot>
                      {p.status === "PAID" ? "Paga" : p.bucket ? "Vencida" : "Pendente"}
                    </Badge>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                      {p.status === "PAID" && (
                        <a href={`/api/payments/${p.id}/receipt`} title="Baixar recibo PDF">
                          <Button variant="ghost" size="sm"><FileDown size={15} /> Recibo</Button>
                        </a>
                      )}
                      <MarkPaidButton paymentId={p.id} isPaid={p.status === "PAID"} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
