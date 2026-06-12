import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ApiError, withErrorHandler } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { UpdateUserSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";

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
  const { role, isActive, password } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!target) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  // Anti-lockout: ninguém tira o próprio acesso/poder.
  if (id === session.user.id && (role !== undefined && role !== "ADMIN")) {
    throw new ApiError(400, "Você não pode rebaixar a si mesmo");
  }
  if (id === session.user.id && isActive === false) {
    throw new ApiError(400, "Você não pode desativar a si mesmo");
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(role !== undefined ? { role } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(password !== undefined ? { password: await bcrypt.hash(password, 10) } : {}),
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  await audit({
    userId: session.user.id,
    action: "UPDATE_USER",
    entity: "User",
    entityId: id,
    // payload nunca inclui a senha
    payload: { role: role ?? null, isActive: isActive ?? null, passwordChanged: password !== undefined },
  });

  return NextResponse.json(user);
});
