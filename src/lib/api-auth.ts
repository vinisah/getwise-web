import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { ApiError } from "./api-error";
import type { SessionUser, UserRole } from "@/types";

/**
 * Retorna a sessão autenticada ou lança ApiError(401).
 * Elimina o boilerplate `getServerSession + null check` repetido 19× nas rotas.
 */
export async function requireAuth(): Promise<{ user: SessionUser }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new ApiError(401, "Não autenticado");
  }
  return session as { user: SessionUser };
}

/**
 * Exige role ADMIN; lança ApiError(403) caso contrário.
 */
export async function requireAdmin(): Promise<{ user: SessionUser }> {
  const session = await requireAuth();
  if (session.user.role !== "ADMIN") {
    throw new ApiError(403, "Acesso restrito a administradores");
  }
  return session;
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
