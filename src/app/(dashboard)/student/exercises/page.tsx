"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, Trophy, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Exercise {
  id: string;
  title: string;
  type: string;
  level: string;
  content: any;
  correctAnswer: any;
  explanation?: string;
  points: number;
  timeLimit?: number;
}

interface AttemptResult {
  isCorrect: boolean;
  score: number;
  correctAnswer: any;
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
        <RefreshCw className="h-6 w-6 animate-spin text-[#1a2357]" />
      </div>
    );
  }

  if (exercises.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-[#1a2357]">Exercícios</h1>
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
        <h1 className="text-3xl font-bold text-[#1a2357]">Exercícios</h1>
        <Card className="max-w-lg mx-auto">
          <CardContent className="p-8 text-center space-y-6">
            <div className="bg-yellow-100 rounded-full p-6 w-fit mx-auto">
              <Trophy className="h-12 w-12 text-yellow-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#1a2357]">Well done!</h2>
              <p className="text-muted-foreground">You completed all exercises!</p>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-2xl font-bold text-[#1a2357]">{completed}</p>
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

  const options: string[] = exercise.type === "MULTIPLE_CHOICE" ? exercise.content?.options ?? [] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#1a2357]">Exercícios</h1>
          <p className="text-muted-foreground">
            {current + 1} de {exercises.length} · {score} pontos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{levelLabels[exercise.level]}</Badge>
          <Badge variant="secondary">{exercise.points} pts</Badge>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-[#1a2357] h-2 rounded-full transition-all"
          style={{ width: `${((current) / exercises.length) * 100}%` }}
        />
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-lg text-[#1a2357]">{exercise.title}</CardTitle>
          {exercise.content?.question && (
            <p className="text-base">{exercise.content.question}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {exercise.type === "MULTIPLE_CHOICE" && (
            <div className="space-y-2">
              {options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => !result && setSelected(opt)}
                  disabled={!!result}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-lg border text-sm transition-all",
                    result
                      ? opt === String(exercise.correctAnswer)
                        ? "bg-green-50 border-green-500 text-green-800"
                        : opt === selected
                        ? "bg-red-50 border-red-400 text-red-700"
                        : "border-input opacity-60"
                      : selected === opt
                      ? "bg-[#1a2357]/10 border-[#1a2357] text-[#1a2357]"
                      : "border-input hover:border-[#1a2357] hover:bg-muted"
                  )}
                >
                  <span className="font-medium mr-2">{String.fromCharCode(65 + i)}.</span>
                  {opt}
                </button>
              ))}
            </div>
          )}

          {exercise.type === "FILL_IN_BLANK" && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Complete a frase:</p>
              <input
                value={selected ?? ""}
                onChange={(e) => !result && setSelected(e.target.value)}
                disabled={!!result}
                placeholder="Type your answer here..."
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              />
            </div>
          )}

          {exercise.type === "TRUE_FALSE" && (
            <div className="flex gap-4">
              {["True", "False"].map((opt) => (
                <button
                  key={opt}
                  onClick={() => !result && setSelected(opt)}
                  disabled={!!result}
                  className={cn(
                    "flex-1 py-3 rounded-lg border text-sm font-medium transition-all",
                    result
                      ? String(exercise.correctAnswer).toLowerCase() === opt.toLowerCase()
                        ? "bg-green-50 border-green-500 text-green-800"
                        : selected?.toLowerCase() === opt.toLowerCase()
                        ? "bg-red-50 border-red-400"
                        : "opacity-60 border-input"
                      : selected === opt
                      ? "bg-[#1a2357] text-white border-[#1a2357]"
                      : "border-input hover:border-[#1a2357]"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Result feedback */}
          {result && (
            <div className={cn(
              "rounded-lg p-4 flex items-start gap-3",
              result.isCorrect ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
            )}>
              {result.isCorrect
                ? <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                : <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              }
              <div>
                <p className={cn("font-medium text-sm", result.isCorrect ? "text-green-800" : "text-red-800")}>
                  {result.isCorrect ? `Correct! +${result.score} points` : "Not quite right."}
                </p>
                {!result.isCorrect && (
                  <p className="text-sm text-red-700 mt-1">
                    Correct answer: <strong>{String(result.correctAnswer)}</strong>
                  </p>
                )}
                {result.explanation && (
                  <p className="text-sm text-muted-foreground mt-2">{result.explanation}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {!result ? (
              <Button
                onClick={submitAnswer}
                disabled={!selected || submitting}
                className="flex-1"
              >
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
