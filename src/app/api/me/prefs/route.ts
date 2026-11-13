import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ApiError, withErrorHandler } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { normalizePrefs } from "@/lib/theme";
import { prisma } from "@/lib/prisma";
import { createHash } from "node:crypto";
import { preferencesUpdateSchema } from "@/lib/preferences";

function versionOf(raw: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(normalizePrefs(raw)))
    .digest("hex");
}

/**
 * Persiste as preferências pessoais da conta autenticada e detecta edições concorrentes.
 * O cookie antecipa a aparência no SSR; o banco é a fonte compartilhada entre dispositivos.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAuth();
  const parsed = preferencesUpdateSchema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message, fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  const { version, ...patch } = parsed.data;
  const current = await prisma.user.findUnique({ where: { id: session.user.id }, select: { uiPrefs: true } });
  if (!current) throw new ApiError(404, "Conta não encontrada.");
  const prefs = normalizePrefs({ ...normalizePrefs(current.uiPrefs), ...patch });
  // Retrying a request whose response was lost is safe if it already saved these values.
  if (versionOf(prefs) === versionOf(current.uiPrefs))
    return NextResponse.json({ ok: true, prefs, version: versionOf(prefs) });
  if (version && version !== versionOf(current.uiPrefs))
    throw new ApiError(
      409,
      "As preferências foram alteradas em outra aba. Carregue a versão salva antes de tentar novamente."
    );
  const saved = await prisma.user.updateMany({
    where: { id: session.user.id, uiPrefs: { equals: current.uiPrefs ?? Prisma.DbNull } },
    data: { uiPrefs: prefs as unknown as Prisma.InputJsonObject },
  });
  if (saved.count !== 1)
    throw new ApiError(
      409,
      "As preferências foram alteradas em outra aba. Carregue a versão salva antes de tentar novamente."
    );
  return NextResponse.json({ ok: true, prefs, version: versionOf(prefs) });
});

/** Lê as preferências salvas (hidratação cross-device quando o device ainda não tem cookie). */
export const GET = withErrorHandler(async () => {
  const session = await requireAuth();
  const u = await prisma.user.findUnique({ where: { id: session.user.id }, select: { uiPrefs: true } });
  if (!u) throw new ApiError(404, "Conta não encontrada.");
  return NextResponse.json({ prefs: normalizePrefs(u.uiPrefs), version: versionOf(u.uiPrefs) });
});
