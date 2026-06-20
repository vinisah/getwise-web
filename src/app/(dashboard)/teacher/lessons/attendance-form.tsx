"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/utils";
import { Check, X } from "lucide-react";

type Student = { studentId: string; name: string; attendance: boolean | null };

/**
 * Marca presença (presente/ausente) por aluno e salva no endpoint. NÃO há nota dada pelo
 * professor: "avaliação média" do professor é feedback dos ALUNOS (feature futura), não
 * auto-atribuível — senão o professor inflaria a própria nota.
 */
export function AttendanceForm({ lessonId, students }: { lessonId: string; students: Student[] }) {
  const [rows, setRows] = useState<Student[]>(students);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  function patch(id: string, p: Partial<Student>) {
    setRows((r) => r.map((s) => (s.studentId === id ? { ...s, ...p } : s)));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setErr("");
    try {
      const res = await fetch(`/api/lessons/${lessonId}/attendance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entries: rows.map((s) => ({ studentId: s.studentId, attendance: s.attendance })),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setErr(d?.error || "Não foi possível salvar.");
      } else {
        setSaved(true);
      }
    } catch {
      setErr("Falha de rede.");
    }
    setSaving(false);
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((s) => (
          <div
            key={s.studentId}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 13.5, color: "var(--ink)", fontWeight: 600 }}>{s.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="gw-seg-group">
                <button
                  type="button"
                  className={cx("gw-seg", s.attendance === true && "active")}
                  onClick={() => patch(s.studentId, { attendance: true })}
                >
                  <Check size={14} /> Presente
                </button>
                <button
                  type="button"
                  className={cx("gw-seg", s.attendance === false && "active")}
                  onClick={() => patch(s.studentId, { attendance: false })}
                >
                  <X size={14} /> Ausente
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
        <Button variant="accent" size="sm" onClick={save} disabled={saving}>
          {saving ? "Salvando..." : "Salvar presença"}
        </Button>
        {saved && <span style={{ fontSize: 12.5, color: "var(--success)", fontWeight: 600 }}>Salvo ✓</span>}
        {err && <span style={{ fontSize: 12.5, color: "var(--danger)" }}>{err}</span>}
      </div>
    </div>
  );
}
