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
  { value: "B1", label: "B1 — Intermediário" },
  { value: "B2", label: "B2 — Inter. Avançado" },
  { value: "C1", label: "C1 — Avançado" },
  { value: "C2", label: "C2 — Proficiente" },
];

export default function NewStudentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    // Remove campos opcionais vazios: '' não é undefined e quebraria validadores
    // como .length(2)/.email()/.url() em campos opcionais não preenchidos.
    const data = Object.fromEntries(
      [...formData.entries()].filter(([, v]) => v !== "")
    );

    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    setLoading(false);

    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Erro ao cadastrar aluno.");
      return;
    }

    router.push("/admin/students");
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/students">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-[var(--brand)]">Novo Aluno</h1>
          <p className="text-muted-foreground">Cadastrar um novo aluno no sistema</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dados Pessoais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="name">Nome completo *</Label>
                <Input id="name" name="name" required placeholder="João da Silva" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" name="email" type="email" required placeholder="joao@email.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" name="phone" placeholder="(11) 99999-9999" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input id="cpf" name="cpf" placeholder="000.000.000-00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate">Data de Nascimento</Label>
                <Input id="birthDate" name="birthDate" type="date" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Endereço</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="address">Endereço</Label>
                <Input id="address" name="address" placeholder="Rua, número, complemento" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input id="city" name="city" placeholder="São Paulo" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">Estado</Label>
                <Input id="state" name="state" placeholder="SP" maxLength={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipCode">CEP</Label>
                <Input id="zipCode" name="zipCode" placeholder="00000-000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyContact">Contato de Emergência</Label>
                <Input id="emergencyContact" name="emergencyContact" placeholder="Nome e telefone" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Inglês e Acesso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="level">Nível de Inglês</Label>
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
            <div className="space-y-2">
              <Label htmlFor="password">Senha de acesso *</Label>
              <Input id="password" name="password" type="password" required placeholder="Senha inicial do aluno" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <textarea
                id="notes"
                name="notes"
                placeholder="Informações adicionais sobre o aluno..."
                className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        <div className="flex gap-3">
          <Link href="/admin/students" className="flex-1">
            <Button variant="outline" className="w-full">Cancelar</Button>
          </Link>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? "Cadastrando..." : "Cadastrar Aluno"}
          </Button>
        </div>
      </form>
    </div>
  );
}
