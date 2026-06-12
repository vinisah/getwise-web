"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

/** Gera as transações recorrentes do mês exibido (clona as do mês anterior). */
export function GenerateRecurringButton({ month, year }: { month: number; year: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  async function handleClick() {
    setLoading(true);
    setResult("");
    const res = await fetch("/api/financial/recurring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, year }),
    });
    setLoading(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setResult(json.error ?? "Erro.");
      return;
    }
    setResult(json.created > 0 ? `${json.created} criada(s)` : "Nada novo a gerar");
    router.refresh();
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Button variant="outline" size="sm" onClick={handleClick} disabled={loading} title="Clona as recorrentes do mês anterior para este mês">
        <RefreshCw size={15} className={loading ? "animate-spin" : undefined} /> Gerar recorrentes
      </Button>
      {result && <span style={{ fontSize: 12, color: "var(--muted)" }}>{result}</span>}
    </span>
  );
}
