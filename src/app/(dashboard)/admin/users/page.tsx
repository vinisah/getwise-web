import { getCachedSession } from "@/lib/effective-user";

import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, Badge, Avatar } from "@/components/gw/primitives";
import { Button } from "@/components/ui/button";
import { getInitials, formatDate } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";
import { UserActions } from "./user-actions";
import { listStaffUsers } from "@/lib/staff-users";
import { adminCanAccess, firstAllowedRoute } from "@/lib/access";

const ROLE_BADGE: Record<string, { label: string; tone: string }> = {
  ADMIN: { label: "Administrativo", tone: "blue" },
  TEACHER: { label: "Professor", tone: "violet" },
};

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await getCachedSession();
  const me = session?.user;
  if (me?.role !== "ADMIN") redirect("/login");
  if (!adminCanAccess(me.profileSections, "users")) redirect(firstAllowedRoute(me.profileSections));
  const canManage = me.profileSections == null;

  const [result, profiles] = await Promise.all([
    listStaffUsers((await searchParams).page),
    canManage ? prisma.accessProfile.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
  ]);
  const { users, total, inactive, page, pages } = result;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)", minWidth: 0 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Equipe interna</h2>
        <p style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6 }}>
          Acessos de administradores, professores e funcionários. Secretaria, Comercial e Financeiro são definidos pelo
          perfil de acesso.
        </p>
        <nav
          aria-label="Cadastros de alunos e responsáveis"
          style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}
        >
          {adminCanAccess(me.profileSections, "students") && (
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/students">Alunos</Link>
            </Button>
          )}
          {adminCanAccess(me.profileSections, "pre-enrollments") && (
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/pre-enrollments">Pré-matrículas e responsáveis</Link>
            </Button>
          )}
        </nav>
      </div>
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}
      >
        <p style={{ fontSize: 13.5, color: "var(--muted)" }}>
          {total} acesso(s) da equipe · {inactive} desativado(s)
        </p>
        {canManage && (
          <Button asChild variant="outline">
            <Link href="/admin/profiles">
              <ShieldCheck size={16} /> Gerenciar perfis
            </Link>
          </Button>
        )}
      </div>

      <Card pad={false} style={{ minWidth: 0 }}>
        <div role="region" aria-label="Usuários da equipe" tabIndex={0} style={{ overflowX: "auto" }}>
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
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
                    Nenhum acesso da equipe encontrado.
                  </td>
                </tr>
              )}
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
                    {canManage ? (
                      <UserActions
                        userId={u.id}
                        role={u.role}
                        isActive={u.isActive}
                        isSelf={u.id === me?.id}
                        profileId={u.profileId}
                        profiles={profiles}
                      />
                    ) : (
                      <span style={{ color: "var(--muted)" }}>Somente consulta</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {pages > 1 && (
        <nav
          aria-label="Páginas da equipe"
          style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}
        >
          {page > 1 ? (
            <Button asChild variant="outline">
              <Link href={`/admin/users?page=${page - 1}`}>Anterior</Link>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Anterior
            </Button>
          )}
          <span>
            Página {page} de {pages}
          </span>
          {page < pages ? (
            <Button asChild variant="outline">
              <Link href={`/admin/users?page=${page + 1}`}>Próxima</Link>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Próxima
            </Button>
          )}
        </nav>
      )}

      <p style={{ fontSize: 12, color: "var(--muted)" }}>
        {canManage
          ? "Desativar bloqueia o acesso da conta. A senha temporária deve ser trocada pelo usuário."
          : "Alterações de acesso são reservadas ao administrador dono do sistema."}
      </p>
    </div>
  );
}
