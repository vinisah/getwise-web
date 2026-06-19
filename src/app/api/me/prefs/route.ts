import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withErrorHandler } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { normalizePrefs } from "@/lib/theme";
import { prisma } from "@/lib/prisma";

/**
 * Persiste as preferências de aparência (tema) do usuário logado.
 * A fonte ao vivo é o cookie (SSR sem flash); isto guarda no DB para futuro uso cross-device.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAuth();
  const prefs = normalizePrefs(await req.json().catch(() => ({})));
  await prisma.user.update({
    where: { id: session.user.id },
    data: { uiPrefs: prefs as unknown as Prisma.InputJsonObject },
  });
  return NextResponse.json({ ok: true, prefs });
});

/** Lê as preferências salvas (hidratação cross-device quando o device ainda não tem cookie). */
export const GET = withErrorHandler(async () => {
  const session = await requireAuth();
  const u = await prisma.user.findUnique({ where: { id: session.user.id }, select: { uiPrefs: true } });
  return NextResponse.json({ prefs: u?.uiPrefs ? normalizePrefs(u.uiPrefs) : null });
});
