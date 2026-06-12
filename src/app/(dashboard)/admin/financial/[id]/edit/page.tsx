"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { centsToReais } from "@/lib/money";

export default function EditTransactionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [tx, setTx] = useState<any>(null);
  const [type, setType] = useState("INCOME");

  useEffect(() => {
    Promise.all([
      fetch("/api/financial/categories").then((r) => r.json()),
      fetch(`/api/financial/${id}`).then((r) => (r.ok ? r.json() : null)),
    ]).then(([cats, t]) => {
      setCategories(cats);
      if (t) {
        setTx(t);
        setType(t.type);
      } else {
        setError("Transação não encontrada.");
      }
    });
  }, [id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    data.isPaid = formData.get("isPaid") === "on" ? "true" : "false";
    data.isRecurring = formData.get("isRecurring") === "on" ? "true" : "false";

    const res = await fetch(`/api/financial/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    setLoading(false);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Erro ao salvar.");
      return;
    }

    router.push("/admin/financial");
    router.refresh();
  }

  if (!tx) {
    return (
      <div className="space-y-6 max-w-xl">
        <p className="text-muted-foreground">{error || "Carregando..."}</p>
        <Link href="/admin/financial"><Button variant="outline">Voltar</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/financial">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-[#1a2357]">Editar Transação</h1>
          <p className="text-muted-foreground">Atualizar receita ou despesa</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader><CardTitle className="text-lg">Dados da Transação</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setType("INCOME")}
                  className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${type === "INCOME" ? "bg-green-500 text-white border-green-500" : "border-input hover:bg-muted"}`}
                >
                  Receita
                </button>
                <button
                  type="button"
                  onClick={() => setType("EXPENSE")}
                  className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${type === "EXPENSE" ? "bg-red-500 text-white border-red-500" : "border-input hover:bg-muted"}`}
                >
                  Despesa
                </button>
              </div>
              <input type="hidden" name="type" value={type} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição *</Label>
              <Input id="description" name="description" required defaultValue={tx.description} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Valor (R$) *</Label>
                <Input id="amount" name="amount" type="number" step="0.01" min="0" required defaultValue={centsToReais(tx.amount)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Data *</Label>
                <Input id="date" name="date" type="date" required defaultValue={String(tx.date).split("T")[0]} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dueDate">Vencimento</Label>
                <Input id="dueDate" name="dueDate" type="date" defaultValue={tx.dueDate ? String(tx.dueDate).split("T")[0] : ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoryId">Categoria</Label>
                <select
                  id="categoryId"
                  name="categoryId"
                  defaultValue={tx.categoryId ?? ""}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Sem categoria</option>
                  {categories.filter((c) => c.type === type).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Forma de Pagamento</Label>
              <select
                id="paymentMethod"
                name="paymentMethod"
                defaultValue={tx.paymentMethod ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Não informado</option>
                <option value="PIX">PIX</option>
                <option value="CREDIT_CARD">Cartão de Crédito</option>
                <option value="DEBIT_CARD">Cartão de Débito</option>
                <option value="BOLETO">Boleto</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference">Referência</Label>
              <Input id="reference" name="reference" defaultValue={tx.reference ?? ""} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <textarea
                id="notes"
                name="notes"
                defaultValue={tx.notes ?? ""}
                className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="isPaid" name="isPaid" defaultChecked={tx.isPaid} className="rounded" />
              <Label htmlFor="isPaid">Marcar como pago</Label>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="isRecurring" name="isRecurring" defaultChecked={tx.isRecurring} className="rounded" />
              <Label htmlFor="isRecurring">Despesa/receita recorrente (repete todo mês)</Label>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Link href="/admin/financial" className="flex-1">
                <Button variant="outline" className="w-full">Cancelar</Button>
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
