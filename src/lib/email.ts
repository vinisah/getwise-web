import nodemailer from "nodemailer";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const FROM = process.env.SMTP_FROM ?? "Get Wise <no-reply@getwise.com.br>";

/**
 * Transporte SMTP — só criado se SMTP_HOST estiver configurado.
 * Sem SMTP, cai no modo dev (loga o link no console). Fail loud, funciona sem infra.
 */
function getTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_PORT === "465",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

interface MailParams {
  to: string;
  subject: string;
  html: string;
  /** Link principal — sempre logado em dev para facilitar o teste. */
  devLink?: string;
}

export async function sendMail({ to, subject, html, devLink }: MailParams): Promise<void> {
  const transport = getTransport();

  if (!transport) {
    // Modo dev: sem SMTP, loga o link no console (fail loud, claro).
    console.log("\n📧 [EMAIL DEV MODE — SMTP não configurado]");
    console.log(`   Para: ${to}`);
    console.log(`   Assunto: ${subject}`);
    if (devLink) console.log(`   🔗 Link: ${devLink}`);
    console.log("");
    return;
  }

  await transport.sendMail({ from: FROM, to, subject, html });
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const link = `${APP_URL}/api/auth/verify-email?token=${token}`;
  await sendMail({
    to,
    subject: "Confirme seu e-mail — Get Wise",
    devLink: link,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#16204E">Bem-vindo à Get Wise! 🦉</h2>
        <p>Confirme seu e-mail para ativar sua conta e começar a estudar.</p>
        <p><a href="${link}" style="display:inline-block;background:#2A5CD6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Confirmar e-mail</a></p>
        <p style="color:#8A93B5;font-size:13px">Link expira em 24 horas. Se não foi você, ignore este e-mail.</p>
      </div>`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${APP_URL}/reset-password?token=${token}`;
  await sendMail({
    to,
    subject: "Redefinir senha — Get Wise",
    devLink: link,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#16204E">Redefinir senha</h2>
        <p>Recebemos um pedido para redefinir sua senha. Clique abaixo:</p>
        <p><a href="${link}" style="display:inline-block;background:#2A5CD6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Criar nova senha</a></p>
        <p style="color:#8A93B5;font-size:13px">Link expira em 1 hora. Se não foi você, ignore este e-mail.</p>
      </div>`,
  });
}
