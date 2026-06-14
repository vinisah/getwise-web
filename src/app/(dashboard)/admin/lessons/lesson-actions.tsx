"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Pencil } from "lucide-react";

/** Transições de status da aula: concluir / cancelar (cancelar cascateia bookings no servidor). */
export function LessonActions({ lessonId, status }: { lessonId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<null | string>(null);
  const [error, setError] = useState("");

  async function patch(next: "COMPLETED" | "CANCELLED") {
    setLoading(next);
    setError("");
    try {
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Falha ao atualizar a aula.");
      }
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(null);
    }
  }

  // Estados finais: só permite editar (sem concluir/cancelar de novo).
  if (status === "CANCELLED" || status === "COMPLETED") {
    return (
      <Link href={`/admin/lessons/${lessonId}/edit`}>
        <Button variant="ghost" size="sm" title="Editar aula"><Pencil size={14} /> Editar</Button>
      </Link>
    );
  }

  return (
    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", alignItems: "center" }}>
      {error && <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span>}
      <Link href={`/admin/lessons/${lessonId}/edit`}>
        <Button variant="ghost" size="sm" title="Editar aula"><Pencil size={14} /> Editar</Button>
      </Link>
      <Button variant="ghost" size="sm" disabled={!!loading} title="Marcar como concluída" onClick={() => patch("COMPLETED")}>
        <CheckCircle2 size={15} color="var(--success)" /> Concluir
      </Button>
      <Button variant="ghost" size="sm" disabled={!!loading} title="Cancelar aula" onClick={() => patch("CANCELLED")}>
        <XCircle size={15} color="var(--danger)" /> Cancelar
      </Button>
    </div>
  );
}
