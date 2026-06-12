/**
 * Rate limiter in-memory para ambiente single-server.
 * Sem dependência externa — adequado para a escala deste sistema.
 *
 * Cada identificador (IP, email) tem contagem independente.
 * Entradas expiradas são limpas periodicamente para evitar memory leak.
 */

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

// Limpeza periódica de entradas expiradas (a cada 5 minutos).
// unref(): o timer não impede o processo de encerrar (graceful shutdown/testes).
if (typeof globalThis !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, 5 * 60 * 1000);
  timer.unref?.();
}

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
export function checkRateLimit(
  identifier: string,
  max: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || now > entry.resetAt) {
    // Janela nova ou expirada
    store.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1 };
  }

  if (entry.count >= max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  entry.count += 1;
  return { allowed: true, remaining: max - entry.count };
}

/**
 * Reseta o contador de um identificador (usar após login bem-sucedido).
 */
export function resetRateLimit(identifier: string): void {
  store.delete(identifier);
}

// Limites predefinidos (exportar constantes para manter consistência)
export const LIMITS = {
  LOGIN: { max: 5, windowMs: 15 * 60 * 1000 },      // 5 tentativas / 15 min
  API_WRITE: { max: 30, windowMs: 60 * 1000 },        // 30 POSTs / min
  AI_CHAT: { max: 20, windowMs: 60 * 1000 },          // 20 msgs IA / min
} as const;
