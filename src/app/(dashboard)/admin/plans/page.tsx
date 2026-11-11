import { getCachedSession } from "@/lib/effective-user";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/gw/primitives";
import { fmtCents } from "@/lib/money";
import { Check } from "lucide-react";
import { AdjustPlansButton } from "./adjust-button";

export default async function PlansPage() {
  const session = await getCachedSession();
  if ((session?.user as { role?: string })?.role !== "ADMIN") redirect("/login");

  const plans = await prisma.plan.findMany({
    include: { _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
    orderBy: { price: "asc" },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}
      >
        <p style={{ fontSize: 13.5, color: "var(--muted)" }}>
          Reajuste vale para novas matrículas — as existentes mantêm o valor contratado até renovar.
        </p>
        <AdjustPlansButton />
      </div>

      {plans.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>Nenhum plano cadastrado.</Card>
      ) : (
        <div className="gw-cards-grid">
          {plans.map((p) => {
            const features = Array.isArray(p.features) ? (p.features as string[]) : [];
            return (
              <div key={p.id} className="gw-card gw-plan-card">
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {p.lessonsPerMonth} aulas/mês · {p.lessonDurationMin}min
                    </div>
                  </div>
                  <Badge tone={p.isActive ? "green" : "slate"} dot>
                    {p._count.enrollments} ativo(s)
                  </Badge>
                </div>
                <div style={{ marginTop: 14 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.02em" }}>
                    {fmtCents(p.price)}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}> /mês</span>
                </div>
                {p.description && (
                  <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 10 }}>{p.description}</p>
                )}
                {features.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      borderTop: "1px solid var(--line)",
                      marginTop: 14,
                      paddingTop: 14,
                    }}
                  >
                    {features.map((f, i) => (
                      <div
                        key={i}
                        style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "var(--ink-2)" }}
                      >
                        <Check size={15} color="var(--success)" strokeWidth={2.4} /> {f}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
