import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

/**
 * GET /api/auth/verify-email?token=...
 * Valida token, marca emailVerified, consome token. Redireciona ao login.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = req.nextUrl.searchParams.get("token");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!token) {
    return NextResponse.redirect(`${appUrl}/login?verify=invalid`);
  }

  const record = await prisma.emailVerificationToken.findUnique({ where: { token } });

  if (!record || record.expires < new Date()) {
    return NextResponse.redirect(`${appUrl}/login?verify=expired`);
  }

  const user = await prisma.user.update({
    where: { email: record.email },
    data: { emailVerified: new Date() },
  });

  // Consome token (idempotência: não reutilizável)
  await prisma.emailVerificationToken.deleteMany({ where: { email: record.email } });

  await audit({ userId: user.id, action: "VERIFY_EMAIL", entity: "User", entityId: user.id, payload: { emailVerified: true } });

  return NextResponse.redirect(`${appUrl}/login?verify=success`);
});
