"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { fetchJson } from "./fields";
import s from "./enrollment.module.css";
export function CourseUnits({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [version, setVersion] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadedFor, setLoadedFor] = useState("");
  const [reload, setReload] = useState(0);
  const requestKey = `${courseId}:${reload}`;
  const loaded = loadedFor === requestKey;
  useEffect(() => {
    const ctrl = new AbortController();
    fetchJson(`/api/courses/${courseId}/school-units`, { signal: ctrl.signal })
      .then((d) => {
        setUnits(d.units);
        setSelected(d.selected);
        setVersion(d.version);
        setLoadedFor(requestKey);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setMessage(e.message);
      });
    return () => ctrl.abort();
  }, [courseId, requestKey]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const d = await fetchJson(`/api/courses/${courseId}/school-units`, {
        method: "PUT",
        body: JSON.stringify({ unitIds: selected, version }),
      });
      setVersion(d.version);
      setMessage("Unidades do curso atualizadas.");
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form noValidate className={s.card} onSubmit={save}>
      <h2>Unidades que oferecem este curso</h2>
      <p className={s.muted}>
        O curso aparece na matrícula online das unidades selecionadas quando ambos estão ativos e a unidade recebe
        pré-matrículas.
      </p>
      <fieldset disabled={busy || !loaded} className={s.section}>
        <legend>Unidades</legend>
        <div className={s.checks}>
          {units.map((u) => (
            <label key={u.id}>
              <input
                type="checkbox"
                checked={selected.includes(u.id)}
                onChange={(e) =>
                  setSelected(e.target.checked ? [...selected, u.id] : selected.filter((id) => id !== u.id))
                }
              />
              {u.name}
            </label>
          ))}
        </div>
      </fieldset>
      {loaded && !units.length && <p>Nenhuma unidade cadastrada.</p>}
      <div className={s.actions}>
        <Button type="submit" disabled={busy || !loaded}>
          {busy ? "Salvando…" : "Salvar unidades do curso"}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => setReload((v) => v + 1)}>
          Recarregar vínculos
        </Button>
      </div>
      <p role="status">{message}</p>
    </form>
  );
}
