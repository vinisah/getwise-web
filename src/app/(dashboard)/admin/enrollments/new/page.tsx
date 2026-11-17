"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { fmtCents, reaisToCents } from "@/lib/money";

export default function NewEnrollmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [discount, setDiscount] = useState(0);
  const [preEnrollment, setPreEnrollment] = useState<{
    id: string;
    studentId: string;
    schoolUnit: { name: string };
    course: { title: string };
  } | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("preEnrollmentId");
    if (id)
      fetch(`/api/pre-enrollments/${encodeURIComponent(id)}?scope=admin`)
        .then(async (r) => {
          if (!r.ok) throw Error("Não foi possível carregar a pré-matrícula.");
          return r.json();
        })
        .then(setPreEnrollment)
        .catch((e) => setError(e.message));
    Promise.all([fetch("/api/students").then((r) => r.json()), fetch("/api/plans").then((r) => r.json())]).then(
      ([s, p]) => {
        setStudents(s);
        setPlans(p);
      }
    );
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    const res = await fetch("/api/enrollments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    setLoading(false);

    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Erro ao criar matrícula.");
      return;
    }

    router.push("/admin/enrollments");
    router.refresh();
  }

  // Preço vem em centavos da API; desconto é digitado em reais. Tudo em centavos.
  const finalPrice = selectedPlan ? Number(selectedPlan.price) - reaisToCents(discount) : 0;

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/enrollments">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-[var(--brand)]">Nova Matrícula</h1>
          <p className="text-muted-foreground">Vincular aluno a um plano</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dados da Matrícula</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {preEnrollment && (
              <>
                <input type="hidden" name="preEnrollmentId" value={preEnrollment.id} />
                <input type="hidden" name="studentId" value={preEnrollment.studentId} />
                <p className="rounded-lg bg-muted p-4">
                  Origem: {preEnrollment.schoolUnit.name} · {preEnrollment.course.title}. Ao criar a matrícula, o plano
                  e a primeira mensalidade serão registrados.
                </p>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="studentId">Aluno *</Label>
              <select
                id="studentId"
                name="studentId"
                required
                value={preEnrollment?.studentId}
                disabled={!!preEnrollment}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Selecione um aluno</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="planId">Plano *</Label>
              <select
                id="planId"
                name="planId"
                required
                onChange={(e) => {
                  const plan = plans.find((p) => p.id === e.target.value);
                  setSelectedPlan(plan ?? null);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Selecione um plano</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {fmtCents(Number(p.price))}/mês — {p.lessonsPerMonth}x/mês
                  </option>
                ))}
              </select>
            </div>

            {selectedPlan && (
              <div className="rounded-lg bg-muted p-4 text-sm space-y-1">
                <p>
                  <span className="font-medium">Plano:</span> {selectedPlan.name}
                </p>
                <p>
                  <span className="font-medium">Aulas/mês:</span> {selectedPlan.lessonsPerMonth} (
                  {selectedPlan.lessonDurationMin}min cada)
                </p>
                <p>
                  <span className="font-medium">Valor:</span> {fmtCents(Number(selectedPlan.price))}
                </p>
                {selectedPlan.description && <p className="text-muted-foreground">{selectedPlan.description}</p>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Data de Início *</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount">Desconto (R$)</Label>
                <Input
                  id="discount"
                  name="discount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                />
              </div>
            </div>

            {selectedPlan && discount > 0 && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm">
                <p className="text-green-700 font-medium">Valor final: {fmtCents(finalPrice)}/mês</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <textarea
                id="notes"
                name="notes"
                className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder="Condições especiais, observações..."
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Link href="/admin/enrollments" className="flex-1">
                <Button variant="outline" className="w-full">
                  Cancelar
                </Button>
              </Link>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Criando..." : "Criar Matrícula"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
