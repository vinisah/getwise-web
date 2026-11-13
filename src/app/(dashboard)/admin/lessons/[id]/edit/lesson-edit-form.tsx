"use client";

import { useState } from "react";
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
  { value: "A3", label: "A3 — Conteúdo A3" },
  { value: "B1", label: "B1 — Intermediário" },
  { value: "B2", label: "B2 — Inter. Avançado" },
  { value: "C1", label: "C1 — Avançado" },
  { value: "C2", label: "C2 — Proficiente" },
];

type LessonData = {
  id: string;
  title: string;
  description: string | null;
  scheduledAtLocal: string; // "YYYY-MM-DDTHH:mm"
  duration: number;
  meetingUrl: string | null;
  level: string;
};

export function LessonEditForm({ lesson }: { lesson: LessonData }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const body = {
      title: String(fd.get("title") ?? ""),
      description: String(fd.get("description") ?? ""),
      // O schema da API interpreta datetime-local no fuso de Brasília.
      scheduledAt: String(fd.get("scheduledAt") ?? ""),
      duration: Number(fd.get("duration")),
      meetingUrl: String(fd.get("meetingUrl") ?? ""),
      level: String(fd.get("level")),
    };

    try {
      const res = await fetch(`/api/lessons/${lesson.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25000),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Erro ao salvar a aula.");
        return;
      }
      router.push("/admin/lessons");
      router.refresh();
    } catch {
      setError("Falha de conexão. Confira a agenda antes de tentar novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/lessons">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-[var(--brand)]">Editar Aula</h1>
          <p className="text-muted-foreground">Atualizar dados da aula</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detalhes da Aula</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input id="title" name="title" required defaultValue={lesson.title} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scheduledAt">Data e Hora (Brasília) *</Label>
                <Input
                  id="scheduledAt"
                  name="scheduledAt"
                  type="datetime-local"
                  required
                  defaultValue={lesson.scheduledAtLocal}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duração (min)</Label>
                <Input
                  id="duration"
                  name="duration"
                  type="number"
                  required
                  min="15"
                  max="180"
                  defaultValue={lesson.duration}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="level">Nível</Label>
                <select
                  id="level"
                  name="level"
                  defaultValue={lesson.level}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {levels.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="meetingUrl">Link da Videoconferência</Label>
                <Input
                  id="meetingUrl"
                  name="meetingUrl"
                  type="url"
                  defaultValue={lesson.meetingUrl ?? ""}
                  placeholder="https://meet.google.com/..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <textarea
                id="description"
                name="description"
                defaultValue={lesson.description ?? ""}
                className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Link href="/admin/lessons" className="flex-1">
                <Button variant="outline" className="w-full">
                  Cancelar
                </Button>
              </Link>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
