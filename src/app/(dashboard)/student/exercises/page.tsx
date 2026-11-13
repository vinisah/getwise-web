"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Trophy, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { OptionRow } from "@/components/exercises/option-row";
import styles from "@/components/exercises/practice.module.css";

interface Exercise {
  id: string;
  title: string;
  type: string;
  level: string;
  content: { question?: string; options?: string[] } | null;
  explanation?: string;
  points: number;
  timeLimit?: number;
}

interface AttemptResult {
  isCorrect: boolean;
  score: number;
  correctAnswer?: unknown;
  explanation?: string;
}

const levelLabels: Record<string, string> = {
  A1: "A1 — Iniciante",
  A2: "A2 — Básico",
  B1: "B1 — Intermediário",
  B2: "B2 — Inter. Avançado",
  C1: "C1 — Avançado",
  C2: "C2 — Proficiente",
};

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(0);

  useEffect(() => {
    fetch("/api/exercises")
      .then((r) => r.json())
      .then((data) => {
        setExercises(data);
        setLoading(false);
      });
  }, []);

  async function submitAnswer() {
    if (!selected || submitting) return;
    const exercise = exercises[current];
    setSubmitting(true);

    const res = await fetch("/api/exercises/attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exerciseId: exercise.id, answer: selected }),
    });

    const data = await res.json();
    setResult(data);
    if (data.isCorrect) setScore((s) => s + data.score);
    setCompleted((c) => c + 1);
    setSubmitting(false);
  }

  function nextExercise() {
    if (current < exercises.length - 1) {
      setCurrent((c) => c + 1);
      setSelected(null);
      setResult(null);
    }
  }

  function restart() {
    setCurrent(0);
    setSelected(null);
    setResult(null);
    setScore(0);
    setCompleted(0);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-[var(--brand)]" />
      </div>
    );
  }

  if (exercises.length === 0) {
    return (
      <div className={styles.page}>
        <h1 className="text-3xl font-bold text-[var(--brand)]">Exercícios</h1>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Nenhum exercício disponível para o seu nível ainda.</p>
            <p className="text-sm text-muted-foreground mt-2">Converse com seu professor para adicionar exercícios.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const exercise = exercises[current];
  const isLastExercise = current === exercises.length - 1;
  const allDone = completed > 0 && isLastExercise && result !== null;

  if (allDone) {
    const accuracy = Math.round((score / exercises.reduce((sum, e) => sum + e.points, 0)) * 100);
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-[var(--brand)]">Exercícios</h1>
        <Card className="max-w-lg mx-auto">
          <CardContent className={styles.summary}>
            <div className="bg-yellow-100 rounded-full p-6 w-fit mx-auto">
              <Trophy className="h-12 w-12 text-yellow-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[var(--brand)]">Well done!</h2>
              <p className="text-muted-foreground">You completed all exercises!</p>
            </div>
            <div className={styles.stats}>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-2xl font-bold text-[var(--brand)]">{completed}</p>
                <p className="text-xs text-muted-foreground">Exercícios</p>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-2xl font-bold text-green-600">{score}</p>
                <p className="text-xs text-muted-foreground">Pontos</p>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-2xl font-bold text-blue-600">{accuracy}%</p>
                <p className="text-xs text-muted-foreground">Precisão</p>
              </div>
            </div>
            <Button onClick={restart} className="w-full gap-2">
              <RefreshCw className="h-4 w-4" />
              Refazer exercícios
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const options: string[] = exercise.type === "MULTIPLE_CHOICE" ? (exercise.content?.options ?? []) : [];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className="text-3xl font-bold text-[var(--brand)]">Exercícios</h1>
          <p className="text-muted-foreground">
            {current + 1} de {exercises.length} · {score} pontos
          </p>
        </div>
        <div className={styles.meta}>
          <Badge variant="outline">{levelLabels[exercise.level]}</Badge>
          <Badge variant="secondary">{exercise.points} pts</Badge>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-[var(--brand)] h-2 rounded-full transition-all"
          style={{ width: `${(current / exercises.length) * 100}%` }}
        />
      </div>

      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className="text-lg text-[var(--brand)]">{exercise.title}</CardTitle>
          {exercise.content?.question && <p className="text-base">{exercise.content.question}</p>}
        </CardHeader>
        <CardContent className={styles.content}>
          {exercise.type === "MULTIPLE_CHOICE" && (
            <div className={styles.choices}>
              {options.map((opt, i) => (
                <OptionRow
                  key={i}
                  label={opt}
                  letter={String.fromCharCode(65 + i)}
                  selected={selected === opt}
                  onClick={() => !result && setSelected(opt)}
                  disabled={!!result}
                  state={
                    result
                      ? result.correctAnswer != null && opt === String(result.correctAnswer)
                        ? "correct"
                        : opt === selected
                          ? "incorrect"
                          : "muted"
                      : undefined
                  }
                />
              ))}
            </div>
          )}

          {exercise.type === "FILL_IN_BLANK" && (
            <div className={styles.field}>
              <label htmlFor="practice-answer" className="text-sm text-muted-foreground">
                Complete a frase:
              </label>
              <input
                id="practice-answer"
                value={selected ?? ""}
                onChange={(e) => !result && setSelected(e.target.value)}
                disabled={!!result}
                placeholder="Type your answer here..."
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              />
            </div>
          )}

          {exercise.type === "TRUE_FALSE" && (
            <div className={styles.binary}>
              {["True", "False"].map((opt) => (
                <OptionRow
                  key={opt}
                  label={opt}
                  selected={selected === opt}
                  grow
                  onClick={() => !result && setSelected(opt)}
                  disabled={!!result}
                  state={
                    result
                      ? result.correctAnswer != null && String(result.correctAnswer).toLowerCase() === opt.toLowerCase()
                        ? "correct"
                        : selected?.toLowerCase() === opt.toLowerCase()
                          ? "incorrect"
                          : "muted"
                      : undefined
                  }
                />
              ))}
            </div>
          )}

          {/* Result feedback */}
          {result && (
            <div
              className={cn(
                styles.feedback,
                result.isCorrect ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
              )}
            >
              {result.isCorrect ? (
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className={cn("font-medium text-sm", result.isCorrect ? "text-green-800" : "text-red-800")}>
                  {result.isCorrect ? `Correct! +${result.score} points` : "Not quite right."}
                </p>
                {!result.isCorrect && result.correctAnswer != null && (
                  <p className="text-sm text-red-700 mt-1">
                    Correct answer: <strong>{String(result.correctAnswer)}</strong>
                  </p>
                )}
                {result.explanation && <p className="text-sm text-muted-foreground mt-2">{result.explanation}</p>}
              </div>
            </div>
          )}

          <div className={styles.actions}>
            {!result ? (
              <Button onClick={submitAnswer} disabled={!selected || submitting} className="flex-1">
                {submitting ? "Checking..." : "Submit Answer"}
              </Button>
            ) : (
              <Button onClick={nextExercise} className="flex-1">
                {isLastExercise ? "See Results" : "Next Exercise →"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
