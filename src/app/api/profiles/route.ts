import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandler } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { ADMIN_SECTION_KEYS } from "@/lib/admin-sections";

const Schema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(60),
  sections: z.array(z.enum(ADMIN_SECTION_KEYS as [string, ...string[]])).min(1, "Escolha ao menos 1 seção"),
});

/** GET /api/profiles — lista perfis de acesso (com contagem de usuários). */
export const GET = withErrorHandler(async () => {
  await requireAdmin();
  const profiles = await prisma.accessProfile.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    include: { _count: { select: { users: true } } },
  });
  return NextResponse.json(profiles);
});

/** POST /api/profiles — cria perfil (admin). */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAdmin();
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const exists = await prisma.accessProfile.findUnique({ where: { name: parsed.data.name } });
  if (exists) return NextResponse.json({ error: "Já existe um perfil com esse nome" }, { status: 409 });

  const profile = await prisma.accessProfile.create({
    data: { name: parsed.data.name, sections: parsed.data.sections },
  });
  await audit({
    userId: session.user.id,
    action: "CREATE_PROFILE",
    entity: "AccessProfile",
    entityId: profile.id,
    payload: { name: profile.name },
  });
  return NextResponse.json(profile, { status: 201 });
});
