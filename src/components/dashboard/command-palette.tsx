"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { AppDialog } from "@/components/ui/app-dialog";

type Hit = { type: string; id: string; title: string; sub?: string; href: string };

/** Busca global (command palette). Abre com Ctrl/⌘+K ou clique na lupa; Esc fecha. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) return;
    setQ("");
    setHits([]);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const data = await res.json();
        if (!controller.signal.aborted) setHits(Array.isArray(data?.results) ? data.results : []);
      } catch {
        if (!controller.signal.aborted) setHits([]);
      }
      if (!controller.signal.aborted) setLoading(false);
    }, 220);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q, open]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  return (
    <>
      <button className="gw-icon-btn" title="Buscar (Ctrl+K)" aria-label="Buscar" onClick={() => setOpen(true)}>
        <Search size={18} />
      </button>
      <AppDialog open={open} onClose={() => setOpen(false)} label="Busca" placement="search">
        <div style={{ width: "100%", maxWidth: 560, overflow: "hidden", padding: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 16px",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <Search size={18} color="var(--muted)" />
            <input
              ref={inputRef}
              aria-label="Buscar no sistema"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar alunos, cursos, aulas…"
              style={{
                flex: 1,
                minWidth: 0,
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 15,
                color: "var(--ink)",
              }}
            />
            {q && (
              <button
                type="button"
                className="gw-icon-btn sm"
                aria-label="Limpar busca"
                onClick={() => {
                  setQ("");
                  setHits([]);
                  inputRef.current?.focus();
                }}
              >
                <X size={16} />
              </button>
            )}
            <button type="button" className="gw-icon-btn sm" aria-label="Fechar busca" onClick={() => setOpen(false)}>
              <X size={18} />
            </button>
          </div>
          <div style={{ padding: 6 }}>
            {q.trim().length < 2 ? (
              <p style={{ fontSize: 13, color: "var(--muted)", padding: "18px 12px", textAlign: "center" }}>
                Digite ao menos 2 caracteres.
              </p>
            ) : loading ? (
              <p style={{ fontSize: 13, color: "var(--muted)", padding: "18px 12px", textAlign: "center" }}>
                Buscando…
              </p>
            ) : hits.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)", padding: "18px 12px", textAlign: "center" }}>
                Nada encontrado.
              </p>
            ) : (
              hits.map((h) => (
                <button
                  key={h.type + h.id}
                  onClick={() => go(h.href)}
                  className="gw-cmd-item"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    padding: "10px 12px",
                    borderRadius: "var(--r-sm)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      fontFamily: "var(--mono)",
                      color: "var(--accent)",
                      background: "var(--accent-soft)",
                      padding: "2px 7px",
                      borderRadius: 6,
                      flexShrink: 0,
                    }}
                  >
                    {h.type}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: "var(--ink)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {h.title}
                    </span>
                    {h.sub && (
                      <span
                        style={{
                          display: "block",
                          fontSize: 12,
                          color: "var(--muted)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {h.sub}
                      </span>
                    )}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </AppDialog>
    </>
  );
}
