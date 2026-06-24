import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandler, ApiError } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { ADMIN_SECTION_KEYS } from "@/lib/admin-sections";

type Ctx = { params: Promise<{ id: string }> };

const Schema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  sections: z
    .array(z.enum(ADMIN_SECTION_KEYS as [string, ...string[]]))
    .min(1)
    .optional(),
});

/** PATCH /api/profiles/[id] — edita nome/seções. */
export const PATCH = withErrorHandler(async (req: NextRequest, ctx) => {
  const session = await requireAdmin();
  const { id } = await (ctx as Ctx).params;

  const profile = await prisma.accessProfile.findUnique({ where: { id } });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });
  // Simétrico ao DELETE: perfis de sistema são imutáveis pela UI (renomear/trocar seções
  // afetaria todos os usuários atribuídos). Para ajustar, edite o seed.
  if (profile.isSystem) throw new ApiError(400, "Perfil de sistema não pode ser editado");

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  // Nome único (se mudou).
  if (parsed.data.name && parsed.data.name !== profile.name) {
    const dup = await prisma.accessProfile.findUnique({ where: { name: parsed.data.name } });
    if (dup) return NextResponse.json({ error: "Já existe um perfil com esse nome" }, { status: 409 });
  }

  const updated = await prisma.accessProfile.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.sections !== undefined ? { sections: parsed.data.sections } : {}),
    },
  });
  await audit({ userId: session.user.id, action: "UPDATE_PROFILE", entity: "AccessProfile", entityId: id });
  return NextResponse.json(updated);
});

/** DELETE /api/profiles/[id] — remove perfil (usuários ficam sem perfil = dono). Sistema não. */
export const DELETE = withErrorHandler(async (_req: NextRequest, ctx) => {
  const session = await requireAdmin();
  const { id } = await (ctx as Ctx).params;

  const profile = await prisma.accessProfile.findUnique({ where: { id } });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });
  if (profile.isSystem) throw new ApiError(400, "Perfil de sistema não pode ser apagado");

  // Bloqueia escalação silenciosa: onDelete:SetNull faria usuários deste perfil voltarem a
  // DONO (acesso total). Exige reatribuição antes de apagar (mesmo padrão 409-em-uso do repo).
  const inUse = await prisma.user.count({ where: { profileId: id } });
  if (inUse > 0) {
    throw new ApiError(409, `Perfil em uso por ${inUse} usuário(s). Reatribua antes de apagar.`);
  }

  await prisma.accessProfile.delete({ where: { id } });
  await audit({
    userId: session.user.id,
    action: "DELETE_PROFILE",
    entity: "AccessProfile",
    entityId: id,
    payload: { name: profile.name },
  });
  return NextResponse.json({ ok: true });
});
