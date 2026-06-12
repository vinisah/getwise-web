"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp } from "lucide-react";

/** Reajuste anual em lote — % sobre todos os planos ativos. */
export function AdjustPlansButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const percent = parseFloat(new FormData(e.currentTarget).get("percent") as string);
    if (!confirm(`Reajustar TODOS os planos ativos em ${percent}%? Vale para novas matrículas.`)) return;

    setLoading(true);
    setError("");
    const res = await fetch("/api/plans/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ percent }),
    });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Erro.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <TrendingUp size={16} /> Reajuste anual
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "inline-flex", gap: 8, alignItems: "flex-end" }}>
      <div>
        <Label htmlFor="percent" className="text-xs">Reajuste (%)</Label>
        <Input id="percent" name="percent" type="number" step="0.1" min="-50" max="100" required placeholder="ex: 8" style={{ width: 110 }} />
      </div>
      <Button type="submit" size="sm" disabled={loading}>{loading ? "..." : "Aplicar"}</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
      {error && <span style={{ fontSize: 12, color: "var(--danger)" }}>{error}</span>}
    </form>
  );
}
