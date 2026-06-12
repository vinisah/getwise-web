/**
 * Lock in-memory para impedir submissões simultâneas do mesmo exercício
 * pelo mesmo usuário (edge case: "processar apenas a primeira requisição válida").
 *
 * Single-server. Para multi-server usar Redis SETNX.
 */
const inFlight = new Set<string>();

export function acquireLock(key: string): boolean {
  if (inFlight.has(key)) return false;
  inFlight.add(key);
  return true;
}

export function releaseLock(key: string): void {
  inFlight.delete(key);
}

export function submissionKey(userId: string, exerciseId: string): string {
  return `submit:${userId}:${exerciseId}`;
}
