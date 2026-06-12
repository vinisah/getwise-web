"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, SectionHeader, Badge } from "@/components/gw/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, BookOpen, Settings2 } from "lucide-react";
import { ExerciseEditor } from "./exercise-editor";

interface ExEx { id: string; title: string; type: string; points: number; isRequired: boolean }
interface Unit {
  id: string; title: string; content: string; order: number;
  type: string; videoUrl: string | null; exercises: ExEx[];
}
interface Module { id: string; title: string; description: string | null; order: number; units: Unit[] }
interface Prereq { requiredCourseId: string; requiredCourse: { id: string; title: string } }
interface CourseData {
  id: string;
  title: string;
  level: string;
  modules: Module[];
  prerequisites: Prereq[];
}
interface OtherCourse { id: string; title: string }

export function CourseEditor({ course, others }: { course: CourseData; others: OtherCourse[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [newModule, setNewModule] = useState("");
  const [unitDrafts, setUnitDrafts] = useState<Record<string, { title: string; content: string }>>({});
  const [prereqSel, setPrereqSel] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function saveUnitConfig(unitId: string, type: string, videoUrl: string) {
    await call(`/api/units/${unitId}`, "PUT", { type, videoUrl });
  }

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Erro na operação");
      return false;
    }
    router.refresh();
    return true;
  }

  async function addModule() {
    if (!newModule.trim()) return;
    const ok = await call("/api/modules", "POST", {
      courseId: course.id, title: newModule, order: course.modules.length + 1,
    });
    if (ok) setNewModule("");
  }

  async function addUnit(moduleId: string, currentCount: number) {
    const draft = unitDrafts[moduleId];
    if (!draft?.title?.trim() || !draft?.content?.trim()) {
      alert("Preencha título e conteúdo da unidade");
      return;
    }
    const ok = await call("/api/units", "POST", {
      moduleId, title: draft.title, content: draft.content, order: currentCount + 1,
    });
    if (ok) setUnitDrafts((d) => ({ ...d, [moduleId]: { title: "", content: "" } }));
  }

  async function addPrereq() {
    if (!prereqSel) return;
    const ok = await call(`/api/courses/${course.id}/prerequisites`, "POST", { requiredCourseId: prereqSel });
    if (ok) setPrereqSel("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
      {/* Prerequisitos */}
      <Card>
        <SectionHeader title="Pré-requisitos" sub="Cursos que o aluno deve concluir antes deste" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {course.prerequisites.length === 0 && <span style={{ fontSize: 13, color: "var(--muted)" }}>Nenhum.</span>}
          {course.prerequisites.map((p) => (
            <span key={p.requiredCourseId} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Badge tone="amber">{p.requiredCourse.title}</Badge>
              <button onClick={() => call(`/api/courses/${course.id}/prerequisites?requiredCourseId=${p.requiredCourseId}`, "DELETE")}
                className="gw-icon-btn sm" disabled={busy}><Trash2 size={14} /></button>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={prereqSel} onChange={(e) => setPrereqSel(e.target.value)}
            style={{ height: 40, borderRadius: "var(--r-sm)", border: "1px solid var(--line)", padding: "0 12px", fontSize: 14, background: "var(--card)", flex: 1 }}>
            <option value="">Selecionar curso...</option>
            {others.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </select>
          <Button variant="outline" onClick={addPrereq} disabled={busy || !prereqSel}><Plus size={16} /> Adicionar</Button>
        </div>
      </Card>

      {/* Módulos + unidades */}
      {course.modules.map((mod, mi) => (
        <Card key={mod.id}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Módulo {mi + 1}: {mod.title}</h3>
            <button onClick={() => { if (confirm("Excluir módulo e suas unidades?")) call(`/api/modules/${mod.id}`, "DELETE"); }}
              className="gw-icon-btn sm" disabled={busy}><Trash2 size={16} /></button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {mod.units.map((u, ui) => (
              <div key={u.id} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, fontWeight: 700 }}>{ui + 1}</div>
                  <span style={{ flex: 1, fontSize: 14, color: "var(--ink)" }}>{u.title}</span>
                  <Badge tone="slate">{u.type}</Badge>
                  {u.exercises.length > 0 && <Badge tone="blue">{u.exercises.length} ex.</Badge>}
                  <button onClick={() => setExpanded((e) => ({ ...e, [u.id]: !e[u.id] }))} className="gw-icon-btn sm"><Settings2 size={15} /></button>
                  <button onClick={() => { if (confirm("Excluir unidade?")) call(`/api/units/${u.id}`, "DELETE"); }}
                    className="gw-icon-btn sm" disabled={busy}><Trash2 size={14} /></button>
                </div>

                {expanded[u.id] && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                    {/* Config de vídeo/tipo */}
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <select defaultValue={u.type} id={`type-${u.id}`} style={{ height: 36, borderRadius: 8, border: "1px solid var(--line)", padding: "0 10px", fontSize: 13, background: "var(--card)" }}>
                        <option value="READING">Leitura</option>
                        <option value="VIDEO">Vídeo</option>
                        <option value="MIXED">Vídeo + Leitura</option>
                      </select>
                      <Input id={`video-${u.id}`} defaultValue={u.videoUrl ?? ""} placeholder="URL do vídeo (mp4)" style={{ flex: 1 }} />
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => {
                        const t = (document.getElementById(`type-${u.id}`) as HTMLSelectElement).value;
                        const v = (document.getElementById(`video-${u.id}`) as HTMLInputElement).value;
                        saveUnitConfig(u.id, t, v);
                      }}>Salvar</Button>
                    </div>
                    {/* Exercícios da unidade */}
                    <ExerciseEditor unitId={u.id} exercises={u.exercises} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add unit */}
          <div style={{ marginTop: 14, padding: 14, background: "var(--bg)", borderRadius: "var(--r-sm)", display: "flex", flexDirection: "column", gap: 8 }}>
            <Input placeholder="Título da unidade"
              value={unitDrafts[mod.id]?.title ?? ""}
              onChange={(e) => setUnitDrafts((d) => ({ ...d, [mod.id]: { ...d[mod.id], title: e.target.value, content: d[mod.id]?.content ?? "" } }))} />
            <textarea placeholder="Conteúdo da unidade..." rows={3}
              value={unitDrafts[mod.id]?.content ?? ""}
              onChange={(e) => setUnitDrafts((d) => ({ ...d, [mod.id]: { ...d[mod.id], content: e.target.value, title: d[mod.id]?.title ?? "" } }))}
              style={{ borderRadius: "var(--r-sm)", border: "1px solid var(--line)", padding: "10px 12px", fontSize: 14, fontFamily: "var(--sans)", resize: "vertical" }} />
            <Button variant="outline" size="sm" onClick={() => addUnit(mod.id, mod.units.length)} disabled={busy} style={{ alignSelf: "flex-start" }}>
              <Plus size={15} /> Adicionar unidade
            </Button>
          </div>
        </Card>
      ))}

      {/* Add module */}
      <Card style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <BookOpen size={18} color="var(--muted)" />
        <Input placeholder="Título do novo módulo" value={newModule} onChange={(e) => setNewModule(e.target.value)} style={{ flex: 1 }} />
        <Button variant="accent" onClick={addModule} disabled={busy || !newModule.trim()}><Plus size={16} /> Módulo</Button>
      </Card>
    </div>
  );
}
