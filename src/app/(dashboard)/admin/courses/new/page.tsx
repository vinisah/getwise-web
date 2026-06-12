"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";

const levels = [
  { value: "A1", label: "A1 — Iniciante" },
  { value: "A2", label: "A2 — Básico" },
  { value: "B1", label: "B1 — Intermediário" },
  { value: "B2", label: "B2 — Inter. Avançado" },
  { value: "C1", label: "C1 — Avançado" },
  { value: "C2", label: "C2 — Proficiente" },
];

export default function NewCoursePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const data = Object.fromEntries(fd.entries());

    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json();
      setError(j.error ?? "Erro ao criar curso.");
      return;
    }
    const course = await res.json();
    router.push(`/admin/courses/${course.id}`);
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/admin/courses"><Button variant="ghost" size="icon"><ArrowLeft size={16} /></Button></Link>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)" }}>Novo Curso</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader><CardTitle>Dados do curso</CardTitle></CardHeader>
          <CardContent style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Label htmlFor="title">Título *</Label>
              <Input id="title" name="title" required placeholder="Ex: English Foundations (A1)" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Label htmlFor="description">Descrição</Label>
              <textarea id="description" name="description" rows={3}
                style={{ borderRadius: "var(--r-sm)", border: "1px solid var(--line)", padding: "10px 12px", fontSize: 14, fontFamily: "var(--sans)", resize: "vertical" }}
                placeholder="O que o aluno vai aprender..." />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Label htmlFor="level">Nível *</Label>
                <select id="level" name="level" required defaultValue="A1"
                  style={{ height: 40, borderRadius: "var(--r-sm)", border: "1px solid var(--line)", padding: "0 12px", fontSize: 14, background: "var(--card)" }}>
                  {levels.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Label htmlFor="order">Ordem</Label>
                <Input id="order" name="order" type="number" defaultValue={0} min={0} />
              </div>
            </div>
            {error && <p style={{ fontSize: 13, color: "var(--danger)" }}>{error}</p>}
            <div style={{ display: "flex", gap: 10 }}>
              <Button type="submit" variant="accent" disabled={loading}>{loading ? "Criando..." : "Criar e gerenciar conteúdo"}</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
