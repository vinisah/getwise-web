"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

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
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
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
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
        const data = await res.json();
        setHits(Array.isArray(data?.results) ? data.results : []);
      } catch {
        setHits([]);
      }
      setLoading(false);
    }, 220);
    return () => clearTimeout(t);
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
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(16,22,48,.4)",
            zIndex: 80,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: "12vh",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Busca"
            className="gw-card"
            style={{ width: "100%", maxWidth: 560, overflow: "hidden", padding: 0 }}
          >
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
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar alunos, cursos, aulas…"
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: 15,
                  color: "var(--ink)",
                }}
              />
              <kbd
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10.5,
                  color: "var(--muted)",
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  padding: "2px 6px",
                }}
              >
                Esc
              </kbd>
            </div>
            <div style={{ maxHeight: 360, overflowY: "auto", padding: 6 }}>
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
        </div>
      )}
    </>
  );
}
