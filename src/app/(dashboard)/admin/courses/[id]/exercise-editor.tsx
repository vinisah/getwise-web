"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/gw/primitives";
import { Plus, Trash2 } from "lucide-react";

interface Ex { id: string; title: string; type: string; points: number; isRequired: boolean }

const TYPES = [
  { value: "MULTIPLE_CHOICE", label: "Múltipla escolha" },
  { value: "TRUE_FALSE", label: "Verdadeiro/Falso" },
  { value: "FILL_IN_BLANK", label: "Preencher lacuna" },
  { value: "TRANSLATION", label: "Tradução (similaridade)" },
  { value: "SENTENCE_ORDER", label: "Ordenar frase" },
  { value: "WORD_MATCH", label: "Associação" },
  { value: "DICTATION", label: "Ditado (em breve)" },
  { value: "PRONUNCIATION", label: "Pronúncia (em breve)" },
];

export function ExerciseEditor({ unitId, exercises }: { unitId: string; exercises: Ex[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("MULTIPLE_CHOICE");
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(""); // MC: vírgula
  const [answer, setAnswer] = useState(""); // resposta(s): vírgula
  const [points, setPoints] = useState(10);
  const [required, setRequired] = useState(true);

  async function add() {
    if (!title.trim() || !question.trim()) { alert("Preencha título e pergunta"); return; }
    setBusy(true);

    let content: Record<string, unknown> = { question };
    let correctAnswer: unknown = answer;
    const answers = answer.split(",").map((s) => s.trim()).filter(Boolean);

    if (type === "MULTIPLE_CHOICE") {
      content = { question, options: options.split(",").map((s) => s.trim()).filter(Boolean) };
      correctAnswer = answer.trim();
    } else if (type === "TRUE_FALSE") {
      correctAnswer = answer.trim();
    } else if (type === "FILL_IN_BLANK" || type === "TRANSLATION") {
      correctAnswer = answers; // array de respostas aceitas
    } else if (type === "SENTENCE_ORDER") {
      const words = answers;
      content = { question, words };
      correctAnswer = words;
    } else if (type === "WORD_MATCH") {
      // answer formato: left:right, left:right
      const pairs = answer.split(",").map((s) => { const [l, r] = s.split(":"); return { left: (l ?? "").trim(), right: (r ?? "").trim() }; });
      content = { question, pairs };
      correctAnswer = pairs.map((p) => [p.left, p.right]);
    }

    const res = await fetch("/api/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unitId, type, title, content, correctAnswer, points, isRequired: required, order: exercises.length + 1 }),
    });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error ?? "Erro"); return; }
    setTitle(""); setQuestion(""); setOptions(""); setAnswer(""); setOpen(false);
    router.refresh();
  }

  async function del(id: string) {
    if (!confirm("Excluir exercício?")) return;
    setBusy(true);
    await fetch(`/api/exercises/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="gw-list">
        {exercises.map((e, i) => (
          <div key={e.id} className="gw-row">
            <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)" }}>{i + 1}</span>
            <span style={{ flex: 1, fontSize: 13.5, color: "var(--ink)" }}>{e.title}</span>
            <Badge tone="slate">{e.type}</Badge>
            {e.isRequired && <Badge tone="amber">obrig.</Badge>}
            <button onClick={() => del(e.id)} className="gw-icon-btn sm" disabled={busy}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>

      {open ? (
        <div style={{ marginTop: 10, padding: 14, background: "var(--bg)", borderRadius: "var(--r-sm)", display: "flex", flexDirection: "column", gap: 8 }}>
          <select value={type} onChange={(e) => setType(e.target.value)} style={{ height: 38, borderRadius: 8, border: "1px solid var(--line)", padding: "0 10px", fontSize: 13, background: "var(--card)" }}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <Input placeholder="Título do exercício" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input placeholder="Pergunta / enunciado" value={question} onChange={(e) => setQuestion(e.target.value)} />
          {type === "MULTIPLE_CHOICE" && <Input placeholder="Opções (separadas por vírgula)" value={options} onChange={(e) => setOptions(e.target.value)} />}
          <Input
            placeholder={
              type === "MULTIPLE_CHOICE" ? "Resposta correta (exata)" :
              type === "TRUE_FALSE" ? "True ou False" :
              type === "FILL_IN_BLANK" || type === "TRANSLATION" ? "Respostas aceitas (vírgula = sinônimos)" :
              type === "SENTENCE_ORDER" ? "Palavras na ordem correta (vírgula)" :
              type === "WORD_MATCH" ? "Pares left:right, left:right" : "Resposta"
            }
            value={answer} onChange={(e) => setAnswer(e.target.value)}
          />
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Input type="number" value={points} onChange={(e) => setPoints(Number(e.target.value))} style={{ width: 90 }} placeholder="Pontos" />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-2)" }}>
              <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Obrigatório
            </label>
            <div style={{ flex: 1 }} />
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="accent" size="sm" onClick={add} disabled={busy}>Salvar</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} style={{ marginTop: 10 }}><Plus size={15} /> Exercício</Button>
      )}
    </div>
  );
}
