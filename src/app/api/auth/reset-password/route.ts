import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { withErrorHandler } from "@/lib/api-error";
import { ResetPasswordSchema } from "@/lib/schemas";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { audit, getClientIp } from "@/lib/audit";

export const POST = withErrorHandler(async (req: NextRequest) => {
  // Anti-brute-force de token (por IP).
  const ip = getClientIp(req);
  const rl = checkRateLimit(`reset:${ip}`, LIMITS.API_WRITE.max, LIMITS.API_WRITE.windowMs);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Muitas tentativas. Aguarde ${rl.retryAfter}s.` }, { status: 429 });
  }

  const parsed = ResetPasswordSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const { token, password } = parsed.data;

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!record || record.expires < new Date()) {
    return NextResponse.json({ error: "Token inválido ou expirado" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.update({
    where: { email: record.email },
    data: { password: hashed },
  });

  // Consome todos os tokens do e-mail (idempotência + segurança)
  await prisma.passwordResetToken.deleteMany({ where: { email: record.email } });

  await audit({ userId: user.id, action: "PASSWORD_RESET", entity: "User", entityId: user.id, payload: { passwordReset: true } });

  return NextResponse.json({ ok: true, message: "Senha redefinida com sucesso." });
});
