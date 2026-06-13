import { randomBytes } from "crypto";

/**
 * Gera token aleatório criptograficamente seguro (hex).
 * Usado para verificação de e-mail e reset de senha.
 */
export function createToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

/**
 * Retorna data de expiração a partir de agora.
 * @param hours horas até expirar (default 24)
 */
export function expiresIn(hours = 24): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

/** Código de certificado: GW-XXXXXXXXXXXX (12 hex maiúsculo = 6 bytes). */
export function createCertificateCode(): string {
  return "GW-" + randomBytes(6).toString("hex").toUpperCase();
}
