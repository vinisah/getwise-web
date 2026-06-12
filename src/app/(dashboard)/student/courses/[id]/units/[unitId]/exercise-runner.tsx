"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/gw/primitives";
import { CheckCircle, XCircle, Lock, Mic, Headphones } from "lucide-react";
import { cx } from "@/lib/utils";

interface Exercise {
  id: string;
  title: string;
  type: string;
  points: number;
  isRequired: boolean;
  content: Record<string, unknown>;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function ExerciseRunner({
  exercises,
  locked,
}: {
  exercises: Exercise[];
  locked: boolean;
}) {
  if (locked) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 20, background: "var(--bg)", borderRadius: "var(--r-sm)", color: "var(--muted)" }}>
        <Lock size={18} /> Assista pelo menos 90% do vídeo para liberar os exercícios.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {exercises.map((ex, i) => (
        <ExerciseCard key={ex.id} exercise={ex} index={i + 1} />
      ))}
    </div>
  );
}

function ExerciseCard({ exercise, index }: { exercise: Exercise; index: number }) {
  const router = useRouter();
  const c = exercise.content;
  const question = String(c.question ?? c.prompt ?? exercise.title);

  const [answer, setAnswer] = useState<unknown>(null);
  const [result, setResult] = useState<null | { passed: boolean; scorePercent: number; explanation?: string; unitCompleted?: boolean }>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const stub = exercise.type === "DICTATION" || exercise.type === "PRONUNCIATION";

  // dados embaralhados estáveis por render
  const orderWords = useMemo(() => shuffle((c.words as string[]) ?? []), [c.words]);
  const matchPairs = useMemo(() => (c.pairs as { left: string; right: string }[]) ?? [], [c.pairs]);
  const shuffledRights = useMemo(() => shuffle(matchPairs.map((p) => p.right)), [matchPairs]);

  async function submit() {
    if (answer == null) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/exercises/attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exerciseId: exercise.id, answer }),
    });
    setLoading(false);
    if (res.status === 501) {
      setError("Este tipo estará disponível em breve.");
      return;
    }
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Erro ao enviar.");
      return;
    }
    const data = await res.json();
    setResult(data);
    if (data.passed) router.refresh(); // atualiza progresso/conclusão
  }

  return (
    <div className="gw-card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontFamily: "var(--mono)", color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em" }}>
          Exercício {index} · {exercise.points} pts {exercise.isRequired && "· obrigatório"}
        </span>
        {result && <Badge tone={result.passed ? "green" : "red"}>{result.passed ? `Aprovado ${result.scorePercent}%` : `${result.scorePercent}%`}</Badge>}
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>{question}</p>

      {/* ── Stub: ditado/pronúncia ── */}
      {stub && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, background: "var(--violet-soft)", color: "var(--violet)", borderRadius: "var(--r-sm)", fontSize: 14 }}>
          {exercise.type === "PRONUNCIATION" ? <Mic size={18} /> : <Headphones size={18} />}
          🔒 {exercise.type === "PRONUNCIATION" ? "Pronúncia (gravação de voz)" : "Ditado (áudio)"} — em breve
        </div>
      )}

      {/* ── MULTIPLE_CHOICE ── */}
      {exercise.type === "MULTIPLE_CHOICE" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {((c.options as string[]) ?? []).map((opt) => (
            <OptionRow key={opt} label={opt} selected={answer === opt} disabled={!!result?.passed} onClick={() => setAnswer(opt)} />
          ))}
        </div>
      )}

      {/* ── TRUE_FALSE ── */}
      {exercise.type === "TRUE_FALSE" && (
        <div style={{ display: "flex", gap: 8 }}>
          {["True", "False"].map((opt) => (
            <OptionRow key={opt} label={opt} selected={answer === opt} disabled={!!result?.passed} onClick={() => setAnswer(opt)} grow />
          ))}
        </div>
      )}

      {/* ── FILL_IN_BLANK / TRANSLATION ── */}
      {(exercise.type === "FILL_IN_BLANK" || exercise.type === "TRANSLATION") && (
        <input
          className="gw-field-box"
          style={{ width: "100%", padding: "12px 14px", fontSize: 14 }}
          placeholder={exercise.type === "TRANSLATION" ? "Digite a tradução..." : "Sua resposta..."}
          value={(answer as string) ?? ""}
          disabled={!!result?.passed}
          onChange={(e) => setAnswer(e.target.value)}
        />
      )}

      {/* ── SENTENCE_ORDER ── */}
      {exercise.type === "SENTENCE_ORDER" && (
        <SentenceOrder words={orderWords} disabled={!!result?.passed} onChange={setAnswer} />
      )}

      {/* ── WORD_MATCH ── */}
      {exercise.type === "WORD_MATCH" && (
        <WordMatch pairs={matchPairs} rights={shuffledRights} disabled={!!result?.passed} onChange={setAnswer} />
      )}

      {/* feedback */}
      {result && !result.passed && (
        <div style={{ marginTop: 12, fontSize: 13, color: "var(--danger)", display: "flex", alignItems: "center", gap: 6 }}>
          <XCircle size={15} /> Não passou ({result.scorePercent}%). {result.explanation}
        </div>
      )}
      {result?.passed && (
        <div style={{ marginTop: 12, fontSize: 13, color: "var(--success)", display: "flex", alignItems: "center", gap: 6 }}>
          <CheckCircle size={15} /> Correto! {result.unitCompleted && "Unidade concluída 🎉"}
        </div>
      )}
      {error && <p style={{ marginTop: 10, fontSize: 13, color: "var(--danger)" }}>{error}</p>}

      {!stub && !result?.passed && (
        <Button variant="accent" onClick={submit} disabled={loading || answer == null} style={{ marginTop: 14 }}>
          {loading ? "Enviando..." : result ? "Tentar novamente" : "Responder"}
        </Button>
      )}
    </div>
  );
}

