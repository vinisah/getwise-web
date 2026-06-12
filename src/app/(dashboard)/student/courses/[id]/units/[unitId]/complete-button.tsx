"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle, PartyPopper } from "lucide-react";

export function CompleteButton({
  unitId,
  courseId,
  alreadyDone,
}: {
  unitId: string;
  courseId: string;
  alreadyDone: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(alreadyDone);
  const [certId, setCertId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function complete() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unitId }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Erro ao salvar progresso.");
      return;
    }
    const data = await res.json();
    setDone(true);
    if (data.certificateId) setCertId(data.certificateId);
    router.refresh();
  }

  if (certId) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--success)", fontWeight: 700 }}>
          <PartyPopper size={20} /> Curso concluído! Certificado emitido 🎉
        </div>
        <Button variant="accent" onClick={() => router.push("/student/certificates")}>Ver certificado</Button>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--success)", fontWeight: 600 }}>
        <CheckCircle size={18} /> Unidade concluída
      </div>
    );
  }

  return (
    <div>
      <Button variant="accent" onClick={complete} disabled={loading}>
        {loading ? "Salvando..." : "Concluir unidade"}
        {!loading && <CheckCircle size={17} />}
      </Button>
      {error && <p style={{ fontSize: 13, color: "var(--danger)", marginTop: 8 }}>{error}</p>}
    </div>
  );
}
