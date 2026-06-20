import { cache } from "react";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/types";

/**
 * "Ver como" (seletor de papel, admin-only): permite que um ADMIN opere o painel de
 * aluno/professor com os dados de um usuário-alvo, SEM trocar de conta e SEM elevar privilégio.
 *
 * Regras:
 * - Só ADMIN pode ativar (o cookie `gw_preview` só é setado por POST /api/admin/preview, requireAdmin).
 * - O effective user NUNCA é mais privilegiado que a sessão real (admin só "rebaixa" a visão p/ STUDENT/TEACHER).
 * - LEITURA e ESCRITA seguem a IDENTIDADE EFETIVA: as rotas de aluno (attempt/progress/video) operam
 *   sobre `eff.id`. No modo demo (login passwordless = único usuário é ADMIN) isso é necessário para
 *   o fluxo do aluno funcionar; em prod com logins reais, um aluno real é seu próprio effective user.
 */
export const PREVIEW_COOKIE = "gw_preview";

export interface EffectiveUser {
  id: string;
  name: string;
  role: UserRole;
  /** true quando um admin está visualizando como outro usuário. */
  isPreview: boolean;
  /** id real do admin (para auditoria), quando em preview. */
  realAdminId?: string;
}

/** Sessão deduplicada por request (React cache) — evita re-checar o JWT no DB várias vezes por página. */
export const getCachedSession = cache(async () => getServerSession(authOptions));

export const getEffectiveUser = cache(async (): Promise<EffectiveUser | null> => {
  const session = await getCachedSession();
  const self = session?.user as { id?: string; name?: string; role?: UserRole } | undefined;
  if (!self?.id) return null;

  const base: EffectiveUser = { id: self.id, name: self.name ?? "", role: self.role ?? "STUDENT", isPreview: false };

  // Só ADMIN pode estar em preview.
  if (self.role !== "ADMIN") return base;

  const targetId = (await cookies()).get(PREVIEW_COOKIE)?.value;
  if (!targetId || targetId === self.id) return base;

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, name: true, role: true, isActive: true },
  });
  // Alvo inválido/inativo → cai na visão do próprio admin (sem quebrar).
  if (!target || !target.isActive || target.role === "ADMIN") return base;

  return { id: target.id, name: target.name, role: target.role as UserRole, isPreview: true, realAdminId: self.id };
});

/**
 * Exige que o usuário EFETIVO seja STUDENT (aluno real OU admin "vendo como" aluno). Usado nas rotas
 * de escrita do aluno: com login passwordless (só ADMIN), exigir o role REAL deixaria o fluxo do aluno
 * inalcançável (403). A escrita usa o `eff.id` retornado.
 */
export async function requireEffectiveStudent(): Promise<EffectiveUser> {
  const eff = await getEffectiveUser();
  if (!eff) throw new ApiError(401, "Não autenticado");
  if (eff.role !== "STUDENT") throw new ApiError(403, "Acesso restrito a alunos");
  return eff;
}
