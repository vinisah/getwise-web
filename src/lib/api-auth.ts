import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { ApiError } from "./api-error";
import type { SessionUser, UserRole } from "@/types";

/**
 * Retorna a sessão autenticada ou lança ApiError(401).
 * Elimina o boilerplate `getServerSession + null check` repetido nas rotas.
 *
 * Revogação em tempo real (desativação/rebaixamento de role) é aplicada no callback
 * `jwt`/`session` do NextAuth (ver lib/auth.ts), que re-checa o DB a cada getServerSession.
 */
export async function requireAuth(...adminSections: string[]): Promise<{ user: SessionUser }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new ApiError(401, "Não autenticado");
  }
  if (session.user.role === "APPLICANT")
    throw new ApiError(403, "Sua conta tem acesso ao acompanhamento de pré-matrículas.");
  // As permissões vêm da sessão revalidada no banco, nunca do corpo da requisição.
  if (session.user.role === "ADMIN" && adminSections.length) {
    assertAdminSections(session.user, adminSections);
  }
  return session as { user: SessionUser };
}

/**
 * Exige ADMIN com uma das seções indicadas; sem seção exige dono (sem perfil restrito).
 */
export async function requireAdmin(...sections: string[]): Promise<{ user: SessionUser }> {
  const session = await requireAuth();
  if (session.user.role !== "ADMIN") {
    throw new ApiError(403, "Acesso restrito a administradores");
  }
  assertAdminSections(session.user, sections);
  return session;
}

/** Sem seção explícita, exige dono. Gerir privilégios/impersonar não é delegável. */
function assertAdminSections(user: SessionUser, sections: string[]): void {
  if (user.profileSections == null) return;
  if (!sections.some((section) => user.profileSections!.includes(section))) {
    throw new ApiError(403, "Seu perfil não tem permissão para esta operação");
  }
}

/**
 * Exige role específico; lança ApiError(403) caso contrário.
 */
export async function requireRole(role: UserRole): Promise<{ user: SessionUser }> {
  const session = await requireAuth();
  if (session.user.role !== role) {
    throw new ApiError(403, `Acesso restrito a usuários com papel ${role}`);
  }
  return session;
}

/**
 * Exige ADMIN ou o próprio usuário dono do recurso.
 * Útil para rotas onde admin pode tudo mas o aluno só acessa os próprios dados.
 */
export async function requireAdminOrSelf(resourceUserId: string): Promise<{ user: SessionUser }> {
  const session = await requireAuth();
  if (session.user.role !== "ADMIN" && session.user.id !== resourceUserId) {
    throw new ApiError(403, "Acesso negado");
  }
  return session;
}
