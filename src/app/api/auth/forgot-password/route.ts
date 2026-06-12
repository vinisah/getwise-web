import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-error";
import { ForgotPasswordSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";
import { createToken, expiresIn } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/audit";

export const POST = withErrorHandler(async (req: NextRequest) => {
  const ip = getClientIp(req);

  const { allowed, retryAfter } = checkRateLimit(`forgot:${ip}`, LIMITS.LOGIN.max, LIMITS.LOGIN.windowMs);
  if (!allowed) {
    return NextResponse.json({ error: `Muitas tentativas. Aguarde ${retryAfter}s.` }, { status: 429 });
  }

  const parsed = ForgotPasswordSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });

  // Só gera token se o usuário existe — mas resposta é sempre genérica
  // (não revela se o e-mail está cadastrado — anti-enumeração)
  if (user) {
    const token = createToken();
    await prisma.passwordResetToken.create({ data: { email, token, expires: expiresIn(1) } });
    await sendPasswordResetEmail(email, token);
  }

  return NextResponse.json({
    ok: true,
    message: "Se o e-mail existir, enviamos um link de redefinição.",
  });
});
