/**
 * Rate limiter com store plugável (in-memory por default, Upstash REST quando configurado).
 * Ver `rate-limit-store.ts`. Async porque o adapter distribuído faz I/O de rede.
 *
 * Cada identificador (IP, email) tem contagem independente.
 */

import { getStore } from "./rate-limit-store";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number; // segundos
}

/**
 * Verifica e incrementa o contador para um identificador.
 *
 * @param identifier - IP ou email do requisitante
 * @param max        - Número máximo de tentativas na janela
 * @param windowMs   - Tamanho da janela em milissegundos
 */
export async function checkRateLimit(
  identifier: string,
  max: number,
  windowMs: number
): Promise<RateLimitResult> {
  const { count, resetAt } = await getStore().incr(identifier, windowMs);

  if (count > max) {
    const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
    return { allowed: false, remaining: 0, retryAfter };
  }

  return { allowed: true, remaining: max - count };
}

/**
 * Reseta o contador de um identificador (usar após login bem-sucedido).
 */
export async function resetRateLimit(identifier: string): Promise<void> {
  await getStore().reset(identifier);
}

// Limites predefinidos (exportar constantes para manter consistência)
export const LIMITS = {
  LOGIN: { max: 5, windowMs: 15 * 60 * 1000 },      // 5 tentativas / 15 min
  API_WRITE: { max: 30, windowMs: 60 * 1000 },        // 30 POSTs / min
  AI_CHAT: { max: 20, windowMs: 60 * 1000 },          // 20 msgs IA / min
} as const;
