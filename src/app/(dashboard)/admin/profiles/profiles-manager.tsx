"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_SECTIONS } from "@/lib/admin-sections";
import { Card, Badge } from "@/components/gw/primitives";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/utils";
import { Plus, Pencil, Trash2, Check } from "lucide-react";

type Profile = { id: string; name: string; sections: string[]; isSystem: boolean; users: number };
type Editing = { id?: string; name: string; sections: string[]; isSystem: boolean } | null;

const GROUPS = ["Gestão", "Operação", "Controle"] as const;

export function ProfilesManager({ initial }: { initial: Profile[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function startNew() {
    setErr("");
    setEditing({ name: "", sections: ["dashboard"], isSystem: false });
  }
  function startEdit(p: Profile) {
    setErr("");
    setEditing({ id: p.id, name: p.name, sections: [...p.sections], isSystem: p.isSystem });
  }
  function toggle(key: string) {
    setEditing((e) =>
      e ? { ...e, sections: e.sections.includes(key) ? e.sections.filter((s) => s !== key) : [...e.sections, key] } : e
    );
  }

  async function save() {
    if (!editing) return;
    if (editing.name.trim().length < 2) return setErr("Dê um nome ao perfil.");
    if (editing.sections.length === 0) return setErr("Escolha ao menos 1 seção.");
    setBusy(true);
    setErr("");
    try {
      const url = editing.id ? `/api/profiles/${editing.id}` : "/api/profiles";
      const res = await fetch(url, {
        method: editing.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: editing.name.trim(), sections: editing.sections }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setErr(d?.error || "Não foi possível salvar.");
        setBusy(false);
        return;
      }
      setEditing(null);
      router.refresh();
    } catch {
      setErr("Falha de rede.");
    }
    setBusy(false);
  }

  async function remove(p: Profile) {
    if (!confirm(`Apagar o perfil "${p.name}"? Os ${p.users} usuário(s) ficam sem perfil (acesso total).`)) return;
    const res = await fetch(`/api/profiles/${p.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else {
      const d = await res.json().catch(() => null);
      alert(d?.error || "Não foi possível apagar.");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      {!editing && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="accent" onClick={startNew}>
            <Plus size={17} /> Novo perfil
          </Button>
        </div>
      )}

      {/* Editor */}
      {editing && (
        <Card>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 14 }}>
            {editing.id ? "Editar perfil" : "Novo perfil"}
          </h3>
          <label className="gw-field" style={{ maxWidth: 360 }}>
            <span className="gw-field-label">Nome do perfil</span>
            <div className="gw-field-box">
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Ex.: Secretário, Comercial…"
                autoFocus
              />
            </div>
          </label>

          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", margin: "16px 0 8px" }}>
            Seções que este perfil acessa
          </div>
          {GROUPS.map((g) => (
            <div key={g} style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 11,
                  fontFamily: "var(--mono)",
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  marginBottom: 6,
                }}
              >
                {g}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ADMIN_SECTIONS.filter((s) => s.group === g).map((s) => {
                  const on = editing.sections.includes(s.key);
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => toggle(s.key)}
                      className={cx("gw-chip-toggle", on && "on")}
                      aria-pressed={on}
                    >
                      {on && <Check size={13} />} {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {err && <p style={{ fontSize: 12.5, color: "var(--danger)", marginTop: 4 }}>{err}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Button variant="accent" onClick={save} disabled={busy}>
              {busy ? "Salvando..." : "Salvar perfil"}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={busy}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      {/* Lista */}
      {!editing &&
        (initial.length === 0 ? (
          <Card style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
            Nenhum perfil ainda. Crie um para limitar o acesso de um usuário.
          </Card>
        ) : (
          <div className="gw-cards-grid">
            {initial.map((p) => (
              <Card key={p.id} className="gw-plan-card">
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{p.users} usuário(s)</div>
                  </div>
                  {p.isSystem && <Badge tone="slate">sistema</Badge>}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                  {p.sections.map((key) => {
                    const sec = ADMIN_SECTIONS.find((s) => s.key === key);
                    return (
                      <span
                        key={key}
                        style={{
                          fontSize: 11.5,
                          color: "var(--ink-2)",
                          background: "var(--bg)",
                          border: "1px solid var(--line)",
                          borderRadius: 6,
                          padding: "2px 8px",
                        }}
                      >
                        {sec?.label ?? key}
                      </span>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 14, alignItems: "center" }}>
                  {p.isSystem ? (
                    // Perfis de sistema são imutáveis (a API rejeita PATCH/DELETE). Edite o seed p/ ajustar.
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>Perfil de sistema (imutável)</span>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" onClick={() => startEdit(p)}>
                        <Pencil size={14} /> Editar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(p)}>
                        <Trash2 size={14} /> Apagar
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ))}
    </div>
  );
}
