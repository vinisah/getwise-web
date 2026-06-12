"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { centsToReais } from "@/lib/money";
import { Banknote } from "lucide-react";

const TYPES = [
  { value: "SALARY", label: "Salário" },
  { value: "THIRTEENTH_1", label: "13º — 1ª parcela" },
  { value: "THIRTEENTH_2", label: "13º — 2ª parcela" },
  { value: "VACATION", label: "Férias (+1/3)" },
  { value: "OTHER", label: "Outro (sem descontos)" },
];

/**
 * Registra uma parcela da folha. O servidor calcula INSS/IRRF/FGTS a partir
 * do bruto — aqui só se escolhe tipo e (opcionalmente) ajusta o bruto.
 */
export function PayrollPayButton({
  employeeId,
  salaryCents,
  month,
  year,
}: {
  employeeId: string;
  salaryCents: number;
  month: number;
  year: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const body = {
      employeeId,
      month,
      year,
      type: formData.get("type"),
      grossAmount: formData.get("grossAmount"),
      isPaid: "true",
    };

    const res = await fetch("/api/salary-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Erro ao registrar.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} title="Registrar pagamento">
        <Banknote size={15} /> Pagar
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 6, padding: 8, minWidth: 220, textAlign: "left" }}>
      <div>
        <Label htmlFor={`t-${employeeId}`} className="text-xs">Tipo</Label>
        <select
          id={`t-${employeeId}`}
          name="type"
          defaultValue="SALARY"
          className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={`g-${employeeId}`} className="text-xs">Bruto base (R$)</Label>
        <Input id={`g-${employeeId}`} name="grossAmount" type="number" step="0.01" min="0" required defaultValue={centsToReais(salaryCents)} />
        <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
          13º/férias derivam deste valor; descontos calculados no servidor.
        </p>
      </div>
      {error && <p style={{ fontSize: 12, color: "var(--danger)" }}>{error}</p>}
      <div style={{ display: "flex", gap: 6 }}>
        <Button type="submit" size="sm" disabled={loading}>{loading ? "..." : "Registrar"}</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </form>
  );
}
