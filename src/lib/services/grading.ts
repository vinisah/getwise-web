import { bestSimilarity, normalizeText } from "../text-similarity";

const PASS_SCORE = 70; // grading_system.pass_score

export interface GradeResult {
  isCorrect: boolean;
  scorePercent: number; // 0–100
  passed: boolean;
  stub?: boolean; // tipos ainda não suportados (pronúncia/ditado)
}

interface ExerciseLike {
  type: string;
  correctAnswer: unknown;
  points: number;
}

/**
 * Corrige uma resposta conforme o tipo do exercício.
 * Regra de aprovação: scorePercent >= 70 (best_score_wins é tratado na rota).
 *
 * Tipos suportados: MULTIPLE_CHOICE, TRUE_FALSE, FILL_IN_BLANK, WORD_MATCH,
 *   SENTENCE_ORDER, TRANSLATION.
 * Stub (501): DICTATION, PRONUNCIATION — exigem áudio/voz (fase futura).
 */
export function gradeAnswer(exercise: ExerciseLike, answer: unknown): GradeResult {
  const correct = exercise.correctAnswer;

  switch (exercise.type) {
    case "MULTIPLE_CHOICE":
    case "TRUE_FALSE": {
      const ok = normalizeText(String(answer)) === normalizeText(String(correct));
      return finalize(ok ? 100 : 0);
    }

    case "FILL_IN_BLANK": {
      // case-insensitive + sinônimos (correctAnswer pode ser array)
      const accepted = Array.isArray(correct) ? correct.map(String) : [String(correct)];
      const norm = normalizeText(String(answer));
      const ok = accepted.some((a) => normalizeText(a) === norm);
      return finalize(ok ? 100 : 0);
    }

    case "WORD_MATCH": {
      // answer e correct: arrays de pares [left,right] ou objeto {left:right}
      const ok = JSON.stringify(normalizePairs(answer)) === JSON.stringify(normalizePairs(correct));
      return finalize(ok ? 100 : 0);
    }

    case "SENTENCE_ORDER": {
      // arrays ordenados de palavras/segmentos
      const a = Array.isArray(answer) ? answer.map((x) => normalizeText(String(x))) : [];
      const c = Array.isArray(correct) ? correct.map((x) => normalizeText(String(x))) : [];
      const ok = a.length === c.length && a.every((v, i) => v === c[i]);
      return finalize(ok ? 100 : 0);
    }

    case "TRANSLATION": {
      // similaridade textual >= 0.8 (accept_multiple_valid_answers)
      const accepted = Array.isArray(correct) ? correct.map(String) : [String(correct)];
      const ratio = bestSimilarity(String(answer), accepted);
      const scorePercent = Math.round(ratio * 100);
      const passed = ratio >= 0.8;
      return { isCorrect: passed, scorePercent, passed };
    }

    // Tipos sem correção automática (voz/redação) → stub: não travam conclusão
    // como o default fazia (front trata stub:true; não marca como "errado").
    case "DICTATION":
    case "PRONUNCIATION":
    case "WRITING":
    case "LISTENING":
      return { isCorrect: false, scorePercent: 0, passed: false, stub: true };

    default:
      return { isCorrect: false, scorePercent: 0, passed: false };
  }
}

function finalize(scorePercent: number): GradeResult {
  return { isCorrect: scorePercent >= PASS_SCORE, scorePercent, passed: scorePercent >= PASS_SCORE };
}

/** Normaliza pares de associação para comparação ordem-independente. */
function normalizePairs(v: unknown): [string, string][] {
  let pairs: [string, string][] = [];
  if (Array.isArray(v)) {
    pairs = v.map((p) => {
      if (Array.isArray(p)) return [normalizeText(String(p[0])), normalizeText(String(p[1]))];
      const o = p as { left?: unknown; right?: unknown };
      return [normalizeText(String(o.left)), normalizeText(String(o.right))];
    });
  } else if (v && typeof v === "object") {
    pairs = Object.entries(v as Record<string, unknown>).map(([k, val]) => [
      normalizeText(k),
      normalizeText(String(val)),
    ]);
  }
  return pairs.sort((a, b) => a[0].localeCompare(b[0]));
}
