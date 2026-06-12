"use client";

import { useState } from "react";
import { FileDown, Check } from "lucide-react";

export function MaterialList({ materials }: { materials: { id: string; fileName: string }[] }) {
  const [done, setDone] = useState<Record<string, boolean>>({});

  async function download(id: string) {
    const res = await fetch(`/api/materials/${id}/download`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setDone((d) => ({ ...d, [id]: true }));
      window.open(data.fileUrl, "_blank", "noopener");
    }
  }

  return (
    <div className="gw-list">
      {materials.map((m) => (
        <div key={m.id} className="gw-row">
          <div style={{ width: 38, height: 38, borderRadius: "var(--r-sm)", background: "var(--danger-soft)", color: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FileDown size={18} />
          </div>
          <span style={{ flex: 1, fontSize: 14, color: "var(--ink)" }}>{m.fileName}</span>
          <button
            onClick={() => download(m.id)}
            className="gw-chip"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            {done[m.id] ? <><Check size={14} /> Baixado</> : <><FileDown size={14} /> Baixar</>}
          </button>
        </div>
      ))}
    </div>
  );
}
