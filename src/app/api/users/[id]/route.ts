import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ApiError, withErrorHandler } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { UpdateUserSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/users/[id] — trocar role, ativar/desativar, senha temporária.
 * Guardas: admin não rebaixa nem desativa a si mesmo (anti-lockout).
 */
export const PATCH = withErrorHandler(async (req: NextRequest, ctx) => {
  const session = await requireAdmin();
  const { id } = await (ctx as Ctx).params;

  const parsed = UpdateUserSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const { role, isActive, password, profileId } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!target) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  if (!isStaffRole(target.role)) {
    throw new ApiError(
      400,
      "Esta área gerencia somente a equipe interna. Consulte Alunos ou Pré-matrículas para este cadastro."
    );
  }

  // Anti-lockout: ninguém tira o próprio acesso/poder.
  if (id === session.user.id && role !== undefined && role !== "ADMIN") {
    throw new ApiError(400, "Você não pode rebaixar a si mesmo");
  }
  if (id === session.user.id && isActive === false) {
    throw new ApiError(400, "Você não pode desativar a si mesmo");
  }
  // Anti-lockout: admin não restringe o próprio acesso por perfil.
  if (id === session.user.id && profileId) {
    throw new ApiError(400, "Você não pode aplicar um perfil restrito a si mesmo");
  }
  // Perfil precisa existir (null = remover perfil = dono).
  if (profileId) {
    const exists = await prisma.accessProfile.findUnique({ where: { id: profileId }, select: { id: true } });
    if (!exists) throw new ApiError(400, "Perfil inválido");
  }

  // Demoção de ADMIN limpa o perfil: senão um perfil restritivo "stale" reaplicaria numa
  // futura re-promoção a ADMIN (perfil só faz sentido p/ ADMIN).
  const demoting = role !== undefined && role !== "ADMIN";

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(role !== undefined ? { role } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(password !== undefined ? { password: await bcrypt.hash(password, 10) } : {}),
      ...(demoting ? { profileId: null } : profileId !== undefined ? { profileId } : {}),
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  if (profileId !== undefined) {
    await audit({
      userId: session.user.id,
      action: "ASSIGN_PROFILE",
      entity: "User",
      entityId: id,
      payload: { profileId },
    });
  }

  // Só registra UPDATE_USER quando role/isActive/senha mudaram (evita linha de auditoria
  // redundante num PATCH que só troca o perfil — esse já gera ASSIGN_PROFILE).
  if (role !== undefined || isActive !== undefined || password !== undefined) {
    await audit({
      userId: session.user.id,
      action: "UPDATE_USER",
      entity: "User",
      entityId: id,
      // payload nunca inclui a senha
      payload: { role: role ?? null, isActive: isActive ?? null, passwordChanged: password !== undefined },
    });
  }

  return NextResponse.json(user);
});
