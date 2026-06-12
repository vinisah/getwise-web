import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/gw/primitives";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight } from "lucide-react";

const LEVEL_LABELS: Record<string, string> = {
  A1: "A1 — Iniciante", A2: "A2 — Básico", B1: "B1 — Intermediário",
  B2: "B2 — Inter. Avançado", C1: "C1 — Avançado", C2: "C2 — Proficiente",
};

export default async function AdminCoursesPage() {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== "ADMIN") redirect("/login");

  const courses = await prisma.course.findMany({
    orderBy: [{ order: "asc" }, { level: "asc" }],
    include: { _count: { select: { modules: true } } },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Link href="/admin/courses/new"><Button variant="accent"><Plus size={17} /> Novo curso</Button></Link>
      </div>

      <Card pad={false}>
        <table className="gw-table">
          <thead>
            <tr><th>Curso</th><th>Nível</th><th>Módulos</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {courses.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>Nenhum curso cadastrado.</td></tr>
            ) : (
              courses.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{c.title}</div>
                    {c.description && <div style={{ fontSize: 12, color: "var(--muted)", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.description}</div>}
                  </td>
                  <td><Badge tone="slate">{LEVEL_LABELS[c.level]}</Badge></td>
                  <td><span style={{ fontSize: 13, color: "var(--ink-2)" }}>{c._count.modules}</span></td>
                  <td><Badge tone={c.isActive ? "green" : "slate"} dot>{c.isActive ? "Ativo" : "Inativo"}</Badge></td>
                  <td style={{ textAlign: "right" }}>
                    <Link href={`/admin/courses/${c.id}`}><button className="gw-icon-btn sm"><ChevronRight size={18} /></button></Link>
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