function OptionRow({ label, selected, disabled, onClick, grow }: { label: string; selected: boolean; disabled: boolean; onClick: () => void; grow?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx("gw-chip")}
      style={{
        flex: grow ? 1 : undefined,
        padding: "11px 14px",
        textAlign: grow ? "center" : "left",
        border: `1px solid ${selected ? "var(--accent)" : "var(--line)"}`,
        background: selected ? "var(--accent-soft)" : "var(--card)",
        color: selected ? "var(--accent)" : "var(--ink)",
        fontWeight: selected ? 700 : 500,
      }}
    >
      {label}
    </button>
  );
}

function SentenceOrder({ words, disabled, onChange }: { words: string[]; disabled: boolean; onChange: (v: string[]) => void }) {
  const [bank, setBank] = useState(words);
  const [seq, setSeq] = useState<string[]>([]);

  function pick(w: string, i: number) {
    if (disabled) return;
    const nb = [...bank]; nb.splice(i, 1);
    const ns = [...seq, w];
    setBank(nb); setSeq(ns); onChange(ns);
  }
  function unpick(i: number) {
    if (disabled) return;
    const ns = [...seq]; const [w] = ns.splice(i, 1);
    setSeq(ns); setBank([...bank, w]); onChange(ns);
  }
  return (
    <div>
      <div style={{ minHeight: 44, display: "flex", flexWrap: "wrap", gap: 6, padding: 10, background: "var(--bg)", borderRadius: "var(--r-sm)", marginBottom: 8 }}>
        {seq.map((w, i) => (
          <button key={i} type="button" onClick={() => unpick(i)} className="gw-chip" style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent)" }}>{w}</button>
        ))}
        {seq.length === 0 && <span style={{ fontSize: 13, color: "var(--muted)" }}>Toque nas palavras para ordenar...</span>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {bank.map((w, i) => (
          <button key={i} type="button" onClick={() => pick(w, i)} className="gw-chip">{w}</button>
        ))}
      </div>
    </div>
  );
}

function WordMatch({ pairs, rights, disabled, onChange }: { pairs: { left: string; right: string }[]; rights: string[]; disabled: boolean; onChange: (v: [string, string][]) => void }) {
  const [sel, setSel] = useState<Record<string, string>>({});
  function set(left: string, right: string) {
    if (disabled) return;
    const next = { ...sel, [left]: right };
    setSel(next);
    onChange(pairs.map((p) => [p.left, next[p.left] ?? ""]));
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {pairs.map((p) => (
        <div key={p.left} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{p.left}</span>
          <select
            value={sel[p.left] ?? ""}
            disabled={disabled}
            onChange={(e) => set(p.left, e.target.value)}
            style={{ flex: 1, height: 38, borderRadius: "var(--r-sm)", border: "1px solid var(--line)", padding: "0 10px", fontSize: 14, background: "var(--card)" }}
          >
            <option value="">Selecione...</option>
            {rights.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}
