import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandler } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const Schema = z.object({ id: z.string().min(1).optional() });

/**
 * POST /api/notifications/read — marca lida. {id} marca uma (escopada ao próprio userId →
 * IDOR-safe); sem id marca todas as não lidas do usuário.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAuth();
  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const where = parsed.data.id
    ? { id: parsed.data.id, userId: session.user.id }
    : { userId: session.user.id, readAt: null };

  await prisma.notification.updateMany({ where, data: { readAt: new Date() } });
  return NextResponse.json({ ok: true });
});
