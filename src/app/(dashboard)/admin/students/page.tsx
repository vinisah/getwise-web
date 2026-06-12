import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, Badge, Avatar } from "@/components/gw/primitives";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";
import { Search, Plus, ChevronRight } from "lucide-react";

const LEVEL_LABELS: Record<string, string> = {
  A1: "A1 — Iniciante",
  A2: "A2 — Básico",
  B1: "B1 — Intermediário",
  B2: "B2 — Inter. Avançado",
  C1: "C1 — Avançado",
  C2: "C2 — Proficiente",
};

export default async function StudentsPage({ searchParams }: { searchParams: { search?: string } }) {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== "ADMIN") redirect("/login");

  const search = searchParams?.search ?? "";

  const students = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] } : {}),
    },
    include: { studentProfile: true, enrollments: { where: { status: "ACTIVE" }, include: { plan: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <form method="GET" className="gw-search" style={{ flex: 1, maxWidth: 360 }}>
          <Search size={17} color="var(--muted)" />
          <input name="search" defaultValue={search} placeholder="Buscar aluno..." />
        </form>
        <div style={{ flex: 1 }} />
        <Link href="/admin/students/new">
          <Button variant="accent"><Plus size={17} /> Novo aluno</Button>
        </Link>
      </div>

      <Card pad={false}>
        <table className="gw-table">
          <thead>
            <tr>
              <th>Aluno</th>
              <th>Nível</th>
              <th>Plano</th>
              <th>Cadastro</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>Nenhum aluno encontrado.</td>
              </tr>
            ) : (
              students.map((s) => {
                const enr = s.enrollments[0];
                return (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                        <Avatar initials={getInitials(s.name)} size={36} tone="seed" />
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{s.name}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>{s.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span style={{ fontSize: 13, color: "var(--ink-2)" }}>{LEVEL_LABELS[s.studentProfile?.level ?? "A1"]}</span></td>
                    <td>{enr ? <Badge tone="green">{enr.plan.name}</Badge> : <Badge tone="slate">Sem plano</Badge>}</td>
                    <td><span style={{ fontSize: 13, color: "var(--ink-2)" }}>{new Intl.DateTimeFormat("pt-BR").format(s.createdAt)}</span></td>
                    <td style={{ textAlign: "right" }}>
                      <Link href={`/admin/students/${s.id}`}>
                        <button className="gw-icon-btn sm"><ChevronRight size={18} /></button>
                      </Link>
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
