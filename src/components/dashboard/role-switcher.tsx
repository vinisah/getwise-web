"use client";

import { useState } from "react";
import { roleHome } from "@/lib/roles";
import { cx } from "@/lib/utils";

const OPTS: { value: string; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "TEACHER", label: "Prof." },
  { value: "STUDENT", label: "Aluno" },
];

/**
 * Seletor de papel (segmented) — só ADMIN. Alterna a visão do painel entre
 * Admin/Professor/Aluno. POSTa o papel pra /api/admin/preview (seta/limpa o cookie
 * de visão) e navega pra home do papel — nav completa pro SSR re-resolver a visão.
 */
export function RoleSwitcher({ current }: { current: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function pick(role: string) {
    if (role === current || busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErr(data?.error || "Não foi possível trocar a visão.");
        setBusy(false);
        return;
      }
      window.location.href = roleHome(role);
    } catch {
      setErr("Falha de rede ao trocar a visão.");
      setBusy(false);
    }
  }

  return (
    <div className="gw-role-switcher">
      <select
        className="gw-role-select"
        aria-label="Visualizar como"
        value={current}
        disabled={busy}
        onChange={(event) => void pick(event.target.value)}
      >
        {OPTS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <div className="gw-seg-group" role="tablist" aria-label="Visualizar como">
        {OPTS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={o.value === current}
            className={cx("gw-seg", o.value === current && "active")}
            onClick={() => pick(o.value)}
            disabled={busy}
          >
            {o.label}
          </button>
        ))}
      </div>
      {err && (
        <span role="status" aria-live="polite" className="gw-role-error">
          {err}
        </span>
      )}
    </div>
  );
}
