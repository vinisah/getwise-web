"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Undo2 } from "lucide-react";

/** Marca mensalidade como paga (com método) ou desfaz para pendente. */
export function MarkPaidButton({ paymentId, isPaid }: { paymentId: string; isPaid: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function send(body: { status: string; method?: string }) {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/payments/${paymentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

  if (isPaid) {
    return (
      <Button variant="ghost" size="sm" disabled={loading} title="Desfazer pagamento (volta a pendente)"
        onClick={() => send({ status: "PENDING" })}>
        <Undo2 size={15} /> Desfazer
      </Button>
    );
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} title="Marcar como pago">
        <CheckCircle2 size={15} color="var(--success)" /> Marcar pago
      </Button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const method = new FormData(e.currentTarget).get("method") as string;
        send({ status: "PAID", ...(method ? { method } : {}) });
      }}
      style={{ display: "flex", flexDirection: "column", gap: 6, padding: 8, minWidth: 180, textAlign: "left" }}
    >
      <div>
        <Label htmlFor={`m-${paymentId}`} className="text-xs">Forma de pagamento</Label>
        <select id={`m-${paymentId}`} name="method"
          className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Não informado</option>
          <option value="PIX">PIX</option>
          <option value="CREDIT_CARD">Cartão de Crédito</option>
          <option value="DEBIT_CARD">Cartão de Débito</option>
          <option value="BOLETO">Boleto</option>
        </select>
      </div>
      {error && <p style={{ fontSize: 12, color: "var(--danger)" }}>{error}</p>}
      <div style={{ display: "flex", gap: 6 }}>
        <Button type="submit" size="sm" disabled={loading}>{loading ? "..." : "Confirmar"}</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </form>
  );
}
