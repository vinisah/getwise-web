import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/certificates — lista certificados do usuário logado.
 * Admin vê todos.
 */
export const GET = withErrorHandler(async (_req: NextRequest) => {
  const session = await requireAuth("courses");

  const where = session.user.role === "ADMIN" ? {} : { userId: session.user.id };
  const certificates = await prisma.certificate.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { course: { select: { title: true, level: true } } },
  });

  return NextResponse.json(certificates);
});
