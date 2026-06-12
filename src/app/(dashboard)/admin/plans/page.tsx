import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/gw/primitives";
import { fmtCents } from "@/lib/money";
import { AdjustPlansButton } from "./adjust-button";

export default async function PlansPage() {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== "ADMIN") redirect("/login");

  const plans = await prisma.plan.findMany({
    include: { _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
    orderBy: { price: "asc" },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <p style={{ fontSize: 13.5, color: "var(--muted)" }}>
          Reajuste vale para novas matrículas — as existentes mantêm o valor contratado até renovar.
        </p>
        <AdjustPlansButton />
      </div>

      <Card pad={false}>
        <table className="gw-table">
          <thead>
            <tr><th>Plano</th><th>Descrição</th><th>Aulas/mês</th><th style={{ textAlign: "right" }}>Mensalidade</th><th>Matrículas ativas</th><th>Status</th></tr>
          </thead>
          <tbody>
            {plans.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>Nenhum plano cadastrado.</td></tr>
            ) : (
              plans.map((p) => (
                <tr key={p.id}>
                  <td><span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{p.name}</span></td>
                  <td><span style={{ fontSize: 13, color: "var(--ink-2)" }}>{p.description ?? "—"}</span></td>
                  <td><span style={{ fontSize: 13, color: "var(--ink-2)" }}>{p.lessonsPerMonth}x de {p.lessonDurationMin}min</span></td>
                  <td style={{ textAlign: "right", fontWeight: 700, fontSize: 14 }}>{fmtCents(p.price)}</td>
                  <td><Badge tone="blue">{p._count.enrollments}</Badge></td>
                  <td><Badge tone={p.isActive ? "green" : "slate"} dot>{p.isActive ? "Ativo" : "Inativo"}</Badge></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
