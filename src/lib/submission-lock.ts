/**
 * Lock para impedir submissões simultâneas do mesmo exercício pelo mesmo usuário
 * (edge case: "processar apenas a primeira requisição válida").
 *
 * Usa o store plugável (in-memory por default, Upstash SET NX quando configurado),
 * então funciona também em ambiente multi-instância/serverless quando o Upstash está setado.
 */

import { getStore } from "./rate-limit-store";

const LOCK_TTL_MS = 30_000; // auto-expira em 30s (evita lock preso se a request morrer)

export async function acquireLock(key: string): Promise<boolean> {
  return getStore().lock(key, LOCK_TTL_MS);
}

export async function releaseLock(key: string): Promise<void> {
  await getStore().unlock(key);
}

export function submissionKey(userId: string, exerciseId: string): string {
  return `submit:${userId}:${exerciseId}`;
}
