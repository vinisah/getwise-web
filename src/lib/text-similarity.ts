/**
 * Similaridade textual sem dependência externa (KISS).
 * Usado em exercícios de tradução e ditado.
 */

/** Distância de edição de Levenshtein entre duas strings. */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Normaliza: minúsculas, sem acento, espaços colapsados, trim. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Razão de similaridade 0–1 (1 = idêntico) baseada em Levenshtein normalizado.
 */
export function similarityRatio(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(na, nb) / maxLen;
}

/** Melhor razão de similaridade contra uma lista de respostas aceitas. */
export function bestSimilarity(answer: string, accepted: string[]): number {
  return accepted.reduce((best, exp) => Math.max(best, similarityRatio(answer, exp)), 0);
}
