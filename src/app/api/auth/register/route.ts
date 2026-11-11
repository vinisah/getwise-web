import { assignStudent, schedulingTransaction } from "@/lib/scheduling/service";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { withErrorHandler } from "@/lib/api-error";
import { RegisterSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";
import { createToken, expiresIn } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/email";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import { audit, getClientIp } from "@/lib/audit";

export const POST = withErrorHandler(async (req: NextRequest) => {
  const ip = getClientIp(req);

  // Rate limit por IP (anti-abuso de cadastro)
  const { allowed, retryAfter } = await checkRateLimit(`register:${ip}`, LIMITS.API_WRITE.max, LIMITS.API_WRITE.windowMs);
  if (!allowed) {
    return NextResponse.json(
      { error: `Muitas tentativas. Aguarde ${retryAfter}s.` },
      { status: 429 }
    );
  }

  const parsed = RegisterSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const { name, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);

  const user = await schedulingTransaction(async (tx) => {
  const created = await tx.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: "STUDENT",
      studentProfile: { create: { level: "A1" } },
    },
  });

  await assignStudent(created.id, tx);
  return created;
  });
  // Token de verificação de e-mail (expira em 24h)
  const token = createToken();
  await prisma.emailVerificationToken.create({
    data: { email, token, expires: expiresIn(24) },
  });

  // Falha de SMTP NÃO deve derrubar o cadastro (usuário já foi criado). Loga e segue;
  // o usuário pode reenviar a verificação. Sinaliza emailSent ao client.
  let emailSent = true;
  try {
    await sendVerificationEmail(email, token);
  } catch (e) {
    emailSent = false;
    console.error("[REGISTER] Falha ao enviar e-mail de verificação:", e instanceof Error ? e.name : "UnknownError");
  }

  await audit({ userId: user.id, action: "REGISTER", entity: "User", entityId: user.id, payload: { registered: true, emailSent }, ip });

  return NextResponse.json(
    {
      ok: true,
      emailSent,
      message: emailSent
        ? "Conta criada. Verifique seu e-mail para ativá-la."
        : "Conta criada, mas houve falha ao enviar o e-mail. Use 'Esqueci a senha' ou contate o suporte para reenviar a verificação.",
    },
    { status: 201 }
  );
});
