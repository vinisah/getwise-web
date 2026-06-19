import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/** GET /api/notifications — últimas 20 do usuário REAL + contagem de não lidas. */
export const GET = withErrorHandler(async () => {
  const session = await requireAuth();
  try {
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.notification.count({ where: { userId: session.user.id, readAt: null } }),
    ]);
    return NextResponse.json({ items, unread });
  } catch {
    // Degrada p/ vazio (ex.: tabela ainda não migrada no Neon = deploy antes do db push) —
    // o sino é secundário; evita 500 a cada page load. Gate: db push no Neon antes do deploy.
    return NextResponse.json({ items: [], unread: 0 });
  }
});
