import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, Badge } from "@/components/gw/primitives";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

/** Grupos de filtro → prefixos de ação no audit log. */
const FILTERS: Record<string, { label: string; actions?: string[] }> = {
  ALL: { label: "Tudo" },
  FINANCE: {
    label: "Financeiro",
    actions: ["CREATE_TRANSACTION", "UPDATE_TRANSACTION", "DELETE_TRANSACTION", "CREATE_SALARY_PAYMENT", "PAYMENT_CREATED", "PAYMENT_UPDATED", "GENERATE_RECURRING", "ADJUST_PLANS"],
  },
  PEOPLE: {
    label: "Pessoas",
    actions: ["CREATE_STUDENT", "UPDATE_STUDENT", "DELETE_STUDENT", "CREATE_EMPLOYEE", "UPDATE_EMPLOYEE", "DELETE_EMPLOYEE", "CREATE_ENROLLMENT", "UPDATE_USER", "REGISTER"],
  },
  AUTH: { label: "Acesso", actions: ["LOGIN", "LOGOUT", "VERIFY_EMAIL", "PASSWORD_RESET"] },
  CONTENT: {
    label: "Conteúdo",
    actions: ["CREATE_COURSE", "UPDATE_COURSE", "DELETE_COURSE", "CREATE_MODULE", "UPDATE_MODULE", "DELETE_MODULE", "CREATE_UNIT", "UPDATE_UNIT", "DELETE_UNIT", "CREATE_EXERCISE", "ISSUE_CERTIFICATE"],
  },
};

export default async function AuditPage({ searchParams }: { searchParams: { filter?: string } }) {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== "ADMIN") redirect("/login");

  const filterKey = searchParams?.filter && FILTERS[searchParams.filter] ? searchParams.filter : "ALL";
  const actions = FILTERS[filterKey].actions;

  const logs = await prisma.auditLog.findMany({
    where: actions ? { action: { in: actions } } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Resolve nomes dos usuários (uma query)
  const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean))] as string[];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  const nameOf = (id: string | null) => (id ? users.find((u) => u.id === id)?.name ?? id.slice(-6) : "sistema");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <p style={{ fontSize: 13.5, color: "var(--muted)" }}>Últimas 100 ações registradas — trilha imutável de quem fez o quê.</p>
        <div style={{ display: "flex", gap: 8 }}>
          {Object.entries(FILTERS).map(([k, f]) => (
            <Link key={k} href={k === "ALL" ? "/admin/audit" : `/admin/audit?filter=${k}`}>
              <Button variant={filterKey === k ? "default" : "outline"} size="sm">{f.label}</Button>
            </Link>
          ))}
        </div>
      </div>

      <Card pad={false}>
        <table className="gw-table">
          <thead>
            <tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Entidade</th><th>Detalhes</th></tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>Nenhum registro.</td></tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id}>
                  <td><span style={{ fontSize: 12.5, color: "var(--ink-2)", whiteSpace: "nowrap" }}>{formatDateTime(l.createdAt)}</span></td>
                  <td><span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{nameOf(l.userId)}</span></td>
                  <td><Badge tone={l.action.startsWith("DELETE") ? "red" : l.action.startsWith("CREATE") ? "green" : "slate"}>{l.action}</Badge></td>
                  <td><span style={{ fontSize: 13, color: "var(--ink-2)" }}>{l.entity}{l.entityId ? ` · …${l.entityId.slice(-6)}` : ""}</span></td>
                  <td>
                    <span style={{ fontSize: 11.5, color: "var(--muted)", fontFamily: "monospace" }}>
                      {l.payload ? JSON.stringify(l.payload).slice(0, 80) : "—"}
                    </span>
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
