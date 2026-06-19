import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandler } from "@/lib/api-error";
import { requireAdmin } from "@/lib/api-auth";
import { audit } from "@/lib/audit";
import { PREVIEW_COOKIE } from "@/lib/effective-user";
import { representativeUserId } from "@/lib/view-as";

const Schema = z.object({ role: z.enum(["ADMIN", "TEACHER", "STUDENT"]) });

/**
 * Seletor de papel do topbar (admin-only). Troca a "visão" do painel:
 * - role=ADMIN  → limpa o cookie gw_preview (volta à visão admin real).
 * - role=STUDENT/TEACHER → grava gw_preview (httpOnly) com o 1º usuário ativo desse papel.
 * getEffectiveUser() lê esse cookie; mutações de aluno seguem exigindo o role REAL.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAdmin();
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Papel inválido" }, { status: 400 });

  const res = NextResponse.json({ ok: true });
  const { role } = parsed.data;

  // Voltar à visão admin → expira o cookie de preview. Precisa do mesmo path ("/") com que
  // foi setado, senão o Set-Cookie de remoção não casa e o cookie persiste.
  if (role === "ADMIN") {
    res.cookies.set(PREVIEW_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
    return res;
  }

  const targetId = await representativeUserId(role);
  if (!targetId) {
    return NextResponse.json({ error: "Nenhum usuário ativo para esse papel" }, { status: 404 });
  }

  res.cookies.set(PREVIEW_COOKIE, targetId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 2, // 2h — visão é sessão curta de teste
  });
  await audit({ userId: session.user.id, action: "ADMIN_PREVIEW", entity: "User", entityId: targetId });
  return res;
});
