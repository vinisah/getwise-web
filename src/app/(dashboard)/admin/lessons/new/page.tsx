"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const levels = [
  { value: "A1", label: "A1 — Iniciante" },
  { value: "A2", label: "A2 — Básico" },
  { value: "B1", label: "B1 — Intermediário" },
  { value: "B2", label: "B2 — Inter. Avançado" },
  { value: "C1", label: "C1 — Avançado" },
  { value: "C2", label: "C2 — Proficiente" },
];

export default function NewLessonPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [teachers, setTeachers] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/teachers").then((r) => r.json()).catch(() => []),
      fetch("/api/students").then((r) => r.json()).catch(() => []),
    ]).then(([t, s]) => {
      setTeachers(t);
      setStudents(s);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data: any = Object.fromEntries(formData.entries());
    data.studentIds = selectedStudents;

    const res = await fetch("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    setLoading(false);

    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Erro ao criar aula.");
      return;
    }

    router.push("/admin/lessons");
    router.refresh();
  }

  function toggleStudent(id: string) {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/lessons">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-[var(--brand)]">Nova Aula</h1>
          <p className="text-muted-foreground">Agendar uma nova aula</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-lg">Detalhes da Aula</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input id="title" name="title" required placeholder="Ex: Conversation Practice — Present Perfect" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="teacherId">Professor *</Label>
                <select
                  id="teacherId"
                  name="teacherId"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Selecione</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="level">Nível</Label>
                <select
                  id="level"
                  name="level"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {levels.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scheduledAt">Data e Hora *</Label>
                <Input id="scheduledAt" name="scheduledAt" type="datetime-local" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duração (min)</Label>
                <Input id="duration" name="duration" type="number" defaultValue="50" min="15" max="180" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="meetingUrl">Link da Videoconferência</Label>
              <Input id="meetingUrl" name="meetingUrl" type="url" placeholder="https://meet.google.com/..." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <textarea
                id="description"
                name="description"
                className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder="Conteúdo da aula, objetivos..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Alunos</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {students.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum aluno cadastrado.</p>
              ) : (
                students.map((s) => (
                  <label key={s.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(s.id)}
                      onChange={() => toggleStudent(s.id)}
                      className="rounded"
                    />
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.email}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3">
          <Link href="/admin/lessons" className="flex-1">
            <Button variant="outline" className="w-full">Cancelar</Button>
          </Link>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? "Criando..." : "Criar Aula"}
          </Button>
        </div>
      </form>
    </div>
  );
}
