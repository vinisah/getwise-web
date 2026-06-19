"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/utils";
import { Check, X, Star } from "lucide-react";

type Student = { studentId: string; name: string; attendance: boolean | null; rating: number | null };

/** Marca presença (presente/ausente) + avaliação (1-5) por aluno e salva no endpoint. */
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
          entries: rows.map((s) => ({ studentId: s.studentId, attendance: s.attendance, rating: s.rating })),
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
              <div style={{ display: "flex", gap: 2 }} role="group" aria-label="Avaliação">
                {[1, 2, 3, 4, 5].map((n) => {
                  const on = s.rating != null && n <= s.rating;
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
                      onClick={() => patch(s.studentId, { rating: s.rating === n ? null : n })}
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        padding: 0,
                        lineHeight: 0,
                      }}
                    >
                      <Star size={15} color={on ? "#FFB24D" : "var(--line)"} fill={on ? "#FFB24D" : "none"} />
                    </button>
                  );
                })}
              </div>
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
