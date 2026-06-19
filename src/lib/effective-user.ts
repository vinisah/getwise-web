import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/types";

/**
 * "Ver como" (admin-only, read-only): permite que um ADMIN visualize o painel de aluno/professor
 * com os dados de um usuário-alvo, SEM trocar de conta e SEM elevar privilégio.
 *
 * Regras de segurança:
 * - Só ADMIN pode ativar (o cookie `gw_preview` só é setado por POST /api/admin/preview, requireAdmin).
 * - O effective user NUNCA é mais privilegiado que a sessão real (admin só "rebaixa" a visão p/ STUDENT/TEACHER).
 * - É só LEITURA: as rotas de mutação de aluno exigem o role REAL (requireRole STUDENT/TEACHER),
 *   então um admin em preview não consegue escrever dado do alvo.
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

export async function getEffectiveUser(): Promise<EffectiveUser | null> {
  const session = await getServerSession(authOptions);
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
}
