import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, Badge, Avatar } from "@/components/gw/primitives";
import { Button } from "@/components/ui/button";
import { getInitials, formatDate } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";
import { UserActions } from "./user-actions";

const ROLE_BADGE: Record<string, { label: string; tone: string }> = {
  ADMIN: { label: "Admin", tone: "blue" },
  TEACHER: { label: "Professor", tone: "violet" },
  STUDENT: { label: "Aluno", tone: "slate" },
};

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  const me = session?.user as { id?: string; role?: string } | undefined;
  if (me?.role !== "ADMIN") redirect("/login");

  const [users, profiles] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        profileId: true,
        profile: { select: { name: true } },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    prisma.accessProfile.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}
      >
        <p style={{ fontSize: 13.5, color: "var(--muted)" }}>
          {users.length} usuário(s) · {users.filter((u) => !u.isActive).length} desativado(s)
        </p>
        <Link href="/admin/profiles">
          <Button variant="outline">
            <ShieldCheck size={16} /> Gerenciar perfis
          </Button>
        </Link>
      </div>

      <Card pad={false}>
        <table className="gw-table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Papel</th>
              <th>Perfil</th>
              <th>Criado em</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={!u.isActive ? { opacity: 0.55 } : undefined}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <Avatar initials={getInitials(u.name)} size={36} tone="seed" />
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
                        {u.name}
                        {u.id === me?.id && <span style={{ fontSize: 11, color: "var(--muted)" }}> (você)</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <Badge tone={ROLE_BADGE[u.role]?.tone ?? "slate"}>{ROLE_BADGE[u.role]?.label ?? u.role}</Badge>
                </td>
                <td>
                  {u.role !== "ADMIN" ? (
                    <span style={{ color: "var(--muted)" }}>—</span>
                  ) : (
                    <Badge tone={u.profile ? "blue" : "slate"}>{u.profile ? u.profile.name : "Dono (tudo)"}</Badge>
                  )}
                </td>
                <td>
                  <span style={{ fontSize: 13, color: "var(--ink-2)" }}>{formatDate(u.createdAt)}</span>
                </td>
                <td>
                  <Badge tone={u.isActive ? "green" : "red"} dot>
                    {u.isActive ? "Ativo" : "Desativado"}
                  </Badge>
                </td>
                <td style={{ textAlign: "right" }}>
                  <UserActions
                    userId={u.id}
                    role={u.role}
                    isActive={u.isActive}
                    isSelf={u.id === me?.id}
                    profileId={u.profileId}
                    profiles={profiles}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p style={{ fontSize: 12, color: "var(--muted)" }}>
        Desativar bloqueia o login imediatamente (sessões existentes expiram em até 7 dias). Senha temporária deve ser
        trocada pelo usuário.
      </p>
    </div>
  );
}
