"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewEmployeePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    setLoading(false);

    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Erro ao cadastrar.");
      return;
    }

    router.push("/admin/employees");
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/employees">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-[var(--brand)]">Novo Funcionário</h1>
          <p className="text-muted-foreground">Cadastrar funcionário na folha de pagamento</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader><CardTitle className="text-lg">Dados do Funcionário</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo *</Label>
              <Input id="name" name="name" required placeholder="Maria Santos" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Cargo *</Label>
                <Input id="role" name="role" required placeholder="Professor, Secretária, etc." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input id="cpf" name="cpf" placeholder="000.000.000-00" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="funcionario@email.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" name="phone" placeholder="(11) 99999-9999" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="salary">Salário bruto (R$) *</Label>
                <Input id="salary" name="salary" type="number" step="0.01" min="0" required placeholder="0,00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Data de Admissão *</Label>
                <Input id="startDate" name="startDate" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contractType">Tipo de contrato *</Label>
                <select
                  id="contractType"
                  name="contractType"
                  defaultValue="CLT"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="CLT">CLT (com encargos: INSS, FGTS, 13º, férias)</option>
                  <option value="PJ">PJ (nota fiscal, sem encargos)</option>
                  <option value="HOURLY">Horista (RPA, sem encargos)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dependents">Dependentes (IRRF)</Label>
                <Input id="dependents" name="dependents" type="number" min="0" max="20" defaultValue={0} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <textarea
                id="notes"
                name="notes"
                className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder="Observações adicionais..."
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Link href="/admin/employees" className="flex-1">
                <Button variant="outline" className="w-full">Cancelar</Button>
              </Link>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Cadastrando..." : "Cadastrar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
